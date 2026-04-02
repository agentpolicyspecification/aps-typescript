import { jest, describe, it, expect } from '@jest/globals';
import { withAps, withApsTools } from '../src/index.js';
import { ApsEngine, PolicyDenialError } from '@agentpolicyspecification/core';
import type { InputContext, OutputContext, ToolCallContext, PolicyDecision, PolicySet } from '@agentpolicyspecification/core';
import type { MastraAgentLike } from '../src/index.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALLOW: PolicyDecision = { decision: 'allow' };
const DENY: PolicyDecision = { decision: 'deny', reason: 'blocked' };

function makeEngine(policySet: PolicySet): ApsEngine {
  return new ApsEngine({ policySet });
}

function makeMockAgent(text: string): MastraAgentLike {
  return {
    generate: jest.fn<() => Promise<{ text: string }>>().mockResolvedValue({ text }),
    stream: jest.fn<() => Promise<{ text: Promise<string> }>>().mockResolvedValue({
      text: Promise.resolve(text),
    }),
  };
}

// ─── withAps — generate ───────────────────────────────────────────────────────

describe('withAps – generate', () => {
  it('passes through when all policies allow', async () => {
    const agent = makeMockAgent('Paris');
    const engine = makeEngine({
      input: [{ id: 'allow-all', evaluate: () => ALLOW }],
      output: [{ id: 'allow-all', evaluate: () => ALLOW }],
    });

    const apsAgent = withAps(agent, { engine, metadata: { agent_id: 'test', session_id: 's1' } });
    const result = await apsAgent.generate('What is the capital of France?') as { text: string };

    expect(result.text).toBe('Paris');
    expect(agent.generate).toHaveBeenCalledTimes(1);
  });

  it('throws PolicyDenialError when input policy denies', async () => {
    const agent = makeMockAgent('ok');
    const engine = makeEngine({
      input: [{ id: 'no-ssn', evaluate: () => DENY }],
    });

    const apsAgent = withAps(agent, { engine });
    await expect(
      apsAgent.generate('My SSN is 123-45-6789'),
    ).rejects.toBeInstanceOf(PolicyDenialError);

    expect(agent.generate).not.toHaveBeenCalled();
  });

  it('throws PolicyDenialError when output policy denies', async () => {
    const agent = makeMockAgent('confidential information');
    const engine = makeEngine({
      input: [{ id: 'allow-all', evaluate: () => ALLOW }],
      output: [{ id: 'no-confidential', evaluate: () => DENY }],
    });

    const apsAgent = withAps(agent, { engine });
    await expect(apsAgent.generate('Tell me something')).rejects.toBeInstanceOf(PolicyDenialError);
  });

  it('forwards metadata to input context', async () => {
    const inputEvaluate = jest.fn<(ctx: InputContext) => PolicyDecision>().mockReturnValue(ALLOW);
    const agent = makeMockAgent('ok');
    const engine = makeEngine({
      input: [{ id: 'check-meta', evaluate: inputEvaluate as (ctx: InputContext) => PolicyDecision }],
    });

    const apsAgent = withAps(agent, { engine, metadata: { agent_id: 'agent-1', session_id: 'sess-1' } });
    await apsAgent.generate('hello');

    const ctx = inputEvaluate.mock.calls[0]?.[0] as InputContext;
    expect(ctx.metadata?.agent_id).toBe('agent-1');
    expect(ctx.metadata?.session_id).toBe('sess-1');
  });

  it('converts string prompt to InputContext messages', async () => {
    const inputEvaluate = jest.fn<(ctx: InputContext) => PolicyDecision>().mockReturnValue(ALLOW);
    const agent = makeMockAgent('ok');
    const engine = makeEngine({
      input: [{ id: 'check-messages', evaluate: inputEvaluate as (ctx: InputContext) => PolicyDecision }],
    });

    const apsAgent = withAps(agent, { engine });
    await apsAgent.generate('hello world');

    const ctx = inputEvaluate.mock.calls[0]?.[0] as InputContext;
    expect(ctx.messages).toEqual([{ role: 'user', content: 'hello world' }]);
  });
});

