import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { useEnv } from '@/context/EnvContext';
import { eventDispatcher } from '@/utils/event';
import { isTauriAppPlatform } from '@/services/environment';
import { BoxedList, SettingLabel, SettingsRow } from '../primitives';
import type { LLMConfig } from '@/services/translators/providers/llm';
import { DEFAULT_LLM_SYSTEM_PROMPT } from '@/services/translators/providers/llm';

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

const LLMTranslationPanel: React.FC = () => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { settings, setSettings, saveSettings } = useSettingsStore();

  const llmCfg = settings?.aiSettings?.llm;
  const [provider, setProvider] = useState(llmCfg?.provider ?? 'openrouter');
  const [apiKey, setApiKey] = useState(llmCfg?.apiKey ?? '');
  const [baseUrl, setBaseUrl] = useState(llmCfg?.baseUrl ?? 'https://openrouter.ai/api/v1');
  const [apiPath, setApiPath] = useState(llmCfg?.apiPath ?? '/chat/completions');
  const [model, setModel] = useState(llmCfg?.model ?? '');
  const [systemPrompt, setSystemPrompt] = useState(llmCfg?.systemPrompt ?? '');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleResetPrompt = () => {
    setSystemPrompt('');
  };

  const providerDefaults: Record<string, { baseUrl: string; apiPath: string; model: string }> = {
    openrouter: { baseUrl: 'https://openrouter.ai/api/v1', apiPath: '/chat/completions', model: '' },
    openai: { baseUrl: 'https://api.openai.com/v1', apiPath: '/chat/completions', model: 'gpt-4o-mini' },
    'google-ai-studio': {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      apiPath: '/chat/completions',
      model: 'gemini-3.1-flash-lite',
    },
  };

  const handleProviderChange = (value: string) => {
    setProvider(value as LLMConfig['provider']);
    const preset = providerDefaults[value];
    if (preset) {
      setBaseUrl(preset.baseUrl);
      setApiPath(preset.apiPath);
      if (preset.model) setModel(preset.model);
    }
  };

  useEffect(() => {
    if (!settings.aiSettings) return;
    const updated = { ...settings };
    updated.aiSettings = {
      ...updated.aiSettings,
      llm: {
        provider: provider as LLMConfig['provider'],
        apiKey,
        baseUrl,
        apiPath,
        model,
        ...(systemPrompt ? { systemPrompt } : {}),
      },
    };
    setSettings(updated);
  }, [provider, apiKey, baseUrl, apiPath, model, systemPrompt]);

  const handleSave = async () => {
    const updated = { ...settings };
    updated.aiSettings = {
      ...updated.aiSettings,
      llm: {
        provider: provider as LLMConfig['provider'],
        apiKey,
        baseUrl,
        apiPath,
        model,
        ...(systemPrompt ? { systemPrompt } : {}),
      },
    };
    setSettings(updated);
    await saveSettings(envConfig, updated);
    eventDispatcher.dispatch('toast', { type: 'success', message: _('LLM configuration saved') });
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setErrorMessage('');

    const TIMEOUT_MS = 15_000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const testPayload = {
        apiKey,
        baseUrl: baseUrl.replace(/\/$/, ''),
        apiPath,
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Translate hello to French.' }],
        max_tokens: 32,
        headers: {
          'HTTP-Referer': 'readest',
          'X-Title': 'Readest LLM Translator',
        },
      };

      const url = isTauriAppPlatform()
        ? `${baseUrl.replace(/\/$/, '')}${apiPath ?? '/v1/chat/completions'}`
        : '/api/llm/translate';

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(_('Invalid API key'));
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error(_('Unexpected response format'));
      }

      setConnectionStatus('success');
    } catch (err) {
      clearTimeout(timeout);
      setConnectionStatus('error');
      setErrorMessage((err as Error).message || _('Connection failed'));
    }
  };

  return (
    <BoxedList title={_('LLM Translation Configuration')}>
      <SettingsRow label={_('Provider')} asLabel>
        <select
          className='select select-bordered select-sm bg-base-100 text-base-content'
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value)}
        >
          <option value='openrouter'>OpenRouter</option>
          <option value='openai'>OpenAI</option>
          <option value='google-ai-studio'>Google AI Studio</option>
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

      <div className='flex flex-col gap-2 py-3 pe-4'>
        <div className='flex items-center justify-between'>
          <SettingLabel>{_('System Prompt')}</SettingLabel>
          <button className='btn btn-ghost btn-xs text-xs' onClick={handleResetPrompt}>
            {_('Reset to Default')}
          </button>
        </div>
        <textarea
          className='textarea textarea-bordered textarea-sm w-full font-mono text-xs leading-relaxed'
          rows={6}
          value={systemPrompt || DEFAULT_LLM_SYSTEM_PROMPT}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder={DEFAULT_LLM_SYSTEM_PROMPT}
        />
        <p className='text-xs opacity-60'>
          {_('Use {targetLang} for target language, {text} for input text.')}
        </p>
      </div>

      <SettingsRow label={''}>
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
      </SettingsRow>
    </BoxedList>
  );
};

export default LLMTranslationPanel;
