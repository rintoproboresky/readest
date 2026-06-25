import React from 'react';
import { DEFAULT_HIGHLIGHT_COLORS } from '@/types/book';
import { HIGHLIGHT_COLOR_HEX } from '@/services/constants';

export type TranslationStyle = 'underline' | 'squiggly';

interface TranslationStylePickerProps {
  style: TranslationStyle;
  color: string;
  onChange: (style: TranslationStyle, color: string) => void;
}

const TRANSLATION_DEFAULT_COLOR = '#0891b2';

const allColors = [...DEFAULT_HIGHLIGHT_COLORS, TRANSLATION_DEFAULT_COLOR] as const;

const TranslationStylePicker: React.FC<TranslationStylePickerProps> = ({
  style,
  color,
  onChange,
}) => {
  const baseBtn =
    'flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors';
  const activeBorder = 'border-base-content';
  const inactiveBorder = 'border-transparent hover:border-base-content/30';

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center gap-2'>
        <div className='flex items-center gap-1.5'>
          {allColors.map((c) => {
            const hex = HIGHLIGHT_COLOR_HEX[c] ?? c;
            return (
              <button
                key={c}
                type='button'
                className={`${baseBtn} ${color === c || color === hex ? activeBorder : inactiveBorder}`}
                style={{ backgroundColor: hex }}
                onClick={() => onChange(style, c)}
                aria-label={c}
              />
            );
          })}
        </div>
        <div className='mx-1 h-5 w-px bg-base-300' />
        <div className='flex items-center gap-1'>
          <button
            type='button'
            className={`btn btn-xs h-7 min-h-0 rounded px-2 ${style === 'underline' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onChange('underline', color)}
          >
            <span
              className='text-xs'
              style={{ textDecoration: 'underline', textUnderlineOffset: 2 }}
            >
              U
            </span>
          </button>
          <button
            type='button'
            className={`btn btn-xs h-7 min-h-0 rounded px-2 ${style === 'squiggly' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onChange('squiggly', color)}
          >
            <span
              className='text-xs'
              style={{ textDecoration: 'underline wavy', textUnderlineOffset: 2 }}
            >
              S
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TranslationStylePicker;
