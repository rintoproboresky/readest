import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { useEnv } from '@/context/EnvContext';
import { eventDispatcher } from '@/utils/event';
import { isTauriAppPlatform } from '@/services/environment';
import { TRANSLATOR_LANGS } from '@/services/constants';
import { BoxedList, SettingLabel, SettingsRow } from '../primitives';
import { PiTrash, PiPlus } from 'react-icons/pi';

type LLMProvider = 'openrouter' | 'openai' | 'google-ai-studio' | 'groq' | 'mistral' | 'anthropic' | 'deepseek' | 'moonshot' | 'xiaomi' | 'z-ai' | 'custom';

interface FallbackEntry {
  provider: LLMProvider;
  apiKey: string;
  apiPath: string;
  baseUrl: string;
  model: string;
  enabled?: boolean;
}
type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

interface TestResult {
  label: string;
  status: ConnectionStatus;
  message?: string;
}

const AIInsightPanel: React.FC = () => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { settings, setSettings, saveSettings } = useSettingsStore();

  const llmCfg = settings?.aiSettings?.llm;
  const [provider, setProvider] = useState(llmCfg?.provider ?? 'openrouter');
  const [apiKey, setApiKey] = useState(llmCfg?.apiKey ?? '');
  const [baseUrl, setBaseUrl] = useState(llmCfg?.baseUrl ?? 'https://openrouter.ai/api/v1');
  const [apiPath, setApiPath] = useState(llmCfg?.apiPath ?? '/chat/completions');
  const [model, setModel] = useState(llmCfg?.model ?? '');
  const [insightTargetLang, setInsightTargetLang] = useState(llmCfg?.targetLang ?? '');
  const [fallbacks, setFallbacks] = useState<FallbackEntry[]>(() => (llmCfg?.fallbacks ?? []).map((f) => ({
    provider: (f.provider as LLMProvider) || 'openai',
    apiKey: f.apiKey ?? '',
    baseUrl: f.baseUrl ?? '',
    apiPath: f.apiPath ?? '/chat/completions',
    model: f.model ?? '',
    enabled: f.enabled ?? true,
  })));
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  const syncedFromStore = useRef(false);

  useEffect(() => {
    if (!llmCfg) return;
    if (syncedFromStore.current) return;
    syncedFromStore.current = true;
    if (llmCfg.provider) setProvider(llmCfg.provider as LLMProvider);
    setApiKey(llmCfg.apiKey ?? '');
    setBaseUrl(llmCfg.baseUrl ?? 'https://openrouter.ai/api/v1');
    setApiPath(llmCfg.apiPath ?? '/chat/completions');
    setModel(llmCfg.model ?? '');
    setInsightTargetLang(llmCfg.targetLang ?? '');
    if (llmCfg.fallbacks) {
      setFallbacks(llmCfg.fallbacks.map((f) => ({
        provider: (f.provider as LLMProvider) || 'openai',
        apiKey: f.apiKey ?? '',
        baseUrl: f.baseUrl ?? '',
        apiPath: f.apiPath ?? '/chat/completions',
        model: f.model ?? '',
        enabled: f.enabled ?? true,
      })));
    }
  }, [llmCfg]);

  const providerDefaults: Record<string, { baseUrl: string; apiPath: string; model: string }> = {
    openrouter: { baseUrl: 'https://openrouter.ai/api/v1', apiPath: '/chat/completions', model: '' },
    openai: { baseUrl: 'https://api.openai.com/v1', apiPath: '/chat/completions', model: 'gpt-4o-mini' },
    'google-ai-studio': {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      apiPath: '/chat/completions',
      model: 'gemini-3.1-flash-lite',
    },
    groq: {
      baseUrl: 'https://api.groq.com/openai/v1',
      apiPath: '/chat/completions',
      model: 'llama-3.3-70b-versatile',
    },
    mistral: {
      baseUrl: 'https://api.mistral.ai/v1',
      apiPath: '/chat/completions',
      model: 'mistral-large-latest',
    },
    anthropic: {
      baseUrl: 'https://api.anthropic.com/v1',
      apiPath: '/messages',
      model: 'claude-sonnet-4-6',
    },
    moonshot: {
      baseUrl: 'https://api.moonshot.ai/v1',
      apiPath: '/chat/completions',
      model: 'kimi-k2.6',
    },
    deepseek: {
      baseUrl: 'https://api.deepseek.com',
      apiPath: '/chat/completions',
      model: 'deepseek-v4-flash',
    },
    xiaomi: {
      baseUrl: 'https://api.xiaomimimo.com/v1',
      apiPath: '/chat/completions',
      model: 'mimo-v2.5-pro',
    },
    'z-ai': {
      baseUrl: 'https://api.z.ai/api/paas/v4',
      apiPath: '/chat/completions',
      model: 'glm-5.2',
    },
  };

  const handleProviderChange = (value: string) => {
    setProvider(value as LLMProvider);
    setApiKey('');
    const preset = providerDefaults[value];
    if (preset) {
      setBaseUrl(preset.baseUrl);
      setApiPath(preset.apiPath);
      if (preset.model) setModel(preset.model);
    }
  };

  const handleAddFallback = () => {
    setFallbacks((prev) => [
      ...prev,
      { provider: 'openai', apiKey: '', baseUrl: '', apiPath: '/chat/completions', model: '', enabled: true },
    ]);
  };

  const handleRemoveFallback = (index: number) => {
    setFallbacks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFallbackProviderChange = (index: number, value: string) => {
    setFallbacks((prev) => {
      const next = [...prev];
      const entry = next[index]!;
      entry.provider = value as LLMProvider;
      entry.apiKey = '';
      const preset = providerDefaults[value];
      if (preset) {
        entry.baseUrl = preset.baseUrl;
        entry.apiPath = preset.apiPath;
        if (preset.model) entry.model = preset.model;
      }
      return next;
    });
  };

  const handleFallbackChange = (index: number, field: keyof FallbackEntry, value: string | boolean) => {
    setFallbacks((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index]!, [field]: value } as FallbackEntry;
      }
      return next;
    });
  };

  const buildLlmConfig = useCallback(() => ({
    provider: provider as LLMProvider,
    apiKey,
    baseUrl,
    apiPath,
    model,
    targetLang: insightTargetLang,
    fallbacks: fallbacks.map((f) => ({
      provider: f.provider,
      apiKey: f.apiKey,
      baseUrl: f.baseUrl,
      apiPath: f.apiPath,
      model: f.model,
      enabled: f.enabled ?? true,
    })),
  }), [provider, apiKey, baseUrl, apiPath, model, insightTargetLang, fallbacks]);

  useEffect(() => {
    if (!settings.aiSettings) return;
    if (!syncedFromStore.current) return;
    const updated = { ...settings };
    updated.aiSettings = {
      ...updated.aiSettings,
      llm: buildLlmConfig(),
    };
    setSettings(updated);
  }, [provider, apiKey, baseUrl, apiPath, model, insightTargetLang, fallbacks, buildLlmConfig]);

  const handleSave = async () => {
    const updated = { ...settings };
    updated.aiSettings = {
      ...updated.aiSettings,
      llm: buildLlmConfig(),
    };
    setSettings(updated);
    await saveSettings(envConfig, updated);
    eventDispatcher.dispatch('toast', { type: 'success', message: _('AI Insight configuration saved') });
  };

  const testSingleProvider = async (
    label: string,
    config: { apiKey: string; baseUrl: string; apiPath?: string; model?: string },
  ): Promise<TestResult> => {
    const TIMEOUT_MS = 15_000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const testPayload = {
        apiKey: config.apiKey,
        baseUrl: config.baseUrl.replace(/\/$/, ''),
        apiPath: config.apiPath ?? '/v1/chat/completions',
        model: config.model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Translate hello to French.' }],
        max_tokens: 32,
        headers: {
          'HTTP-Referer': 'readest',
          'X-Title': 'Readest AI Insight',
        },
      };

      const url = isTauriAppPlatform()
        ? `${config.baseUrl.replace(/\/$/, '')}${config.apiPath ?? '/v1/chat/completions'}`
        : '/api/llm/translate';

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new Error(_('Invalid API key'));
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error(_('Unexpected response format'));

      return { label, status: 'success' };
    } catch (err) {
      clearTimeout(timeout);
      return { label, status: 'error', message: (err as Error).message || _('Connection failed') };
    }
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setErrorMessage('');

    const providers: { label: string; apiKey: string; baseUrl: string; apiPath?: string; model?: string }[] = [
      { label: model || 'gpt-4o-mini', apiKey, baseUrl, apiPath, model },
      ...fallbacks.filter((fb) => fb.enabled !== false).map((fb, i) => ({
        label: `${_('Fallback')} ${i + 1}: ${fb.model || 'gpt-4o-mini'}`,
        apiKey: fb.apiKey,
        baseUrl: fb.baseUrl,
        apiPath: fb.apiPath,
        model: fb.model,
      })),
    ].filter((p) => p.apiKey);

    setTestResults(providers.map((p) => ({ label: p.label, status: 'testing' as ConnectionStatus })));

    let anySuccess = false;
    for (const provider of providers) {
      const result = await testSingleProvider(provider.label, provider);
      setTestResults((prev) => prev.map((r) => (r.label === result.label ? result : r)));
      if (result.status === 'success') anySuccess = true;
    }

    setConnectionStatus(anySuccess ? 'success' : 'error');
    if (!anySuccess) setErrorMessage(_('All providers failed'));
  };

  return (
    <BoxedList title={_('AI Insight')}>
      <SettingsRow label={_('Provider')} asLabel>
        <select
          className='select select-bordered select-sm bg-base-100 text-base-content'
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value)}
        >
          <option value='openrouter'>OpenRouter</option>
          <option value='openai'>OpenAI</option>
          <option value='google-ai-studio'>Google AI Studio</option>
          <option value='groq'>Groq</option>
          <option value='mistral'>Mistral</option>
          <option value='anthropic'>Anthropic</option>
          <option value='moonshot'>Moonshot</option>
          <option value='deepseek'>DeepSeek</option>
          <option value='xiaomi'>Xiaomi MiMo</option>
          <option value='z-ai'>Z.AI</option>
          <option value='custom'>{_('Custom')}</option>
        </select>
      </SettingsRow>

      <div className='flex flex-col gap-2 py-3 pe-4'>
        <SettingLabel>{_('API Key')}</SettingLabel>
        <input
          type='password'
          className='input input-bordered input-sm w-full'
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder='sk-...'
          autoComplete='off'
        />
      </div>

      <div className='flex flex-col gap-2 py-3 pe-4'>
        <SettingLabel>{_('Base URL')}</SettingLabel>
        <input
          type='text'
          className='input input-bordered input-sm w-full'
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder='https://openrouter.ai/api/v1'
        />
      </div>

      <div className='flex flex-col gap-2 py-3 pe-4'>
        <SettingLabel>{_('API Path')}</SettingLabel>
        <input
          type='text'
          className='input input-bordered input-sm w-full'
          value={apiPath}
          onChange={(e) => setApiPath(e.target.value)}
          placeholder='/v1/chat/completions'
        />
      </div>

      <SettingsRow label={_('Target Language')} asLabel>
        <select
          className='select select-bordered select-sm bg-base-100 text-base-content'
          value={insightTargetLang}
          onChange={(e) => setInsightTargetLang(e.target.value)}
        >
          <option value=''>{_('Auto (from system language)')}</option>
          {Object.entries(TRANSLATOR_LANGS).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </SettingsRow>

      <div className='flex flex-col gap-2 py-3 pe-4'>
        <SettingLabel>{_('Model')}</SettingLabel>
        {provider === 'google-ai-studio' && (
          <p className='text-xs opacity-60 mb-1'>
            {_('Use full model name, e.g.')} gemini-3.5-flash, gemini-3.1-flash-lite
          </p>
        )}
        <input
          type='text'
          className='input input-bordered input-sm w-full'
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder='gpt-4o-mini'
        />
      </div>

      {/* Fallback Providers */}
      <div className='border-t border-base-200 pt-3'>
        <div className='mb-2 flex items-center justify-between px-4'>
          <span className='text-xs font-semibold text-base-content/70'>
            {_('Fallback Providers')} ({fallbacks.length})
          </span>
          <button className='btn btn-ghost btn-xs gap-1' onClick={handleAddFallback}>
            <PiPlus className='text-sm' />
            {_('Add')}
          </button>
        </div>
        {fallbacks.length > 0 && (
          <div className='flex flex-col gap-2 px-4 pb-2'>
            {fallbacks.map((fb, i) => (
              <div key={i} className={`rounded-md border p-2 ${fb.enabled === false ? 'border-base-200/40 bg-base-100/20 opacity-50' : 'border-base-200 bg-base-100/50'}`}>
                <div className='mb-1.5 flex items-center justify-between'>
                  <label className='flex items-center gap-1.5 cursor-pointer'>
                    <input
                      type='checkbox'
                      className='checkbox checkbox-xs'
                      checked={fb.enabled !== false}
                      onChange={(e) => handleFallbackChange(i, 'enabled', e.target.checked)}
                    />
                    <span className='text-[10px] font-medium text-base-content/50'>
                      {_('Fallback')} #{i + 1}
                    </span>
                  </label>
                  <button className='btn btn-ghost btn-xs text-error' onClick={() => handleRemoveFallback(i)}>
                    <PiTrash className='text-sm' />
                  </button>
                </div>
                <div className='flex flex-col gap-1.5'>
                  <select
                    className='select select-bordered select-xs bg-base-100 text-xs text-base-content'
                    value={fb.provider}
                    onChange={(e) => handleFallbackProviderChange(i, e.target.value)}
                  >
                    <option value='openrouter'>OpenRouter</option>
                    <option value='openai'>OpenAI</option>
                    <option value='google-ai-studio'>Google AI Studio</option>
                    <option value='groq'>Groq</option>
                    <option value='mistral'>Mistral</option>
                    <option value='anthropic'>Anthropic</option>
                    <option value='deepseek'>DeepSeek</option>
                    <option value='moonshot'>Moonshot</option>
                    <option value='xiaomi'>Xiaomi MiMo</option>
                    <option value='z-ai'>Z.AI</option>
                    <option value='custom'>{_('Custom')}</option>
                  </select>
                  <div className='flex gap-1.5'>
                    <input
                      type='password'
                      className='input input-bordered input-xs flex-1 text-xs'
                      value={fb.apiKey}
                      onChange={(e) => handleFallbackChange(i, 'apiKey', e.target.value)}
                      placeholder='sk-...'
                      autoComplete='off'
                    />
                    <input
                      type='text'
                      className='input input-bordered input-xs w-1/2 text-xs'
                      value={fb.model}
                      onChange={(e) => handleFallbackChange(i, 'model', e.target.value)}
                      placeholder='model'
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SettingsRow label={''}>
        <div className='flex flex-col gap-2'>
          <div className='flex items-center gap-2'>
            <button
              className='btn btn-outline btn-sm'
              onClick={handleTestConnection}
              disabled={connectionStatus === 'testing' || !apiKey}
            >
              {connectionStatus === 'testing' ? _('Testing...') : _('Test Connection')}
            </button>
            <button className='btn btn-primary btn-sm' onClick={handleSave}>
              {_('Save')}
            </button>
            {connectionStatus === 'success' && (
              <span className='text-success text-sm'>{_('Connected')}</span>
            )}
            {connectionStatus === 'error' && (
              <span className='text-error text-sm'>{errorMessage}</span>
            )}
          </div>
          {testResults.length > 0 && (
            <div className='flex flex-col gap-1'>
              {testResults.map((r, i) => (
                <div key={i} className='flex items-center gap-2 text-xs'>
                  <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                    r.status === 'success' ? 'bg-success' : r.status === 'error' ? 'bg-error' : 'bg-warning'
                  }`} />
                  <span className='text-base-content/70'>{r.label}</span>
                  {r.status === 'success' && <span className='text-success'>{_('OK')}</span>}
                  {r.status === 'error' && <span className='text-error'>{r.message}</span>}
                  {r.status === 'testing' && <span className='text-warning'>{_('Testing...')}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </SettingsRow>
    </BoxedList>
  );
};

export default AIInsightPanel;
