import { TranslationProvider } from '../types';

export const PROMPT_VERSION = 'v2';

export const DEFAULT_LLM_SYSTEM_PROMPT =
  'You are a translator. Translate text to {targetLang} naturally.';

export interface LLMConfig {
  provider: 'openrouter' | 'openai' | 'google-ai-studio' | 'custom';
  apiKey: string;
  baseUrl: string;
  apiPath?: string;
  model: string;
  systemPrompt?: string;
}

let _config: LLMConfig | null = null;

export function configureLLM(cfg: LLMConfig | null) {
  _config = cfg;
}

export function getLLMConfig(): LLMConfig | null {
  return _config;
}

export function resetLLMConfig() {
  _config = null;
}

function fillPrompt(template: string, text: string, targetLang: string): string {
  return template.replace(/\{text\}/g, text).replace(/\{targetLang\}/g, targetLang);
}

function buildPrompt(text: string, targetLang: string): string {
  const cfg = _config;
  if (cfg?.systemPrompt) {
    return fillPrompt(cfg.systemPrompt, text, targetLang);
  }
  return [
    `Translate the following text to ${targetLang} naturally.`,
    'Rules:',
    '- Preserve meaning, tone, and nuance',
    '- Keep names unchanged',
    '- If the input is a short word or phrase, return a natural translation only',
    '- If idiom or slang, prioritize contextual meaning over literal translation',
    '- Do not add explanations, notes, or quotations',
    '- Return ONLY the translated text',
    '',
    'INPUT TEXT:',
    text,
  ].join('\n');
}

const pendingRequests = new Map<string, Promise<string>>();

async function translateBatch(
  texts: string[],
  _sourceLang: string,
  targetLang: string,
): Promise<string[]> {
  const cfg = _config;
  if (!cfg || !cfg.apiKey) {
    throw new Error(
      'LLM Translation: API key not configured. Go to Settings to set up LLM translation.',
    );
  }

  const model = cfg.model || 'gpt-4o-mini';

  return Promise.all(
    texts.map(async (text) => {
      if (!text?.trim()) return text;

      const dedupKey = `${model}:${targetLang}:${text}`;
      const pending = pendingRequests.get(dedupKey);
      if (pending) return pending;

      const promise = (async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
          const systemContent = cfg.systemPrompt
            ? fillPrompt(cfg.systemPrompt, text, targetLang)
            : `You are a translator. Translate text to ${targetLang} naturally.`;

          const messages = [
            {
              role: 'system',
              content: systemContent,
            },
            {
              role: 'user',
              content: buildPrompt(text, targetLang),
            },
          ];

          const response = await fetch('/api/llm/translate', {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: cfg.apiKey,
              baseUrl: cfg.baseUrl.replace(/\/$/, ''),
              apiPath: cfg.apiPath,
              model,
              messages,
              temperature: 0.3,
              max_tokens: 64,
              headers: {
                'HTTP-Referer': 'readest',
                'X-Title': 'Readest LLM Translator',
              },
            }),
          });

          if (!response.ok) {
            const status = response.status;
            if (status === 401 || status === 403) {
              throw new Error('LLM Translation: Invalid API key (unauthorized)');
            }
            if (status === 429) {
              throw new Error('LLM Translation: Rate limited. Please wait and try again.');
            }
            throw new Error(`LLM Translation: API error (HTTP ${status})`);
          }

          const data = await response.json();
          const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? null;

          if (!content) {
            throw new Error('LLM Translation: Invalid response format from API');
          }

          return content.trim();
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            throw new Error('LLM Translation: Request timed out after 15s');
          }
          throw err;
        } finally {
          clearTimeout(timeoutId);
          pendingRequests.delete(dedupKey);
        }
      })();

      pendingRequests.set(dedupKey, promise);
      return promise;
    }),
  );
}

export const llmProvider: TranslationProvider = {
  name: 'llm',
  label: 'LLM (AI)',
  authRequired: false,
  disabled: false,
  translate: async (texts: string[], sourceLang: string, targetLang: string): Promise<string[]> => {
    if (!texts.length) return [];
    return translateBatch(texts, sourceLang, targetLang);
  },
};
