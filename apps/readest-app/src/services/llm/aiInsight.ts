import { getAPIBaseUrl, isTauriAppPlatform } from '@/services/environment';
import { getAIFetch } from '@/services/ai/utils/httpFetch';

export interface AIInsightAlternative {
  translation: string;
  usage: string;
  example: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface AIInsightResult {
  meaning: string;
  /** @deprecated use `meaning` — kept for backward compat with saved notes */
  mainTranslation: string;
  alternatives: AIInsightAlternative[];
  note?: string;
}

interface AIConfig {
  apiKey: string;
  model?: string;
  baseUrl: string;
  apiPath?: string;
}

function buildReadingInsightPrompt(text: string, sourceLang: string, targetLang: string, context?: string) {
  const contextInstruction = context
    ? `\n- The selected text appears in this context: "${context}". Explain the selected text specifically as it is used in this context.`
    : '';
  const sameLanguageInstruction =
    sourceLang.toLowerCase() === targetLang.toLowerCase()
      ? '\n- Source and target language are the same, so do not translate. Explain the meaning in clearer, reader-friendly language.'
      : '';

  return {
    system: `You are a literary reading assistant helping a reader understand selected text from a book.

For the given input, return ONLY a JSON object with:
- "meaning": the clearest reader-facing explanation. If source and target languages differ, translate it. If they are the same language, explain or paraphrase it in simpler words.
- "alternatives": array of up to 3 objects, each with:
  - "translation": an alternative meaning, nuance, paraphrase, or translation
  - "usage": a short usage label
  - "example": a natural example sentence in ${sourceLang} showing this meaning or usage
  - "confidence": "high" | "medium" | "low"
- "note": optional brief note about nuance, idiom, grammar, register, or cultural context

Rules:
- Write every field except "example" entirely in ${targetLang}.
- Keep "example" in ${sourceLang}.
- Support single words, phrases, idioms, and full sentences.
- For a full sentence, prioritize meaning, tone, and why it may be confusing over listing dictionary-style alternatives.
- If the selected text is an idiom, explain the idiomatic meaning first.
- If it is rare, archaic, slang, or domain-specific, mention that in "note".${contextInstruction}${sameLanguageInstruction}
- Return ONLY the JSON object, no other text`,

    user: `${text} (${sourceLang} -> ${targetLang})`,
  };
}

async function callProvider(
  word: string,
  sourceLang: string,
  targetLang: string,
  config: AIConfig,
  signal: AbortSignal,
  context?: string,
): Promise<AIInsightResult> {
  const { system, user } = buildReadingInsightPrompt(word, sourceLang, targetLang, context);

  const isAnthropic =
    config.baseUrl.includes('api.anthropic.com') ||
    (config.apiPath ?? '').includes('/messages');

  let response: Response;

  if (isTauriAppPlatform()) {
    const httpFetch = getAIFetch();
    const url = `${config.baseUrl.replace(/\/$/, '')}${config.apiPath ?? (isAnthropic ? '/v1/messages' : '/v1/chat/completions')}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    let body: any;

    if (isAnthropic) {
      headers['x-api-key'] = config.apiKey;
      headers['anthropic-version'] = '2023-06-01';
      body = {
        model: config.model || 'claude-3-5-sonnet-latest',
        system,
        messages: [{ role: 'user', content: user }],
        temperature: 0.3,
        max_tokens: 1024,
      };
    } else {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
      headers['HTTP-Referer'] = 'readest';
      headers['X-Title'] = 'Readest AI Insight';
      body = {
        model: config.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      };
    }

    response = await httpFetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });
  } else {
    const url = `${getAPIBaseUrl()}/llm/translate`;
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl.replace(/\/$/, ''),
        apiPath: config.apiPath ?? (isAnthropic ? '/v1/messages' : '/v1/chat/completions'),
        model: config.model || (isAnthropic ? 'claude-3-5-sonnet-latest' : 'gpt-4o-mini'),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.3,
        max_tokens: 1024,
        headers: {
          'HTTP-Referer': 'readest',
          'X-Title': 'Readest AI Insight',
        },
      }),
    });
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('Invalid API key');
    if (response.status === 429) throw new Error('Rate limited');
    
    let errMsg: string | null = null;
    try {
      const text = await response.text();
      try {
        const errData = JSON.parse(text);
        errMsg =
          errData?.error?.message ??
          errData?.error ??
          errData?.message ??
          errData?.msg ??
          null;
      } catch {
        if (text && text.trim().length < 120) {
          errMsg = text.trim();
        }
      }
      if (errMsg) throw new Error(`${errMsg} (HTTP ${response.status})`);
    } catch (e) {
      if (e instanceof Error && e.message.includes('HTTP')) throw e;
    }
    
    throw new Error(`API error (HTTP ${response.status})`);
  }

  const data = await response.json();
  const content =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text ??
    data?.content?.[0]?.text ??
    null;
  if (!content) throw new Error('Empty response from API');

  return parseInsightResponse(content);
}

export async function getAIInsight(
  word: string,
  sourceLang: string,
  targetLang: string,
  llmConfig: AIConfig & { fallbacks?: Array<{ apiKey: string; baseUrl: string; apiPath?: string; model: string; enabled?: boolean }> },
  signal?: AbortSignal,
  context?: string,
): Promise<AIInsightResult> {
  const TIMEOUT_MS = 15_000;
  const configs: AIConfig[] = [
    { apiKey: llmConfig.apiKey, model: llmConfig.model, baseUrl: llmConfig.baseUrl, apiPath: llmConfig.apiPath },
    ...(Array.isArray(llmConfig.fallbacks) ? llmConfig.fallbacks : []).filter((f) => f.enabled !== false).map((f) => ({
      apiKey: f.apiKey,
      model: f.model,
      baseUrl: f.baseUrl,
      apiPath: f.apiPath,
    })),
  ].filter((cfg) => !!cfg.apiKey);

  let lastError: Error | null = null;

  for (const cfg of configs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const abortHandler = () => {
      controller.abort();
    };

    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', abortHandler);
      }
    }

    try {
      const result = await callProvider(word, sourceLang, targetLang, cfg, controller.signal, context);
      clearTimeout(timeout);
      if (signal) {
        signal.removeEventListener('abort', abortHandler);
      }
      return result;
    } catch (err) {
      clearTimeout(timeout);
      if (signal) {
        signal.removeEventListener('abort', abortHandler);
      }
      lastError = err as Error;
      if (signal?.aborted) {
        throw err;
      }
    }
  }

  throw lastError ?? new Error('All providers failed');
}

function parseInsightResponse(raw: string): AIInsightResult {
  let cleaned = raw.trim();

  // 1. Try to extract JSON from markdown code blocks
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = codeBlockRegex.exec(cleaned);
  if (match && match[1]) {
    cleaned = match[1].trim();
  } else {
    // 2. Fallback: extract only the outer-most curly braces
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      cleaned = cleaned.slice(start, end + 1);
    }
  }

  try {
    const parsed = JSON.parse(cleaned);

    const rawMeaning = parsed.meaning ?? parsed.mainTranslation;
    if (!rawMeaning || !Array.isArray(parsed.alternatives)) {
      throw new Error('Invalid response structure');
    }

    const meaning = String(rawMeaning);
    return {
      meaning,
      mainTranslation: meaning,
      alternatives: parsed.alternatives
        .filter((alt: any) => alt && typeof alt === 'object')
        .slice(0, 6)
        .map(
          (alt: Record<string, unknown>): AIInsightAlternative => ({
            translation: String(alt['translation'] ?? ''),
            usage: String(alt['usage'] ?? ''),
            example: String(alt['example'] ?? ''),
            confidence: (['high', 'medium', 'low'].includes(String(alt['confidence']))
              ? String(alt['confidence'])
              : 'medium') as AIInsightAlternative['confidence'],
          }),
        ),
      note: parsed.note ? String(parsed.note) : undefined,
    };
  } catch {
    return {
      meaning: cleaned,
      mainTranslation: cleaned,
      alternatives: [],
      note: 'Could not parse structured response',
    };
  }
}
