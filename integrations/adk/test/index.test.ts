import { jest, describe, it, expect } from '@jest/globals';
import type { Ollama, ChatResponse } from 'ollama';
import { withAps } from '../src/index.js';
import { ApsEngine, PolicyDenialError } from '@agentpolicyspecification/core';
import type { InputContext, OutputContext, ToolCallContext, PolicyDecision, PolicySet } from '@agentpolicyspecification/core';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ALLOW_DECISION: PolicyDecision = { decision: 'allow' };
const DENY_DECISION: PolicyDecision = { decision: 'deny', reason: 'blocked by policy' };

function makeMockOllama(reply: string, toolCalls?: ChatResponse['message']['tool_calls']): { ollama: Ollama; chatSpy: ReturnType<typeof jest.fn> } {
  const chatSpy = jest.fn<() => Promise<ChatResponse>>().mockResolvedValue({
    message: { role: 'assistant', content: reply, tool_calls: toolCalls },
  } as ChatResponse);
  return { ollama: { chat: chatSpy } as unknown as Ollama, chatSpy };
}

function makeStreamingMockOllama(chunks: string[]): { ollama: Ollama; chatSpy: ReturnType<typeof jest.fn> } {
  async function* gen(): AsyncGenerator<ChatResponse> {
    for (const chunk of chunks) {
      yield { message: { role: 'assistant', content: chunk } } as ChatResponse;
    }
  }
  const chatSpy = jest.fn<() => Promise<AsyncGenerator<ChatResponse>>>().mockResolvedValue(gen());
  return { ollama: { chat: chatSpy } as unknown as Ollama, chatSpy };
}

