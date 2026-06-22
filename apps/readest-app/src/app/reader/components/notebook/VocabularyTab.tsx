import React, { useMemo } from 'react';
import { RiQuillPenLine } from 'react-icons/ri';
import { useBookDataStore } from '@/store/bookDataStore';
import { useTranslation } from '@/hooks/useTranslation';
import EmptyState from '../EmptyState';

interface VocabularyTabProps {
  bookKey: string;
}

const VocabularyTab: React.FC<VocabularyTabProps> = ({ bookKey }) => {
  const _ = useTranslation();
  const getConfig = useBookDataStore((s) => s.getConfig);
  const saveConfig = useBookDataStore((s) => s.saveConfig);
  const updateBooknotes = useBookDataStore((s) => s.updateBooknotes);
  const config = getConfig(bookKey);

  const translations = useMemo(() => {
    if (!config) return [];
    return config.booknotes
      .filter((n) => n.type === 'translation' && !n.deletedAt)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [config]);

  const handleDelete = (id: string) => {
    if (!config) return;
    const note = config.booknotes.find((n) => n.id === id);
    if (!note) return;
    note.deletedAt = Date.now();
    updateBooknotes(bookKey, config.booknotes);
    saveConfig(bookKey, config);
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
            <div className='border-base-300 bg-base-100 collapse border'>
              <div className='collapse-title pe-8 text-sm font-medium h-[2.5rem] min-h-[2.5rem] p-[0.6rem] flex items-center justify-between'>
                <span className='line-clamp-1'>{item.text}</span>
                <span className='text-xs text-cyan-600 ml-2 shrink-0'>
                  {item.translation}
                </span>
              </div>
              <div className='collapse-content font-size-xs px-3 pb-0'>
                <div className='flex justify-end'>
                  <div
                    role='button'
                    tabIndex={0}
                    className='font-size-xs cursor-pointer align-bottom text-red-500 hover:text-red-600'
                    onClick={() => handleDelete(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' || e.key === 'Delete') {
                        handleDelete(item.id);
                      }
                    }}
                    aria-label={_('Delete')}
                  >
                    {_('Delete')}
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default VocabularyTab;
