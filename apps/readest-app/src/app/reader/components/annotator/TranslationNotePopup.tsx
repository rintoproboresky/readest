import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import Popup from '@/components/Popup';
import { Position } from '@/utils/sel';
import { HIGHLIGHT_COLOR_HEX } from '@/services/constants';
import TranslationStylePicker, { TranslationStyle } from './TranslationStylePicker';

interface TranslationNotePopupProps {
  text: string;
  translation: string;
  cfi: string;
  style: TranslationStyle;
  color: string;
  position: Position;
  trianglePosition: Position;
  width: number;
  height: number;
  onDismiss: () => void;
  onSave?: (cfi: string, newTranslation: string, style?: TranslationStyle, color?: string) => void;
  onDelete?: (cfi: string) => void;
  onInsight?: () => void;
}

const TranslationNotePopup: React.FC<TranslationNotePopupProps> = ({
  text,
  translation,
  cfi,
  style: initialStyle,
  color: initialColor,
  position,
  trianglePosition,
  width,
  height,
  onDismiss,
  onSave,
  onDelete,
  onInsight,
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

  const colorHex = HIGHLIGHT_COLOR_HEX[initialColor] ?? initialColor;

  return (
    <Popup
      position={position}
      trianglePosition={trianglePosition}
      width={width}
      height={height}
      onDismiss={() => {
        if (editing) {
          handleCancel();
        }
        onDismiss();
      }}
    >
      <div className='flex flex-col gap-3 p-3'>
        <div className='flex flex-col gap-1'>
          <span className='text-base-content/60 text-xs font-medium'>{_('Translation')}</span>
          <div className='text-base-content flex flex-col gap-1'>
            <span className='text-sm'>{text}</span>
            {editing ? (
              <textarea
                ref={textareaRef}
                className='textarea textarea-bordered text-base text-base-content font-medium w-full resize-none'
                rows={3}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
              />
            ) : (
              <span className='text-base text-base-content font-medium'>{translation}</span>
            )}
          </div>
        </div>
        {editing ? (
          <div className='flex flex-col gap-2'>
            <span className='text-base-content/60 text-xs font-medium'>{_('Style')}</span>
            <TranslationStylePicker
              style={editStyle}
              color={editColor}
              onChange={(s, c) => {
                setEditStyle(s);
                setEditColor(c);
              }}
            />
          </div>
        ) : (
          <div className='flex items-center gap-2'>
            <div
              className='h-3 w-3 rounded-full'
              style={{ backgroundColor: colorHex }}
            />
            <span className='text-base-content/40 text-xs'>
              {initialStyle === 'squiggly' ? _('Squiggly') : _('Underline')}
            </span>
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
              >
                {_('Edit')}
              </button>
              <button
                className='btn btn-ghost btn-xs text-base-content/60 hover:text-error'
                onClick={handleDelete}
              >
                {_('Delete')}
              </button>
              <div className='flex-1' />
              {onInsight && (
                <button className='btn btn-primary btn-xs gap-1' onClick={onInsight}>
                  <span className='text-xs'>{_('AI Insight')}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </Popup>
  );
};

export default TranslationNotePopup;
