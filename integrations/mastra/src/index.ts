import type { Agent } from '@mastra/core/agent';

/** Minimal interface describing the Mastra Agent methods we intercept. */
export interface MastraAgentLike {
  generate(messages: unknown, opts?: unknown): Promise<unknown>;
  stream(messages: unknown, opts?: unknown): Promise<unknown>;
}
import type { ApsEngine, InputContext, Message, Metadata, OutputContext, ToolCallContext } from '@agentpolicyspecification/core';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ApsMastraOptions {
  engine: ApsEngine;
  metadata?: Partial<Metadata>;
}

/**
 * A Mastra Tool shape — only the fields we need to intercept.
 * Kept minimal so it works with any version of @mastra/core Tool.
 */
export type MastraTool = {
  readonly id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute?: (input: any, context?: any) => Promise<unknown>;
};

// ─── withAps ─────────────────────────────────────────────────────────────────

/**
 * Wraps a Mastra Agent with APS input/output policy enforcement.
 *
 * Input is evaluated before every generate/stream call.
 * Output is evaluated after the response text is resolved.
 *
 * For tool call policies, wrap the tools separately with {@link withApsTools}
 * before passing them to the Agent constructor.
 *
 * @example
 * ```ts
 * const tools = withApsTools({ get_weather: getWeatherTool }, { engine });
 * const agent = new Agent({ id: 'my-agent', name: '...', model, tools, instructions: '...' });
 * const apsAgent = withAps(agent, { engine, metadata: { agent_id: 'x', session_id: 'y' } });
 *
 * const result = await apsAgent.generate('What is the weather in Amsterdam?');
 * ```
 */
export function withAps(
  agent: MastraAgentLike,
  options: ApsMastraOptions,
): ApsAgent {
  return new ApsAgent(agent, options);
}

/**
 * Wraps a record of Mastra tools with APS tool_call policy enforcement.
 * Each tool's `execute` function will call `engine.evaluateToolCall` before running.
 */
export function withApsTools<T extends Record<string, MastraTool>>(
  tools: T,
  options: ApsMastraOptions,
): T {
  const wrapped = {} as T;

  for (const key of Object.keys(tools) as (keyof T)[]) {
    const tool = tools[key] as MastraTool;
    const originalExecute = tool.execute;

    // Preserve prototype chain (Tool is a class instance)
    const wrappedTool = Object.create(
      Object.getPrototypeOf(tool) as object,
    ) as MastraTool;
    Object.assign(wrappedTool, tool);

    wrappedTool.execute = async (input: unknown, context: unknown) => {
      await options.engine.evaluateToolCall(
        toToolCallContext(tool.id, input, options),
      );
      if (originalExecute) {
        return originalExecute.call(tool, input, context);
      }
    };

    wrapped[key] = wrappedTool as T[keyof T];
  }

  return wrapped;
}

// ─── ApsAgent ─────────────────────────────────────────────────────────────────

export class ApsAgent {
  constructor(
    private readonly agent: MastraAgentLike,
    private readonly options: ApsMastraOptions,
  ) {}

  async generate(messages: MessageListInput, opts?: unknown): Promise<unknown> {
    await this.options.engine.evaluateInput(toInputContext(messages, this.options));

    const result = await this.agent.generate(messages as never, opts as never);

    // generate() returns FullOutput where .text is a plain string
    const text = (result as { text?: string }).text ?? '';
    if (text) {
      await this.options.engine.evaluateOutput(toOutputContext(text, this.options));
    }

    return result;
  }

  async stream(messages: MessageListInput, opts?: unknown): Promise<unknown> {
    await this.options.engine.evaluateInput(toInputContext(messages, this.options));

    const result = await this.agent.stream(messages as never, opts as never);

    // stream() returns MastraModelOutput where .text is a Promise<string>
    // Proxy it so output evaluation runs when .text is awaited
    const engine = this.options.engine;
    const outputOptions = this.options;

    return new Proxy(result as object, {
      get(target, prop, receiver) {
        if (prop === 'text') {
          const textProp = Reflect.get(target, prop, receiver) as Promise<string> | string;
          const textPromise = Promise.resolve(textProp);
          return textPromise.then(async (text: string) => {
            if (text) {
              await engine.evaluateOutput(toOutputContext(text, outputOptions));
            }
            return text;
          });
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }
}

// ─── Context builders ─────────────────────────────────────────────────────────

type MessageListInput = string | string[] | unknown | unknown[];

function toInputContext(messages: MessageListInput, options: ApsMastraOptions): InputContext {
  return {
    messages: extractMessages(messages),
    metadata: getMetadata(options),
  };
}

function toOutputContext(text: string, options: ApsMastraOptions): OutputContext {
  return {
    response: { role: 'assistant', content: text },
    metadata: getMetadata(options),
  };
}

function toToolCallContext(
  toolName: string,
  input: unknown,
  options: ApsMastraOptions,
): ToolCallContext {
  return {
    tool_name: toolName,
    arguments: (input ?? {}) as Record<string, unknown>,
    calling_message: { role: 'assistant', content: '' },
    metadata: getMetadata(options),
  };
}

function getMetadata(options: ApsMastraOptions): Metadata {
  return {
    agent_id: options.metadata?.agent_id ?? 'unknown',
    session_id: options.metadata?.session_id ?? 'unknown',
    timestamp: new Date().toISOString(),
    ...options.metadata,
  };
}

function extractMessages(input: MessageListInput): Message[] {
  if (typeof input === 'string') {
    return [{ role: 'user', content: input }];
  }

  if (Array.isArray(input)) {
    return (input as unknown[]).flatMap((item): Message[] => {
      if (typeof item === 'string') {
        return [{ role: 'user', content: item }];
      }
      if (isMessageLike(item)) {
        const role = item.role === 'assistant' || item.role === 'system' ? item.role : 'user';
        const content = typeof item.content === 'string' ? item.content : '';
        return [{ role, content }];
      }
      return [];
    });
  }

  if (isMessageLike(input)) {
    const role = input.role === 'assistant' || input.role === 'system' ? input.role : 'user';
    const content = typeof input.content === 'string' ? input.content : '';
    return [{ role, content }];
  }

  return [];
}

function isMessageLike(v: unknown): v is { role: string; content: unknown } {
  return typeof v === 'object' && v !== null && 'role' in v;
}
