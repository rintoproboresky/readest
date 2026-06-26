import { describe, test, expect } from 'vitest';
import { type BookNote, type BookNoteType } from '@/types/book';

describe('BookNote type: translation', () => {
  test('accepts translation type in BookNoteType union', () => {
    const t: BookNoteType = 'translation';
    expect(t).toBe('translation');
  });

  test('BookNote supports optional translation field', () => {
    const note: BookNote = {
      id: 'test-1',
      type: 'translation',
      cfi: 'epubcfi(/6/4!/2/4)',
      text: 'hello',
      translation: 'halo',
      note: '',
      createdAt: 1000,
      updatedAt: 1000,
    };
    expect(note.translation).toBe('halo');
  });

  test('translation field is optional (backward compatible)', () => {
    const note: BookNote = {
      id: 'test-2',
      type: 'annotation',
      cfi: 'epubcfi(/6/4!/2/4)',
      style: 'highlight',
      color: 'yellow',
      note: 'important',
      createdAt: 1000,
      updatedAt: 1000,
    };
    expect(note.translation).toBeUndefined();
  });

  test('filters translation notes correctly', () => {
    const notes: BookNote[] = [
      { id: '1', type: 'translation', cfi: 'a', text: 'hello', translation: 'halo', note: '', createdAt: 1, updatedAt: 1 },
      { id: '2', type: 'translation', cfi: 'b', text: 'world', translation: 'dunia', note: '', createdAt: 2, updatedAt: 2 },
      { id: '3', type: 'annotation', cfi: 'c', style: 'highlight', color: 'yellow', note: 'note', createdAt: 3, updatedAt: 3 },
      { id: '4', type: 'translation', cfi: 'd', text: 'deleted', translation: 'dihapus', note: '', createdAt: 4, updatedAt: 4, deletedAt: 5 },
    ];

    const translations = notes.filter((n) => n.type === 'translation' && !n.deletedAt);
    expect(translations).toHaveLength(2);
    expect(translations[0]?.text).toBe('hello');
    expect(translations[1]?.text).toBe('world');
  });
});
