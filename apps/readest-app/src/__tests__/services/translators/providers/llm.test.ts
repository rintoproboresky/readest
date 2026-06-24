import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const validConfig = {
  provider: 'openrouter' as const,
  apiKey: 'sk-or-v1-test-key',
  baseUrl: 'https://openrouter.ai/api/v1',
  apiPath: '/chat/completions',
  model: 'gpt-4o-mini',
};

// ---------------------------------------------------------------------------
// LLM Translation Provider
// ---------------------------------------------------------------------------
describe('llmProvider', () => {
  beforeEach(async () => {
    const { resetLLMConfig } = await import('@/services/translators/providers/llm');
    resetLLMConfig();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty array for empty input', async () => {
    const { llmProvider } = await import('@/services/translators/providers/llm');
    const result = await llmProvider.translate([], 'en', 'fr');
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('preserves empty strings in array', async () => {
    const { llmProvider, configureLLM } = await import('@/services/translators/providers/llm');
    configureLLM(validConfig);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'bonjour' } }],
        }),
    });
    const result = await llmProvider.translate(['hello', '', 'world'], 'en', 'fr');
    expect(result[0]).toBe('bonjour');
    expect(result[1]).toBe('');
    expect(result[2]).toBeTruthy();
  });

  it('throws if API key not configured', async () => {
    const { llmProvider, configureLLM } = await import('@/services/translators/providers/llm');
    configureLLM(null);
    await expect(llmProvider.translate(['hello'], 'en', 'fr')).rejects.toThrow(
      'API key not configured',
    );
  });

  it('throws if config is missing apiKey', async () => {
    const { llmProvider, configureLLM } = await import('@/services/translators/providers/llm');
    configureLLM({ ...validConfig, apiKey: '' });
    await expect(llmProvider.translate(['hello'], 'en', 'fr')).rejects.toThrow(
      'API key not configured',
    );
  });

  it('translates text via proxy API', async () => {
    const { llmProvider, configureLLM } = await import('@/services/translators/providers/llm');
    configureLLM(validConfig);

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Bonjour' } }],
        }),
    });

    const result = await llmProvider.translate(['Hello'], 'en', 'fr');

    expect(result[0]).toBe('Bonjour');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const callUrl = mockFetch.mock.calls[0][0];
    expect(callUrl).toBe('/api/llm/translate');

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.apiKey).toBe('sk-or-v1-test-key');
    expect(callBody.baseUrl).toBe('https://openrouter.ai/api/v1');
    expect(callBody.apiPath).toBe('/chat/completions');
    expect(callBody.model).toBe('gpt-4o-mini');
    expect(callBody.messages).toHaveLength(2);
    expect(callBody.messages[1].role).toBe('user');
    expect(callBody.messages[1].content).toContain('Hello');
    expect(callBody.messages[1].content).toContain('fr');
    expect(callBody.headers['HTTP-Referer']).toBe('readest');
    expect(callBody.headers['X-Title']).toBe('Readest LLM Translator');

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('sends batch texts in parallel', async () => {
    const { llmProvider, configureLLM } = await import('@/services/translators/providers/llm');
    configureLLM(validConfig);

    let callCount = 0;
    mockFetch.mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: `translation-${callCount}` } }],
          }),
      });
    });

    const result = await llmProvider.translate(['hello', 'world'], 'en', 'fr');
    expect(result).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws on HTTP 401', async () => {
    const { llmProvider, configureLLM } = await import('@/services/translators/providers/llm');
    configureLLM(validConfig);

    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
    });

    await expect(llmProvider.translate(['hello'], 'en', 'fr')).rejects.toThrow('Invalid API key');
  });

  it('throws on HTTP 403', async () => {
    const { llmProvider, configureLLM } = await import('@/services/translators/providers/llm');
    configureLLM(validConfig);

    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
    });

    await expect(llmProvider.translate(['hello'], 'en', 'fr')).rejects.toThrow('Invalid API key');
  });

  it('throws on HTTP 429 (rate limit)', async () => {
    const { llmProvider, configureLLM } = await import('@/services/translators/providers/llm');
    configureLLM(validConfig);

    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
    });

    await expect(llmProvider.translate(['hello'], 'en', 'fr')).rejects.toThrow('Rate limited');
  });

  it('throws on generic HTTP error', async () => {
    const { llmProvider, configureLLM } = await import('@/services/translators/providers/llm');
    configureLLM(validConfig);

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(llmProvider.translate(['hello'], 'en', 'fr')).rejects.toThrow(
      'API error (HTTP 500)',
    );
  });

  it('throws on network failure', async () => {
    const { llmProvider, configureLLM } = await import('@/services/translators/providers/llm');
    configureLLM(validConfig);

    mockFetch.mockRejectedValue(new Error('Network error'));

    await expect(llmProvider.translate(['hello'], 'en', 'fr')).rejects.toThrow('Network error');
  });

  it('throws on invalid response format (missing choices)', async () => {
    const { llmProvider, configureLLM } = await import('@/services/translators/providers/llm');
    configureLLM(validConfig);

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await expect(llmProvider.translate(['hello'], 'en', 'fr')).rejects.toThrow(
      'Invalid response format',
    );
  });

  it('throws on empty choices array', async () => {
    const { llmProvider, configureLLM } = await import('@/services/translators/providers/llm');
    configureLLM(validConfig);

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [] }),
    });

    await expect(llmProvider.translate(['hello'], 'en', 'fr')).rejects.toThrow(
      'Invalid response format',
    );
  });

  it('throws on AbortError (timeout)', async () => {
    const { llmProvider, configureLLM } = await import('@/services/translators/providers/llm');
    configureLLM(validConfig);

    const abortError = new DOMException('The operation was aborted', 'AbortError');
    mockFetch.mockRejectedValue(abortError);

    await expect(llmProvider.translate(['hello'], 'en', 'fr')).rejects.toThrow(
      'Request timed out after 15s',
    );
  });

  it('handles choices[0].text fallback format', async () => {
    const { llmProvider, configureLLM } = await import('@/services/translators/providers/llm');
    configureLLM(validConfig);

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ text: 'Bonjour' }],
        }),
    });

    const result = await llmProvider.translate(['Hello'], 'en', 'fr');
    expect(result[0]).toBe('Bonjour');
  });

  it('trims whitespace from translation', async () => {
    const { llmProvider, configureLLM } = await import('@/services/translators/providers/llm');
    configureLLM(validConfig);

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: '  Bonjour  ' } }],
        }),
    });

    const result = await llmProvider.translate(['Hello'], 'en', 'fr');
    expect(result[0]).toBe('Bonjour');
  });

  it('strips trailing slash from baseUrl', async () => {
    const { llmProvider, configureLLM } = await import('@/services/translators/providers/llm');
    configureLLM({ ...validConfig, baseUrl: 'https://openrouter.ai/api/v1/' });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Bonjour' } }],
        }),
    });

    await llmProvider.translate(['Hello'], 'en', 'fr');
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.baseUrl).toBe('https://openrouter.ai/api/v1');
  });

  it('uses default model when model is empty', async () => {
    const { llmProvider, configureLLM } = await import('@/services/translators/providers/llm');
    configureLLM({ ...validConfig, model: '' });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Bonjour' } }],
        }),
    });

    await llmProvider.translate(['Hello'], 'en', 'fr');
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.model).toBe('gpt-4o-mini');
  });

  it('uses configured model when set', async () => {
    const { llmProvider, configureLLM } = await import('@/services/translators/providers/llm');
    configureLLM({ ...validConfig, model: 'claude-3-haiku' });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Bonjour' } }],
        }),
    });

    await llmProvider.translate(['Hello'], 'en', 'fr');
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.model).toBe('claude-3-haiku');
  });
});