function makeEngine(policySet: PolicySet): ApsEngine {
  return new ApsEngine({ policySet });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('withAps – non-streaming', () => {
  it('passes through when all policies allow', async () => {
    const { ollama } = makeMockOllama('Madrid');
    const engine = makeEngine({
      input: [{ id: 'allow-all', evaluate: () => ALLOW_DECISION }],
      output: [{ id: 'allow-all', evaluate: () => ALLOW_DECISION }],
    });

    const client = withAps(ollama, { engine, metadata: { agent_id: 'test', session_id: 's1' } });
    const response = await client.chat({ model: 'llama3', messages: [{ role: 'user', content: 'Capital of Spain?' }] });

    expect(response.message.content).toBe('Madrid');
  });

  it('throws PolicyDenialError when input policy denies', async () => {
    const { ollama, chatSpy } = makeMockOllama('Madrid');
    const engine = makeEngine({
      input: [{ id: 'no-pii', evaluate: () => DENY_DECISION }],
    });

    const client = withAps(ollama, { engine });
    await expect(
      client.chat({ model: 'llama3', messages: [{ role: 'user', content: 'My SSN is 123-45-6789' }] }),
    ).rejects.toBeInstanceOf(PolicyDenialError);

    expect(chatSpy).not.toHaveBeenCalled();
  });

  it('throws PolicyDenialError when output policy denies', async () => {
    const { ollama } = makeMockOllama('secret information');
    const engine = makeEngine({
      input: [{ id: 'allow-all', evaluate: () => ALLOW_DECISION }],
      output: [{ id: 'no-secrets', evaluate: () => DENY_DECISION }],
    });

    const client = withAps(ollama, { engine });
    await expect(
      client.chat({ model: 'llama3', messages: [{ role: 'user', content: 'Tell me something' }] }),
    ).rejects.toBeInstanceOf(PolicyDenialError);
  });

  it('forwards metadata to engine context', async () => {
    const inputEvaluate = jest.fn<(ctx: InputContext) => PolicyDecision>().mockReturnValue(ALLOW_DECISION);
    const { ollama } = makeMockOllama('ok');
    const engine = makeEngine({
      input: [{ id: 'check-meta', evaluate: inputEvaluate as (ctx: InputContext) => PolicyDecision }],
    });

    const client = withAps(ollama, { engine, metadata: { agent_id: 'agent-1', session_id: 'sess-1' } });
    await client.chat({ model: 'llama3', messages: [{ role: 'user', content: 'hi' }] });

    const ctx = inputEvaluate.mock.calls[0]?.[0] as InputContext;
    expect(ctx.metadata?.agent_id).toBe('agent-1');
    expect(ctx.metadata?.session_id).toBe('sess-1');
  });
});

describe('withAps – streaming', () => {
  it('yields all chunks and evaluates output after stream ends', async () => {
    const chunks = ['Hello', ', ', 'world!'];
    const { ollama } = makeStreamingMockOllama(chunks);
    const outputEvaluate = jest.fn<(ctx: OutputContext) => PolicyDecision>().mockReturnValue(ALLOW_DECISION);
    const engine = makeEngine({
      input: [{ id: 'allow-all', evaluate: () => ALLOW_DECISION }],
      output: [{ id: 'check-output', evaluate: outputEvaluate as (ctx: OutputContext) => PolicyDecision }],
    });

    const client = withAps(ollama, { engine });
    const stream = await client.chat({ model: 'llama3', messages: [{ role: 'user', content: 'hi' }], stream: true });

    const received: string[] = [];
    for await (const chunk of stream as AsyncIterable<ChatResponse>) {
      received.push(chunk.message.content);
    }

    expect(received).toEqual(chunks);

    const outputCtx = outputEvaluate.mock.calls[0]?.[0] as OutputContext;
    expect(outputCtx.response?.content).toBe('Hello, world!');
  });

  it('throws PolicyDenialError when input policy denies (streaming)', async () => {
    const { ollama, chatSpy } = makeStreamingMockOllama(['hi']);
    const engine = makeEngine({
      input: [{ id: 'deny-all', evaluate: () => DENY_DECISION }],
    });

    const client = withAps(ollama, { engine });
    await expect(
      client.chat({ model: 'llama3', messages: [{ role: 'user', content: 'hi' }], stream: true }),
    ).rejects.toBeInstanceOf(PolicyDenialError);

    expect(chatSpy).not.toHaveBeenCalled();
  });
});

describe('withAps – tool calls', () => {
  it('evaluates each tool call returned by the model', async () => {
    const toolCalls = [
      { function: { name: 'get_weather', arguments: { city: 'Madrid' } } },
      { function: { name: 'search_web', arguments: { query: 'news' } } },
    ];
    const { ollama } = makeMockOllama('', toolCalls);
    const toolEvaluate = jest.fn<(ctx: ToolCallContext) => PolicyDecision>().mockReturnValue(ALLOW_DECISION);
    const engine = makeEngine({
      input: [{ id: 'allow-all', evaluate: () => ALLOW_DECISION }],
      tool_call: [{ id: 'check-tools', evaluate: toolEvaluate as (ctx: ToolCallContext) => PolicyDecision }],
    });

    const client = withAps(ollama, { engine });
    await client.chat({ model: 'llama3', messages: [{ role: 'user', content: 'What is the weather?' }] });

    expect(toolEvaluate).toHaveBeenCalledTimes(2);
    const ctx0 = toolEvaluate.mock.calls[0]?.[0] as ToolCallContext;
    expect(ctx0.tool_name).toBe('get_weather');
    expect(ctx0.arguments).toEqual({ city: 'Madrid' });
    const ctx1 = toolEvaluate.mock.calls[1]?.[0] as ToolCallContext;
    expect(ctx1.tool_name).toBe('search_web');
  });

  it('throws PolicyDenialError when a tool call is denied', async () => {
    const toolCalls = [{ function: { name: 'delete_file', arguments: { path: '/etc/passwd' } } }];
    const { ollama } = makeMockOllama('', toolCalls);
    const engine = makeEngine({
      input: [{ id: 'allow-all', evaluate: () => ALLOW_DECISION }],
      tool_call: [{ id: 'no-dangerous-tools', evaluate: () => DENY_DECISION }],
    });

    const client = withAps(ollama, { engine });
    await expect(
      client.chat({ model: 'llama3', messages: [{ role: 'user', content: 'Delete the file' }] }),
    ).rejects.toBeInstanceOf(PolicyDenialError);
  });

  it('evaluates tool calls from the final chunk in streaming mode', async () => {
    const toolCalls = [{ function: { name: 'get_weather', arguments: { city: 'Paris' } } }];
    async function* gen(): AsyncGenerator<ChatResponse> {
      yield { message: { role: 'assistant', content: 'Checking...' } } as ChatResponse;
      yield { message: { role: 'assistant', content: '', tool_calls: toolCalls } } as unknown as ChatResponse;
    }
    const chatSpy = jest.fn<() => Promise<AsyncGenerator<ChatResponse>>>().mockResolvedValue(gen());
    const ollama = { chat: chatSpy } as unknown as Ollama;

    const toolEvaluate = jest.fn<(ctx: ToolCallContext) => PolicyDecision>().mockReturnValue(ALLOW_DECISION);
    const engine = makeEngine({
      input: [{ id: 'allow-all', evaluate: () => ALLOW_DECISION }],
      tool_call: [{ id: 'check-tools', evaluate: toolEvaluate as (ctx: ToolCallContext) => PolicyDecision }],
    });

    const client = withAps(ollama, { engine });
    const stream = await client.chat({ model: 'llama3', messages: [{ role: 'user', content: 'Weather?' }], stream: true });
    for await (const _ of stream as AsyncIterable<ChatResponse>) { /* consume */ }

    expect(toolEvaluate).toHaveBeenCalledTimes(1);
    const ctx = toolEvaluate.mock.calls[0]?.[0] as ToolCallContext;
    expect(ctx.tool_name).toBe('get_weather');
    expect(ctx.arguments).toEqual({ city: 'Paris' });
  });
});
