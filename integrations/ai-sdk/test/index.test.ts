import { LLMock } from '@copilotkit/llmock';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { ApsEngine, type InputContext, type PolicyDecision } from '@agentpolicyspecification/core';
import { withAps } from '../src/index.js';

describe('AI SDK + APS Integration', () => {
  let mock: LLMock;
  let mockUrl: string;

  beforeAll(async () => {
    mock = new LLMock({ port: 5555 });
    mockUrl = await mock.start();
  });

  afterAll(async () => {
    await mock.stop();
  });

  afterEach(() => {
    mock.reset();
  });

  it('APS intercepts input policy and LLM returns mocked response successfully', async () => {
    mock.onMessage('hello from test', { content: 'Mocked APS Response!' });

    const engine = new ApsEngine({
      policySet: {
        input: [
          {
            id: 'test-policy',
            evaluate: async (ctx: InputContext): Promise<PolicyDecision> => {
              if (ctx.messages.some(m => m.content.includes('blocked'))) {
                return { decision: 'deny', reason: 'Blocked keyword' };
              }
              return { decision: 'allow' };
            },
          },
        ],
      },
    });

    const customOpenAI = createOpenAI({
      baseURL: `${mockUrl}/v1`,
      apiKey: 'dummy-key',
    });

    const wrappedModel = withAps(customOpenAI.chat('gpt-4o'), { engine });

    const response = await generateText({
      model: wrappedModel,
      prompt: 'hello from test',
    });

    expect(response.text).toBe('Mocked APS Response!');
  });

  it('APS denies blocked input and does not reach the LLM', async () => {
    const engine = new ApsEngine({
      policySet: {
        input: [
          {
            id: 'block-policy',
            evaluate: async (ctx: InputContext): Promise<PolicyDecision> => {
              if (ctx.messages.some(m => m.content.includes('blocked'))) {
                return { decision: 'deny', reason: 'Blocked keyword' };
              }
              return { decision: 'allow' };
            },
          },
        ],
      },
    });

    const customOpenAI = createOpenAI({
      baseURL: `${mockUrl}/v1`,
      apiKey: 'dummy-key',
    });

    const wrappedModel = withAps(customOpenAI.chat('gpt-4o'), { engine });

    await expect(
      generateText({ model: wrappedModel, prompt: 'this is blocked content' })
    ).rejects.toThrow();
  });
});
