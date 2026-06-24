import { describe, test, expect } from 'vitest';
import { annotationToolButtons } from '@/app/reader/components/annotator/AnnotationTools';
import {
  ALL_ANNOTATION_TOOL_TYPES,
  DEFAULT_ANNOTATION_TOOLBAR_ITEMS,
  getToolbarToolTypes,
  getAvailableToolTypes,
  addToolToToolbar,
  removeToolFromToolbar,
  reorderToolbar,
} from '@/utils/annotationToolbar';

describe('annotationToolbar helpers', () => {
  test('ALL_ANNOTATION_TOOL_TYPES matches the button registry order', () => {
    expect(ALL_ANNOTATION_TOOL_TYPES).toEqual(annotationToolButtons.map((b) => b.type));
  });

  test('default toolbar is the nine non-share tools in canonical order', () => {
    expect(DEFAULT_ANNOTATION_TOOLBAR_ITEMS).toEqual([
      'copy',
      'highlight',
      'annotate',
      'search',
      'dictionary',
      'translate',
      'tts',
      'proofread',
      'llm-insight',
    ]);
    expect(DEFAULT_ANNOTATION_TOOLBAR_ITEMS).not.toContain('share');
  });

  test('getToolbarToolTypes preserves order and falls back to default when undefined', () => {
    expect(getToolbarToolTypes(undefined, true)).toEqual(DEFAULT_ANNOTATION_TOOLBAR_ITEMS);
    // Custom partial list: provided items keep their order, missing defaults appended.
    expect(getToolbarToolTypes(['search', 'copy'], true)).toEqual([
      'search',
      'copy',
      'highlight',
      'annotate',
      'dictionary',
      'translate',
      'tts',
      'proofread',
      'llm-insight',
    ]);
  });

  test('getToolbarToolTypes drops share when !canShare, keeps it when canShare', () => {
    // Missing defaults are auto-appended.
    expect(getToolbarToolTypes(['copy', 'share'], false)).toEqual([
      'copy',
      'highlight',
      'annotate',
      'search',
      'dictionary',
      'translate',
      'tts',
      'proofread',
      'llm-insight',
    ]);
    expect(getToolbarToolTypes(['copy', 'share'], true)).toEqual([
      'copy',
      'share',
      'highlight',
      'annotate',
      'search',
      'dictionary',
      'translate',
      'tts',
      'proofread',
      'llm-insight',
    ]);
  });

  test('getToolbarToolTypes drops unknown/duplicate entries', () => {
    // Missing defaults auto-appended after dedup.
    expect(getToolbarToolTypes(['copy', 'copy', 'bogus' as never], true)).toEqual([
      'copy',
      'highlight',
      'annotate',
      'search',
      'dictionary',
      'translate',
      'tts',
      'proofread',
      'llm-insight',
    ]);
  });

  test('getAvailableToolTypes returns canonical-order complement', () => {
    // When user has only 'copy', all defaults are auto-included, so only 'share' is available.
    expect(getAvailableToolTypes(['copy'], true)).toEqual(['share']);
  });

  test('getAvailableToolTypes hides share when !canShare', () => {
    expect(getAvailableToolTypes(['copy'], false)).not.toContain('share');
  });

  test('addToolToToolbar appends by default and is a no-op when present', () => {
    expect(addToolToToolbar(['copy'], 'share')).toEqual(['copy', 'share']);
    expect(addToolToToolbar(['copy', 'share'], 'share')).toEqual(['copy', 'share']);
  });

  test('addToolToToolbar inserts at the given index', () => {
    expect(addToolToToolbar(['copy', 'search'], 'share', 1)).toEqual(['copy', 'share', 'search']);
  });

  test('removeToolFromToolbar removes the tool', () => {
    expect(removeToolFromToolbar(['copy', 'share'], 'share')).toEqual(['copy']);
    expect(removeToolFromToolbar(['copy'], 'share')).toEqual(['copy']);
  });

  test('reorderToolbar moves a tool to another tool position', () => {
    expect(reorderToolbar(['copy', 'highlight', 'search'], 'search', 'copy')).toEqual([
      'search',
      'copy',
      'highlight',
    ]);
    expect(reorderToolbar(['copy', 'search'], 'copy', 'copy')).toEqual(['copy', 'search']);
  });
});