// ─── withAps — stream ─────────────────────────────────────────────────────────

describe('withAps – stream', () => {
  it('evaluates output when .text is awaited', async () => {
    const outputEvaluate = jest.fn<(ctx: OutputContext) => PolicyDecision>().mockReturnValue(ALLOW);
    const agent = makeMockAgent('streaming response');
    const engine = makeEngine({
      input: [{ id: 'allow-all', evaluate: () => ALLOW }],
      output: [{ id: 'check-output', evaluate: outputEvaluate as (ctx: OutputContext) => PolicyDecision }],
    });

    const apsAgent = withAps(agent, { engine });
    const result = await apsAgent.stream('hello') as { text: Promise<string> };
    const text = await result.text;

    expect(text).toBe('streaming response');
    const ctx = outputEvaluate.mock.calls[0]?.[0] as OutputContext;
    expect(ctx.response?.content).toBe('streaming response');
  });

  it('throws PolicyDenialError when input policy denies', async () => {
    const agent = makeMockAgent('ok');
    const engine = makeEngine({
      input: [{ id: 'deny-all', evaluate: () => DENY }],
    });

    const apsAgent = withAps(agent, { engine });
    await expect(apsAgent.stream('hello')).rejects.toBeInstanceOf(PolicyDenialError);
    expect(agent.stream).not.toHaveBeenCalled();
  });

  it('throws PolicyDenialError when output policy denies (on .text await)', async () => {
    const agent = makeMockAgent('confidential data');
    const engine = makeEngine({
      input: [{ id: 'allow-all', evaluate: () => ALLOW }],
      output: [{ id: 'no-confidential', evaluate: () => DENY }],
    });

    const apsAgent = withAps(agent, { engine });
    const result = await apsAgent.stream('tell me') as { text: Promise<string> };
    await expect(result.text).rejects.toBeInstanceOf(PolicyDenialError);
  });
});

// ─── withApsTools ─────────────────────────────────────────────────────────────

describe('withApsTools', () => {
  it('calls evaluateToolCall before executing the tool', async () => {
    const toolEvaluate = jest.fn<(ctx: ToolCallContext) => PolicyDecision>().mockReturnValue(ALLOW);
    const engine = makeEngine({
      tool_call: [{ id: 'check-tools', evaluate: toolEvaluate as (ctx: ToolCallContext) => PolicyDecision }],
    });

    const originalExecute = jest.fn<() => Promise<{ result: string }>>().mockResolvedValue({ result: 'ok' });
    const tools = withApsTools(
      { get_weather: { id: 'get_weather', execute: originalExecute as unknown as (input: unknown) => Promise<unknown> } },
      { engine },
    );

    await tools['get_weather']!.execute!({ city: 'Amsterdam' });

    expect(toolEvaluate).toHaveBeenCalledTimes(1);
    const ctx = toolEvaluate.mock.calls[0]?.[0] as ToolCallContext;
    expect(ctx.tool_name).toBe('get_weather');
    expect(ctx.arguments).toEqual({ city: 'Amsterdam' });
    expect(originalExecute).toHaveBeenCalledTimes(1);
  });

  it('throws PolicyDenialError when tool call is denied', async () => {
    const engine = makeEngine({
      tool_call: [{ id: 'no-dangerous', evaluate: () => DENY }],
    });

    const originalExecute = jest.fn();
    const tools = withApsTools(
      { delete_file: { id: 'delete_file', execute: originalExecute as unknown as (input: unknown) => Promise<unknown> } },
      { engine },
    );

    await expect(
      tools['delete_file']!.execute!({ path: '/etc/passwd' }),
    ).rejects.toBeInstanceOf(PolicyDenialError);

    expect(originalExecute).not.toHaveBeenCalled();
  });

  it('preserves other tool properties', () => {
    const engine = makeEngine({});
    const originalTool = { id: 'my_tool', description: 'A tool', execute: async () => ({}) };
    const tools = withApsTools({ my_tool: originalTool }, { engine });

    expect(tools['my_tool']!.id).toBe('my_tool');
    expect(tools['my_tool']!.description).toBe('A tool');
  });
});
