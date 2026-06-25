import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import Popup from '@/components/Popup';
import { Position } from '@/utils/sel';
import { getAIInsight, AIInsightResult } from '@/services/llm/aiInsight';
import { useSettingsStore } from '@/store/settingsStore';

interface AIInsightPopupProps {
  word: string;
  sourceLang: string;
  targetLang: string;
  position: Position;
  trianglePosition: Position;
  width: number;
  height: number;
  onDismiss: () => void;
  onSelectAlternative?: (translation: string) => void;
  onSaveFullResult?: (result: AIInsightResult) => void;
}

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

const AIInsightPopup: React.FC<AIInsightPopupProps> = ({
  word,
  sourceLang,
  targetLang,
  position,
  trianglePosition,
  width,
  height,
  onDismiss,
  onSelectAlternative,
  onSaveFullResult,
}) => {
  const _ = useTranslation();
  const { settings } = useSettingsStore();
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [result, setResult] = useState<AIInsightResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const autoSaved = useRef(false);

  useEffect(() => {
    if (loadingState === 'success' && result && !autoSaved.current) {
      autoSaved.current = true;
      onSaveFullResult?.(result);
      onSelectAlternative?.(result.mainTranslation);
    }
  }, [loadingState, result, onSelectAlternative, onSaveFullResult]);

  const fetchInsight = async () => {
    const llmConfig = settings?.aiSettings?.llm;
    if (!llmConfig?.apiKey) {
      setError(_('AI Insight not configured. Go to Settings → AI Insight.'));
      setLoadingState('error');
      return;
    }
    setLoadingState('loading');
    setError(null);
    setResult(null);
    try {
      const insight = await getAIInsight(word, sourceLang, targetLang, {
        apiKey: llmConfig.apiKey,
        model: llmConfig.model || 'gpt-4o-mini',
        baseUrl: llmConfig.baseUrl,
        apiPath: llmConfig.apiPath,
        fallbacks: llmConfig.fallbacks,
      });
      setResult(insight);
      setLoadingState('success');
    } catch (err) {
      setError((err as Error).message || _('Failed to get word insight'));
      setLoadingState('error');
    }
  };

  useEffect(() => {
    void fetchInsight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word, sourceLang, targetLang]);

  return (
    <Popup
      position={position}
      trianglePosition={trianglePosition}
      width={width}
      height={height}
      onDismiss={onDismiss}
    >
      <div className='flex max-h-[320px] flex-col gap-2 overflow-y-auto p-3'>
        {/* Header */}
        <div className='flex items-center gap-2 border-b border-base-200 pb-2'>
          <span className='text-base-content/80 text-xs font-semibold'>{_('AI Insight')}</span>
          <span className='text-base-content/40 text-xs'>
            &ldquo;{word}&rdquo; ({sourceLang} → {targetLang})
          </span>
        </div>

        {loadingState === 'success' && result && (
          <div className='rounded bg-primary/10 px-2.5 py-1 text-[10px] text-primary'>
            {_('Main translation saved')}
          </div>
        )}

        {/* Loading */}
        {loadingState === 'loading' && (
          <div className='flex flex-col gap-3 py-2'>
            <div className='bg-base-200 h-4 w-3/4 animate-pulse rounded' />
            <div className='bg-base-200 h-3 w-full animate-pulse rounded' />
            <div className='bg-base-200 h-3 w-5/6 animate-pulse rounded' />
            <div className='bg-base-200 h-3 w-2/3 animate-pulse rounded' />
          </div>
        )}

        {/* Error */}
        {loadingState === 'error' && (
          <div className='flex flex-col items-center gap-2 py-3'>
            <span className='text-error text-xs'>{error}</span>
            <button className='btn btn-outline btn-xs' onClick={fetchInsight}>
              {_('Retry')}
            </button>
          </div>
        )}

        {/* Success */}
        {loadingState === 'success' && result && (
          <>
            {/* Main Translation */}
            <button
              className='w-full rounded-md bg-base-200/50 px-3 py-2 text-left transition-colors hover:bg-base-200/80'
              onClick={() => onSelectAlternative?.(result.mainTranslation)}
            >
              <span className='text-base-content/50 text-xs font-medium'>{_('Most likely')}</span>
              <div className='text-base-content text-sm font-semibold'>
                {result.mainTranslation}
              </div>
            </button>

            {/* Alternatives */}
            {result.alternatives.length > 0 && (
              <div className='flex flex-col gap-1.5'>
                {result.alternatives.map((alt, i) => {
                  const isSelected = selectedIndex === i;

                  return (
                    <button
                      key={i}
                      className={`flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? 'bg-primary/10 border border-primary/30'
                          : 'bg-base-200/30 hover:bg-base-200/60 border border-transparent'
                      }`}
                      onClick={() => {
                        setSelectedIndex(i);
                        onSelectAlternative?.(alt.translation);
                      }}
                    >
                      <div className='flex items-center gap-2'>
                        <span className='text-base-content text-sm font-medium'>
                          {alt.translation}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            alt.confidence === 'high'
                              ? 'bg-success/10 text-success'
                              : alt.confidence === 'medium'
                                ? 'bg-warning/10 text-warning'
                                : 'bg-base-300/50 text-base-content/50'
                          }`}
                        >
                          {alt.usage}
                        </span>
                      </div>
                      <span className='text-base-content/50 text-xs italic'>
                        &ldquo;{alt.example}&rdquo;
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Note */}
            {result.note && (
              <div className='mt-1 rounded-md bg-base-200/30 px-3 py-1.5'>
                <span className='text-base-content/50 text-[11px] italic'>{result.note}</span>
              </div>
            )}
          </>
        )}
      </div>
    </Popup>
  );
};

export default AIInsightPopup;
