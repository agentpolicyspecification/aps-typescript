import type { Ollama, ChatRequest, ChatResponse, Message as OllamaMessage } from 'ollama';
import type { ApsEngine, InputContext, Message, Metadata, OutputContext, ToolCallContext } from '@agentpolicyspecification/core';

export interface ApsOllamaOptions {
  engine: ApsEngine;
  metadata?: Partial<Metadata>;
}

export type ApsOllamaClient = {
  chat(request: ChatRequest & { stream?: false }): Promise<ChatResponse>;
  chat(request: ChatRequest & { stream: true }): Promise<AsyncIterable<ChatResponse>>;
  chat(request: ChatRequest): Promise<ChatResponse | AsyncIterable<ChatResponse>>;
};

export function withAps(ollama: Ollama, options: ApsOllamaOptions): ApsOllamaClient {
  return {
    async chat(request: ChatRequest): Promise<ChatResponse | AsyncIterable<ChatResponse>> {
      const messages = request.messages ?? [];
      await options.engine.evaluateInput(toInputContext(messages, options));

      if (request.stream === true) {
        const stream = await ollama.chat({ ...request, stream: true });
        return streamWithEval(stream, options);
      }

      const response = await ollama.chat({ ...request, stream: false });

      await evaluateToolCalls(response, options);

      if (response.message.content) {
        await options.engine.evaluateOutput(toOutputContext(response.message.content, options));
      }

      return response;
    },
  } as ApsOllamaClient;
}

async function evaluateToolCalls(response: ChatResponse, options: ApsOllamaOptions): Promise<void> {
  const toolCalls = response.message.tool_calls ?? [];
  console.log('evaluate tool calls:', toolCalls);
  for (const toolCall of toolCalls) {
    await options.engine.evaluateToolCall(toToolCallContext(toolCall, response.message.content, options));
  }
}

async function* streamWithEval(
  stream: AsyncIterable<ChatResponse>,
  options: ApsOllamaOptions,
): AsyncGenerator<ChatResponse> {
  const textChunks: string[] = [];
  let lastChunk: ChatResponse | undefined;

  for await (const chunk of stream) {
    if (chunk.message.content) {
      textChunks.push(chunk.message.content);
    }
    lastChunk = chunk;
    yield chunk;
  }

  // Tool calls arrive in the final chunk
  if (lastChunk) {
    await evaluateToolCalls(lastChunk, options);
  }

  const text = textChunks.join('');
  if (text) {
    await options.engine.evaluateOutput(toOutputContext(text, options));
  }
}

function toInputContext(messages: OllamaMessage[], options: ApsOllamaOptions): InputContext {
  return {
    messages: messages.map(toApsMessage),
    metadata: getMetadata(options),
  };
}

function toOutputContext(text: string, options: ApsOllamaOptions): OutputContext {
  return {
    response: { role: 'assistant', content: text },
    metadata: getMetadata(options),
  };
}

function toToolCallContext(
  toolCall: { function: { name: string; arguments: Record<string, unknown> } },
  assistantContent: string,
  options: ApsOllamaOptions,
): ToolCallContext {
  return {
    tool_name: toolCall.function.name,
    arguments: toolCall.function.arguments,
    calling_message: { role: 'assistant', content: assistantContent },
    metadata: getMetadata(options),
  };
}

function toApsMessage(m: OllamaMessage): Message {
  const role = m.role === 'user' || m.role === 'assistant' || m.role === 'system'
    ? m.role
    : 'user';
  const content = typeof m.content === 'string' ? m.content : '';
  return { role, content };
}

function getMetadata(options: ApsOllamaOptions): Metadata {
  return {
    agent_id: options.metadata?.agent_id ?? 'unknown',
    session_id: options.metadata?.session_id ?? 'unknown',
    timestamp: new Date().toISOString(),
    ...options.metadata,
  };
}