// ---------------------------------------------------------------------------
// configureLLM / getLLMConfig lifecycle
// ---------------------------------------------------------------------------
describe('LLM config lifecycle', () => {
  beforeEach(async () => {
    const { resetLLMConfig } = await import('@/services/translators/providers/llm');
    resetLLMConfig();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('configureLLM stores and getLLMConfig retrieves config', async () => {
    const { configureLLM, getLLMConfig } = await import('@/services/translators/providers/llm');
    expect(getLLMConfig()).toBeNull();

    configureLLM(validConfig);
    expect(getLLMConfig()).toEqual(validConfig);

    configureLLM(null);
    expect(getLLMConfig()).toBeNull();
  });

  it('getLLMConfig returns null before any configureLLM call', async () => {
    const { getLLMConfig } = await import('@/services/translators/providers/llm');
    expect(getLLMConfig()).toBeNull();
  });

  it('configureLLM overwrites previous config', async () => {
    const { configureLLM, getLLMConfig } = await import('@/services/translators/providers/llm');
    configureLLM(validConfig);
    configureLLM({ ...validConfig, apiKey: 'new-key' });
    expect(getLLMConfig()?.apiKey).toBe('new-key');
  });
});

// ---------------------------------------------------------------------------
// Provider metadata (matches TranslationProvider interface)
// ---------------------------------------------------------------------------
describe('llmProvider metadata', () => {
  it('has correct name and label', async () => {
    const { llmProvider } = await import('@/services/translators/providers/llm');
    expect(llmProvider.name).toBe('llm');
    expect(llmProvider.label).toBe('LLM (AI)');
  });

  it('does not require auth token', async () => {
    const { llmProvider } = await import('@/services/translators/providers/llm');
    expect(llmProvider.authRequired).toBe(false);
  });

  it('is not disabled by default', async () => {
    const { llmProvider } = await import('@/services/translators/providers/llm');
    expect(llmProvider.disabled).toBe(false);
  });
});
