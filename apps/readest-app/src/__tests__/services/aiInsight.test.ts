import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAIInsight } from '@/services/llm/aiInsight';
import * as env from '@/services/environment';

// Mock getAIFetch, since we test both tauri (httpFetch) and web (fetch) code paths.
const mockTauriFetch = vi.fn();
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: (...args: any[]) => mockTauriFetch(...args),
}));

describe('AI Insight Service', () => {
  let originalFetch: typeof fetch;
  const mockWebFetch = vi.fn();

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = mockWebFetch as any;
    mockTauriFetch.mockReset();
    mockWebFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('parses correct structured JSON from OpenAI-style provider (web platform)', async () => {
    vi.spyOn(env, 'isTauriAppPlatform').mockReturnValue(false);
    
    const sampleResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              mainTranslation: 'halo',
              alternatives: [
                { translation: 'hai', usage: 'informal', example: 'Hai apa kabar', confidence: 'high' }
              ],
              note: 'sebuah sapaan'
            })
          }
        }
      ]
    };

    mockWebFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => sampleResponse,
    } as any);

    const result = await getAIInsight('hello', 'en', 'id', {
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    });

    expect(result.mainTranslation).toBe('halo');
    expect(result.alternatives).toBeDefined();
    expect(result.alternatives?.[0]?.translation).toBe('hai');
    expect(result.note).toBe('sebuah sapaan');
    expect(mockWebFetch).toHaveBeenCalledTimes(1);
  });

  it('includes context in the system prompt if context is provided', async () => {
    vi.spyOn(env, 'isTauriAppPlatform').mockReturnValue(false);

    const sampleResponse = {
      choices: [{ message: { content: JSON.stringify({ mainTranslation: 'halo', alternatives: [] }) } }]
    };

    mockWebFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => sampleResponse,
    } as any);

    const contextText = 'Dia berkata hello kepada saya kemarin.';
    await getAIInsight('hello', 'en', 'id', {
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    }, undefined, contextText);

    expect(mockWebFetch).toHaveBeenCalledTimes(1);
    const callArgs = mockWebFetch.mock.calls[0];
    expect(callArgs).toBeDefined();
    const bodyObj = JSON.parse(callArgs?.[1]?.body || '{}');
    const systemPrompt = bodyObj.messages.find((m: { role: string; content?: string }) => m.role === 'system')?.content || '';
    
    expect(systemPrompt).toContain('The word appears in this context: "Dia berkata hello kepada saya kemarin."');
  });

  it('parses JSON contained inside markdown code blocks', async () => {
    vi.spyOn(env, 'isTauriAppPlatform').mockReturnValue(false);
    
    const content = `\`\`\`json\n{\n  "mainTranslation": "halo",\n  "alternatives": []\n}\n\`\`\``;
    const sampleResponse = {
      choices: [{ message: { content } }]
    };

    mockWebFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => sampleResponse,
    } as any);

    const result = await getAIInsight('hello', 'en', 'id', {
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    });

    expect(result.mainTranslation).toBe('halo');
    expect(result.alternatives).toEqual([]);
  });

  it('falls back to flat string when JSON parsing fails', async () => {
    vi.spyOn(env, 'isTauriAppPlatform').mockReturnValue(false);
    
    const sampleResponse = {
      choices: [{ message: { content: 'Just a plain word translation' } }]
    };

    mockWebFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => sampleResponse,
    } as any);

    const result = await getAIInsight('hello', 'en', 'id', {
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    });

    expect(result.mainTranslation).toBe('Just a plain word translation');
    expect(result.note).toBe('Could not parse structured response');
  });

  it('defends against malformed alternatives structure', async () => {
    vi.spyOn(env, 'isTauriAppPlatform').mockReturnValue(false);
    
    const sampleResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              mainTranslation: 'halo',
              // alternatives array contains a string instead of object
              alternatives: [
                'malformed_string',
                null,
                { translation: 'hai', usage: 'informal', example: 'Hai', confidence: 'medium' }
              ]
            })
          }
        }
      ]
    };

    mockWebFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => sampleResponse,
    } as any);

    const result = await getAIInsight('hello', 'en', 'id', {
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    });

    expect(result.mainTranslation).toBe('halo');
    expect(result.alternatives).toBeDefined();
    expect(result.alternatives?.[0]?.translation).toBe('hai');
  });

  it('supports Tauri platform and calls native httpFetch', async () => {
    vi.spyOn(env, 'isTauriAppPlatform').mockReturnValue(true);

    const sampleResponse = {
      choices: [{ message: { content: JSON.stringify({ mainTranslation: 'native-halo', alternatives: [] }) } }]
    };

    mockTauriFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => sampleResponse,
    } as any);

    const result = await getAIInsight('hello', 'en', 'id', {
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    });

    expect(result.mainTranslation).toBe('native-halo');
    expect(mockTauriFetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to second provider if the first fails', async () => {
    vi.spyOn(env, 'isTauriAppPlatform').mockReturnValue(false);

    // First call fails
    mockWebFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as any);

    // Second call succeeds
    const sampleResponse = {
      choices: [{ message: { content: JSON.stringify({ mainTranslation: 'fallback-halo', alternatives: [] }) } }]
    };
    mockWebFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => sampleResponse,
    } as any);

    const result = await getAIInsight('hello', 'en', 'id', {
      apiKey: 'primary-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      fallbacks: [
        {
          apiKey: 'fallback-key',
          baseUrl: 'https://fallback.api/v1',
          model: 'gpt-4o-mini',
          enabled: true,
        }
      ]
    });

    expect(result.mainTranslation).toBe('fallback-halo');
    expect(mockWebFetch).toHaveBeenCalledTimes(2);
  });

  it('parses generic JSON error structures', async () => {
    vi.spyOn(env, 'isTauriAppPlatform').mockReturnValue(false);

    mockWebFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ msg: 'Quota exceeded' }),
    } as any);

    const promise = getAIInsight('hello', 'en', 'id', {
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    });

    await expect(promise).rejects.toThrow(/Quota exceeded/i);
  });

  it('parses short plain-text error messages', async () => {
    vi.spyOn(env, 'isTauriAppPlatform').mockReturnValue(false);

    mockWebFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      text: async () => 'Bad Gateway from Cloudflare',
    } as any);

    const promise = getAIInsight('hello', 'en', 'id', {
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    });

    await expect(promise).rejects.toThrow(/Bad Gateway from Cloudflare/i);
  });

  it('ignores long HTML error pages and uses fallback HTTP code', async () => {
    vi.spyOn(env, 'isTauriAppPlatform').mockReturnValue(false);

    const longHtml = '<html><body>' + 'a'.repeat(200) + '</body></html>';
    mockWebFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => longHtml,
    } as any);

    const promise = getAIInsight('hello', 'en', 'id', {
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    });

    await expect(promise).rejects.toThrow(/API error \(HTTP 500\)/i);
  });

  it('aborts the request when signal is aborted', async () => {
    vi.spyOn(env, 'isTauriAppPlatform').mockReturnValue(false);

    const controller = new AbortController();
    
    mockWebFetch.mockImplementation(async (_url, options) => {
      const signal = options?.signal;
      if (signal) {
        if (signal.aborted) {
          throw new DOMException('The user aborted a request.', 'AbortError');
        }
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new DOMException('The user aborted a request.', 'AbortError'));
          });
        });
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    const promise = getAIInsight('hello', 'en', 'id', {
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    }, controller.signal);

    controller.abort();

    await expect(promise).rejects.toThrow(/aborted/i);
  });
});
