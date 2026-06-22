import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { useEnv } from '@/context/EnvContext';
import { eventDispatcher } from '@/utils/event';
import { BoxedList, SettingLabel, SettingsRow } from '../primitives';
import type { LLMConfig } from '@/services/translators/providers/llm';

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

const LLMTranslationPanel: React.FC = () => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { settings, setSettings, saveSettings } = useSettingsStore();

  const llmCfg = settings?.aiSettings?.llm;
  const [provider, setProvider] = useState(llmCfg?.provider ?? 'openrouter');
  const [apiKey, setApiKey] = useState(llmCfg?.apiKey ?? '');
  const [baseUrl, setBaseUrl] = useState(llmCfg?.baseUrl ?? 'https://openrouter.ai/api/v1');
  const [model, setModel] = useState(llmCfg?.model ?? '');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const providerDefaults: Record<string, { baseUrl: string; model: string }> = {
    openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: '' },
    openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    'google-ai-studio': {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      model: 'gemini-3.1-flash-lite',
    },
  };

  const handleProviderChange = (value: string) => {
    setProvider(value as LLMConfig['provider']);
    const preset = providerDefaults[value];
    if (preset) {
      setBaseUrl(preset.baseUrl);
      if (preset.model) setModel(preset.model);
    }
  };

  useEffect(() => {
    if (!settings.aiSettings) return;
    const updated = { ...settings };
    updated.aiSettings = {
      ...updated.aiSettings,
      llm: { provider: provider as LLMConfig['provider'], apiKey, baseUrl, model },
    };
    setSettings(updated);
  }, [provider, apiKey, baseUrl, model]);

  const handleSave = async () => {
    const updated = { ...settings };
    updated.aiSettings = {
      ...updated.aiSettings,
      llm: { provider: provider as LLMConfig['provider'], apiKey, baseUrl, model },
    };
    setSettings(updated);
    await saveSettings(envConfig, updated);
    eventDispatcher.dispatch('toast', { type: 'success', message: _('LLM configuration saved') });
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setErrorMessage('');

    try {
      const response = await fetch('/api/llm/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          baseUrl: baseUrl.replace(/\/$/, ''),
          model: model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Translate hello to French.' }],
          max_tokens: 32,
          headers: {
            'HTTP-Referer': 'readest',
            'X-Title': 'Readest LLM Translator',
          },
        }),
      });

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
