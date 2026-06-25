import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import Popup from '@/components/Popup';
import { Position } from '@/utils/sel';
import { PiArrowsClockwise, PiPencilSimple, PiTrash } from 'react-icons/pi';
import TranslationStylePicker, { TranslationStyle } from './TranslationStylePicker';

interface AIInsightData {
  mainTranslation: string;
  alternatives: Array<{
    translation: string;
    usage: string;
    example: string;
    confidence: string;
  }>;
  note?: string;
}

interface AIInsightNotePopupProps {
  text: string;
  translation: string;
  cfi: string;
  style: TranslationStyle;
  color: string;
  position: Position;
  trianglePosition: Position;
  width: number;
  onDismiss: () => void;
  onSave?: (cfi: string, newTranslation: string, style?: TranslationStyle, color?: string) => void;
  onDelete?: (cfi: string) => void;
  onInsight?: () => void;
  aiInsight?: AIInsightData;
}

const AIInsightNotePopup: React.FC<AIInsightNotePopupProps> = ({
  text,
  translation,
  cfi,
  style: initialStyle,
  color: initialColor,
  position,
  trianglePosition,
  width,
  onDismiss,
  onSave,
  onDelete,
  onInsight,
  aiInsight,
}) => {
  const _ = useTranslation();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(translation);
  const [editStyle, setEditStyle] = useState<TranslationStyle>(initialStyle);
  const [editColor, setEditColor] = useState(initialColor);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    if (editValue.trim()) {
      onSave?.(cfi, editValue.trim(), editStyle, editColor);
    }
    setEditing(false);
    onDismiss();
  };

  const handleCancel = () => {
    setEditValue(translation);
    setEditStyle(initialStyle);
    setEditColor(initialColor);
    setEditing(false);
  };

  const handleDelete = () => {
    onDelete?.(cfi);
    onDismiss();
  };

  return (
    <Popup
      position={position}
      trianglePosition={trianglePosition}
      width={width}
      onDismiss={() => {
        if (editing) {
          handleCancel();
        }
        onDismiss();
      }}
    >
      <div className='flex max-h-[320px] flex-col gap-2 overflow-y-auto p-3'>
        <div className='flex items-center gap-2 border-b border-base-200 pb-2'>
          <span className='text-base-content/80 text-xs font-semibold'>{_('AI Insight')}</span>
          <span className='text-base-content/40 text-xs'>&ldquo;{text}&rdquo;</span>
        </div>
        <div className='w-full rounded-md bg-base-200/50 px-3 py-2'>
          <span className='text-xs font-medium text-base-content/50'>{_('Translation')}</span>
          {editing ? (
            <textarea
              ref={textareaRef}
              className='textarea textarea-bordered text-base text-base-content font-medium w-full resize-none mt-1'
              rows={3}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
            />
          ) : (
            <div className='mt-0.5 text-sm font-semibold text-base-content'>{translation}</div>
          )}
        </div>
        {!editing && aiInsight && aiInsight.alternatives.length > 0 && (
          <div className='flex flex-col gap-1.5'>
            <span className='text-[10px] font-medium text-base-content/50'>{_('Alternatives')}</span>
            {aiInsight.alternatives.map((alt, i) => (
              <div key={i} className='flex flex-col gap-0.5 rounded-md bg-base-200/30 px-3 py-2'>
                <div className='flex items-center gap-1.5'>
                  <span className='text-xs font-medium'>{alt.translation}</span>
                  <span className='rounded bg-cyan-100/50 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700'>
                    {alt.usage}
                  </span>
                </div>
                <span className='text-xs italic text-base-content/50'>&ldquo;{alt.example}&rdquo;</span>
              </div>
            ))}
          </div>
        )}
        {!editing && aiInsight?.note && (
          <div className='rounded-md bg-base-200/30 px-3 py-1.5'>
            <span className='text-[11px] italic text-base-content/50'>{aiInsight.note}</span>
          </div>
        )}
        {editing && (
          <div className='flex flex-col gap-2'>
            <span className='text-xs font-medium text-base-content/50'>{_('Style')}</span>
            <TranslationStylePicker
              style={editStyle}
              color={editColor}
              onChange={(s, c) => {
                setEditStyle(s);
                setEditColor(c);
              }}
            />
          </div>
        )}
        <div className='flex items-center gap-2 border-t border-base-200 pt-2'>
          {editing ? (
            <>
              <button
                className='btn btn-ghost btn-xs text-base-content/60 hover:text-base-content'
                onClick={handleCancel}
              >
                {_('Cancel')}
              </button>
              <button
                className='btn btn-primary btn-xs'
                onClick={handleSave}
                disabled={!editValue.trim()}
              >
                {_('Save')}
              </button>
            </>
          ) : (
            <>
              <button
                className='btn btn-ghost btn-xs text-base-content/60 hover:text-base-content'
                onClick={() => {
                  setEditStyle(initialStyle);
                  setEditColor(initialColor);
                  setEditing(true);
                }}
                title={_('Edit')}
              >
                <PiPencilSimple className='text-xs' />
              </button>
              <button
                className='btn btn-ghost btn-xs text-base-content/60 hover:text-error'
                onClick={handleDelete}
                title={_('Delete')}
              >
                <PiTrash className='text-xs' />
              </button>
              <div className='flex-1' />
              {onInsight && (
                <button className='btn btn-primary btn-xs gap-1' onClick={onInsight} title={_('AI Insight')}>
                  <PiArrowsClockwise className='text-xs' />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </Popup>
  );
};

export default AIInsightNotePopup;
