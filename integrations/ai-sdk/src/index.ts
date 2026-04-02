import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3Prompt,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
  LanguageModelV3Text,
  LanguageModelV3TextPart,
  LanguageModelV3ToolCall,
} from '@ai-sdk/provider';
import type { ApsEngine, InputContext, Message, Metadata, OutputContext, ToolCallContext } from '@agentpolicyspecification/core';

export interface ApsLanguageModelOptions {
  engine: ApsEngine;
  metadata?: Partial<Metadata>;
}

export function withAps(model: LanguageModelV3, options: ApsLanguageModelOptions): LanguageModelV3 {
  return {
    specificationVersion: 'v3',
    provider: model.provider,
    modelId: model.modelId,
    supportedUrls: model.supportedUrls,

    async doGenerate(callOptions: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
      await options.engine.evaluateInput(toInputContext(callOptions.prompt, options));

      const result = await model.doGenerate(callOptions);

      await evaluateToolCalls(result, callOptions.prompt, options);

      const text = extractText(result);
      if (text) {
        await options.engine.evaluateOutput(toOutputContext(text, options));
      }

      return result;
    },

    async doStream(callOptions: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
      await options.engine.evaluateInput(toInputContext(callOptions.prompt, options));

      const result = await model.doStream(callOptions);

      return {
        ...result,
        stream: interceptStream(result.stream, callOptions.prompt, options),
      };
    },
  };
}

function interceptStream(
  stream: ReadableStream<LanguageModelV3StreamPart>,
  prompt: LanguageModelV3Prompt,
  options: ApsLanguageModelOptions,
): ReadableStream<LanguageModelV3StreamPart> {
  const textBuffer: string[] = [];

  return stream.pipeThrough(
    new TransformStream<LanguageModelV3StreamPart, LanguageModelV3StreamPart>({
      async transform(chunk, controller) {
        if (chunk.type === 'text-delta') {
          textBuffer.push(chunk.delta);
        } else if (chunk.type === 'tool-call') {
          await options.engine.evaluateToolCall(toToolCallContext(chunk, prompt, options));
        }
        controller.enqueue(chunk);
      },
      async flush() {
        const text = textBuffer.join('');
        if (text) {
          await options.engine.evaluateOutput(toOutputContext(text, options));
        }
      },
    }),
  );
}

async function evaluateToolCalls(
  result: LanguageModelV3GenerateResult,
  prompt: LanguageModelV3Prompt,
  options: ApsLanguageModelOptions,
): Promise<void> {
  const toolCalls = result.content.filter(isToolCall);
  for (const toolCall of toolCalls) {
    await options.engine.evaluateToolCall(toToolCallContext(toolCall, prompt, options));
  }
}

function isToolCall(p: { type: string }): p is LanguageModelV3ToolCall {
  return p.type === 'tool-call';
}

function isTextContent(p: { type: string }): p is LanguageModelV3Text {
  return p.type === 'text';
}

function extractText(result: LanguageModelV3GenerateResult): string {
  return result.content.filter(isTextContent).map(p => p.text).join('');
}

function toInputContext(prompt: LanguageModelV3Prompt, options: ApsLanguageModelOptions): InputContext {
  return {
    messages: promptToApsMessages(prompt),
    metadata: getMetadata(options),
  };
}

function toToolCallContext(
  toolCall: LanguageModelV3ToolCall,
  prompt: LanguageModelV3Prompt,
  options: ApsLanguageModelOptions,
): ToolCallContext {
  const lastAssistantContent = prompt
    .filter(m => m.role === 'assistant')
    .flatMap(m => m.content.filter(isTextPart).map(p => p.text))
    .join(' ');
  return {
    tool_name: toolCall.toolName,
    arguments: JSON.parse(toolCall.input || '{}') as Record<string, unknown>,
    calling_message: { role: 'assistant', content: lastAssistantContent },
    metadata: getMetadata(options),
  };
}

function toOutputContext(text: string, options: ApsLanguageModelOptions): OutputContext {
  return {
    response: { role: 'assistant', content: text },
    metadata: getMetadata(options),
  };
}

function getMetadata(options: ApsLanguageModelOptions): Metadata {
  return {
    agent_id: options.metadata?.agent_id ?? 'unknown',
    session_id: options.metadata?.session_id ?? 'unknown',
    timestamp: new Date().toISOString(),
    ...options.metadata,
  };
}

function isTextPart(p: { type: string }): p is LanguageModelV3TextPart {
  return p.type === 'text';
}

function promptToApsMessages(prompt: LanguageModelV3Prompt): Message[] {
  return prompt.flatMap((m): Message[] => {
    if (m.role === 'tool') return [];

    if (m.role === 'system') {
      return [{ role: 'system', content: m.content }];
    }

    if (m.role === 'user') {
      const content = m.content.filter(isTextPart).map(p => p.text).join(' ');
      return [{ role: 'user', content }];
    }

    // assistant
    const content = m.content.filter(isTextPart).map(p => p.text).join(' ');
    return [{ role: 'assistant', content }];
  });
}
