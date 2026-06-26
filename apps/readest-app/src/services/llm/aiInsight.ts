import { getAPIBaseUrl, isTauriAppPlatform } from '@/services/environment';
import { getAIFetch } from '@/services/ai/utils/httpFetch';

export interface AIInsightAlternative {
  translation: string;
  usage: string;
  example: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface AIInsightResult {
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

function buildWordInsightPrompt(word: string, sourceLang: string, targetLang: string) {
  return {
    system: `You are a literary assistant helping a reader understand a word or short phrase.

For the given input, return ONLY a JSON object with:
- "mainTranslation": the most likely translation in a general reading context
- "alternatives": array of 2-4 objects, each with:
  - "translation": the alternative translation
  - "usage": a usage label (e.g. "financial", "geography", "idiom", "formal", "slang", "technical")
  - "example": a natural example sentence in ${sourceLang} showing this usage
  - "confidence": "high" | "medium" | "low"
- "note": optional brief usage note (cultural context, register, etc.)

Rules:
- If the input is a phrase, translate it as a unit and note any idiomatic meaning
- Examples must be natural, not constructed
- If the word is rare or archaic, note it
- Return ONLY the JSON object, no other text`,

    user: `${word} (${sourceLang} → ${targetLang})`,
  };
}

async function callProvider(
  word: string,
  sourceLang: string,
  targetLang: string,
  config: AIConfig,
  signal: AbortSignal,
): Promise<AIInsightResult> {
  const { system, user } = buildWordInsightPrompt(word, sourceLang, targetLang);

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
        max_tokens: 512,
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
        max_tokens: 512,
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
        max_tokens: 512,
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
    
    try {
      const errData = await response.json();
      const errMsg = errData?.error?.message ?? errData?.error ?? null;
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
): Promise<AIInsightResult> {
  const TIMEOUT_MS = 15_000;
  const configs: AIConfig[] = [
    { apiKey: llmConfig.apiKey, model: llmConfig.model, baseUrl: llmConfig.baseUrl, apiPath: llmConfig.apiPath },
    ...(llmConfig.fallbacks ?? []).filter((f) => f.enabled !== false).map((f) => ({
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

    try {
      const result = await callProvider(word, sourceLang, targetLang, cfg, controller.signal);
      clearTimeout(timeout);
      return result;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err as Error;
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

    if (!parsed.mainTranslation || !Array.isArray(parsed.alternatives)) {
      throw new Error('Invalid response structure');
    }

    return {
      mainTranslation: String(parsed.mainTranslation),
      alternatives: parsed.alternatives.slice(0, 6).map(
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
      mainTranslation: cleaned,
      alternatives: [],
      note: 'Could not parse structured response',
    };
  }
}
