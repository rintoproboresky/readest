import React, { useMemo } from 'react';
import { RiQuillPenLine } from 'react-icons/ri';
import { useEnv } from '@/context/EnvContext';
import { useBookDataStore } from '@/store/bookDataStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import EmptyState from '../EmptyState';

interface VocabularyTabProps {
  bookKey: string;
}

const VocabularyTab: React.FC<VocabularyTabProps> = ({ bookKey }) => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { settings } = useSettingsStore();
  const getConfig = useBookDataStore((s) => s.getConfig);
  const saveConfig = useBookDataStore((s) => s.saveConfig);
  const updateBooknotes = useBookDataStore((s) => s.updateBooknotes);
  const config = getConfig(bookKey);

  const translations = useMemo(() => {
    if (!config) return [];
    return (config.booknotes ?? [])
      .filter((n) => n.type === 'translation' && !n.deletedAt)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [config]);

  const handleDelete = (id: string) => {
    if (!config) return;
    const { booknotes: notes = [] } = config;
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    note.deletedAt = Date.now();
    note.updatedAt = Date.now();
    const updatedConfig = updateBooknotes(bookKey, notes);
    if (updatedConfig) {
      saveConfig(envConfig, bookKey, updatedConfig, settings);
    }
  };

  if (translations.length === 0) {
    return (
      <div className='flex flex-grow items-center justify-center overflow-y-auto px-3'>
        <EmptyState
          Icon={RiQuillPenLine}
          label={_('No Saved Words')}
          hint={_('Translated words are saved automatically')}
        />
      </div>
    );
  }

  return (
    <div className='flex-grow overflow-y-auto px-3'>
      <ul>
        {translations.map((item) => (
          <li key={item.id} className='my-2'>
            <div className='border-base-300 bg-base-100 flex items-start gap-2 rounded-lg border p-3'>
              <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
                <span className='text-sm font-medium line-clamp-1'>{item.text}</span>
                <span className='text-xs text-cyan-600 line-clamp-1'>{item.translation}</span>
              </div>
              <button
                className='btn btn-ghost btn-xs text-base-content/40 hover:text-error shrink-0 mt-0.5'
                onClick={() => handleDelete(item.id)}
                aria-label={_('Delete')}
              >
                {_('Delete')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default VocabularyTab;
