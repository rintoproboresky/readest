export interface WordInsightAlternative {
  translation: string;
  usage: string;
  example: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface WordInsightResult {
  mainTranslation: string;
  alternatives: WordInsightAlternative[];
  note?: string;
}

interface LLMTranslationConfig {
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

export async function getWordInsight(
  word: string,
  sourceLang: string,
  targetLang: string,
  llmConfig: LLMTranslationConfig,
): Promise<WordInsightResult> {
  const TIMEOUT_MS = 15_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const { system, user } = buildWordInsightPrompt(word, sourceLang, targetLang);

  try {
    const response = await fetch('/api/llm/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        apiKey: llmConfig.apiKey,
        baseUrl: llmConfig.baseUrl.replace(/\/$/, ''),
        apiPath: llmConfig.apiPath ?? '/v1/chat/completions',
        model: llmConfig.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.3,
        max_tokens: 512,
        headers: {
          'HTTP-Referer': 'readest',
          'X-Title': 'Readest LLM Word Insight',
        },
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid API key');
      }
      if (response.status === 429) {
        throw new Error('Rate limited');
      }
      throw new Error(`API error (HTTP ${response.status})`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? null;

    if (!content) {
      throw new Error('Empty response from API');
    }

    return parseInsightResponse(content);
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw err;
  }
}

function parseInsightResponse(raw: string): WordInsightResult {
  let cleaned = raw.trim();

  if (cleaned.startsWith('```')) {
    const end = cleaned.indexOf('```', 3);
    if (end !== -1) {
      cleaned = cleaned.slice(cleaned.indexOf('\n', 3) + 1, end).trim();
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
        (alt: Record<string, unknown>): WordInsightAlternative => ({
          translation: String(alt['translation'] ?? ''),
          usage: String(alt['usage'] ?? ''),
          example: String(alt['example'] ?? ''),
          confidence: (['high', 'medium', 'low'].includes(String(alt['confidence']))
            ? String(alt['confidence'])
            : 'medium') as WordInsightAlternative['confidence'],
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
