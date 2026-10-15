import clsx from 'clsx';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useSettingsStore } from '@/store/settingsStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useReaderStore } from '@/store/readerStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { NotebookTab, useNotebookStore } from '@/store/notebookStore';
import { useAIChatStore } from '@/store/aiChatStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useThemeStore } from '@/store/themeStore';
import { useEnv } from '@/context/EnvContext';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';
import { usePanelResize } from '@/hooks/usePanelResize';
import { eventDispatcher } from '@/utils/event';
import { BookNote } from '@/types/book';
import { TextSelection } from '@/utils/sel';
import { uniqueId } from '@/utils/misc';
import { getBookDirFromLanguage } from '@/utils/book';
import { getPanelTopInset } from '@/utils/insets';
import { Overlay } from '@/components/Overlay';
import { saveSysSettings } from '@/helpers/settings';
import { NOTE_PREFIX } from '@/types/view';
import useShortcuts from '@/hooks/useShortcuts';
import {
  findAnnotationAtCfi,
  removeBookNoteOverlays,
  removeEmptyAnnotationPlaceholder,
} from '../../utils/annotatorUtil';
import {
  flushNotebookDocument,
  useNotebookDocumentCoordinator,
} from '../../hooks/useNotebookDocumentCoordinator';
import AIAssistant from './AIAssistant';
import NotebookHeader from './Header';
import NotebookEditor from './NotebookEditor';
import NoteEditor from './NoteEditor';
import VocabularyTab from './VocabularyTab';
import SearchBar from './SearchBar';
import NotebookTabNavigation from './NotebookTabNavigation';

const MIN_NOTEBOOK_WIDTH = 0.15;
const MAX_NOTEBOOK_WIDTH = 0.45;

const Notebook: React.FC = () => {
  const _ = useTranslation();
  const { envConfig, appService } = useEnv();
  const { settings } = useSettingsStore();
  const { updateAppTheme, safeAreaInsets, systemUIVisible, statusBarHeight } = useThemeStore();
  const { sideBarBookKey, setSideBarVisible, setSearchBarVisible, clearBooknotesNav } =
    useSidebarStore();
  const {
    notebookWidth,
    isNotebookVisible,
    isNotebookPinned,
    notebookActiveTab,
    notebookNewAnnotation,
    notebookEditAnnotation,
    getNotebookWidth,
    setNotebookWidth,
    setNotebookVisible,
    setNotebookPin,
    toggleNotebookPin,
    setNotebookActiveTab,
  } = useNotebookStore();
  const { getBookData, getConfig, setConfig, updateBooknotes, saveConfig } = useBookDataStore();
  const { getView, getViewsById, getProgress, getViewSettings } = useReaderStore();
  const { activeConversationId } = useAIChatStore();

  useNotebookDocumentCoordinator(sideBarBookKey);

  const isMobile =
    appService?.isMobile === true || window.innerWidth < 640 || window.innerHeight < 640;
  const [isFullHeightInMobile, setIsFullHeightInMobile] = useState(isMobile);
  const [isSearchBarVisible, setIsSearchBarVisible] = useState(false);
  const [searchResults, setSearchResults] = useState<BookNote[] | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const hideNotebook = useCallback(() => {
    if (sideBarBookKey) void flushNotebookDocument(sideBarBookKey);
    setNotebookVisible(false);
    useNotebookStore.getState().setNotebookNewAnnotation(null);
    useNotebookStore.getState().setNotebookEditAnnotation(null);
    setIsFullHeightInMobile(isMobile);
  }, [isMobile, setNotebookVisible, sideBarBookKey]);

  const {
    panelRef: notebookRef,
    overlayRef,
    panelHeight: notebookHeight,
    handleVerticalDragStart,
  } = useSwipeToDismiss(hideNotebook, (data) => setIsFullHeightInMobile(data.clientY < 44));

  const handleHideNotebookShortcut = useCallback(() => {
    if (!isNotebookVisible || isNotebookPinned) return false;
    hideNotebook();
    return true;
  }, [hideNotebook, isNotebookPinned, isNotebookVisible]);

  useShortcuts({ onEscape: handleHideNotebookShortcut }, [handleHideNotebookShortcut]);

  useEffect(() => {
    if (isNotebookVisible) {
      updateAppTheme('base-200');
      overlayRef.current = document.querySelector('.overlay') as HTMLDivElement | null;
    } else {
      updateAppTheme('base-100');
      overlayRef.current = null;
    }
  }, [isNotebookVisible, overlayRef, updateAppTheme]);

  useEffect(() => {
    setNotebookWidth(settings.globalReadSettings.notebookWidth);
    setNotebookPin(settings.globalReadSettings.isNotebookPinned);
    setNotebookVisible(settings.globalReadSettings.isNotebookPinned);
    if (settings.globalReadSettings.notebookActiveTab) {
      setNotebookActiveTab(settings.globalReadSettings.notebookActiveTab);
    }
    // The settings store only hydrates the Notebook store when this panel mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onNavigate = () => {
      if (!useNotebookStore.getState().isNotebookPinned) hideNotebook();
    };
    eventDispatcher.on('navigate', onNavigate);
    return () => eventDispatcher.off('navigate', onNavigate);
  }, [hideNotebook]);

  useEffect(() => {
    if (!isNotebookVisible || notebookNewAnnotation || notebookEditAnnotation) {
      setIsSearchBarVisible(false);
      setSearchResults(null);
      setSearchTerm('');
    }
  }, [isNotebookVisible, notebookNewAnnotation, notebookEditAnnotation]);

  const handleNotebookResize = (newWidth: string) => {
    setNotebookWidth(newWidth);
    settings.globalReadSettings.notebookWidth = newWidth;
  };

  const handleTogglePin = () => {
    toggleNotebookPin();
    const globalReadSettings = settings.globalReadSettings;
    saveSysSettings(envConfig, 'globalReadSettings', {
      ...globalReadSettings,
      isNotebookPinned: !isNotebookPinned,
    });
  };

  const handleTabChange = (tab: NotebookTab) => {
    setNotebookActiveTab(tab);
    saveSysSettings(envConfig, 'globalReadSettings', {
      ...settings.globalReadSettings,
      notebookActiveTab: tab,
    });
  };

  const handleToggleSearchBar = () => {
    setIsSearchBarVisible((visible) => !visible);
    if (isSearchBarVisible) {
      setSearchResults(null);
      setSearchTerm('');
    }
  };

  const handleCancelNewAnnotation = useCallback(
    (bookKey: string | null) => {
      const state = useNotebookStore.getState();
      const { notebookNewHighlightIds } = state;
      if (bookKey && notebookNewHighlightIds.length > 0) {
        const config = getConfig(bookKey);
        const annotations = config?.booknotes ?? [];
        const views = getViewsById(bookKey.split('-')[0]!);
        const deletedAt = Date.now();
        let removedPlaceholder = false;

        for (const id of notebookNewHighlightIds) {
          const placeholder = removeEmptyAnnotationPlaceholder(annotations, id, deletedAt);
          if (!placeholder) continue;
          views.forEach((view) => removeBookNoteOverlays(view, placeholder));
          removedPlaceholder = true;
        }

        if (removedPlaceholder) {
          const updatedConfig = updateBooknotes(bookKey, annotations);
          if (updatedConfig) {
            saveConfig(envConfig, bookKey, updatedConfig, useSettingsStore.getState().settings);
          }
        }
      }
      if (notebookNewHighlightIds.length > 0) state.setNotebookNewHighlightIds([]);
      if (state.notebookNewAnnotation) state.setNotebookNewAnnotation(null);
    },
    [envConfig, getConfig, getViewsById, saveConfig, updateBooknotes],
  );

  useEffect(() => {
    if (!(isNotebookVisible && notebookNewAnnotation)) {
      handleCancelNewAnnotation(sideBarBookKey);
    }
  }, [handleCancelNewAnnotation, isNotebookVisible, notebookNewAnnotation, sideBarBookKey]);

  useEffect(() => {
    return () => handleCancelNewAnnotation(sideBarBookKey);
  }, [handleCancelNewAnnotation, sideBarBookKey]);

  const handleSaveNote = (selection: TextSelection, note: string) => {
    if (!sideBarBookKey) return;
    const view = getView(sideBarBookKey);
    const config = getConfig(sideBarBookKey);
    if (!config) return;

    const cfi = view?.getCFI(selection.index, selection.range);
    if (!cfi) return;

    const annotations = config.booknotes ?? [];
    const existingIndex = findAnnotationAtCfi(annotations, cfi);
    if (existingIndex !== -1) {
      const existing = annotations[existingIndex]!;
      const updated: BookNote = {
        ...existing,
        note,
        text: selection.text || existing.text,
        updatedAt: Date.now(),
      };
      annotations[existingIndex] = updated;
      view?.addAnnotation({ ...updated, value: `${NOTE_PREFIX}${updated.cfi}` });
    } else {
      const style = settings.globalReadSettings.highlightStyle;
      const color = settings.globalReadSettings.highlightStyles[style];
      const annotation: BookNote = {
        id: uniqueId(),
        type: 'annotation',
        cfi,
        style,
        color,
        note,
        page: selection.page,
        text: selection.text,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      view?.addAnnotation(annotation);
      view?.addAnnotation({ ...annotation, value: `${NOTE_PREFIX}${annotation.cfi}` });
      annotations.push(annotation);
    }
    const updatedConfig = updateBooknotes(sideBarBookKey, annotations);
    if (updatedConfig) saveConfig(envConfig, sideBarBookKey, updatedConfig, settings);
    useNotebookStore.getState().setNotebookNewAnnotation(null);
    useNotebookStore.getState().setNotebookNewHighlightIds([]);
  };

  const handleEditNote = (note: BookNote, isDelete = false) => {
    if (!sideBarBookKey) return;
    const config = getConfig(sideBarBookKey);
    if (!config?.booknotes) return;
    const index = config.booknotes.findIndex((item) => item.id === note.id);
    if (index === -1) return;

    const progress = getProgress(sideBarBookKey);
    const updatedNote: BookNote = {
      ...note,
      ...(isDelete ? { deletedAt: Date.now() } : { updatedAt: Date.now() }),
      ...(progress ? { page: progress.page } : {}),
    };
    const annotations = [...config.booknotes];
    annotations[index] = updatedNote;
    getView(sideBarBookKey)?.addAnnotation(
      { ...updatedNote, value: `${NOTE_PREFIX}${updatedNote.cfi}` },
      true,
    );
    const updatedConfig = updateBooknotes(sideBarBookKey, annotations);
    if (updatedConfig) saveConfig(envConfig, sideBarBookKey, updatedConfig, settings);
    useNotebookStore.getState().setNotebookEditAnnotation(null);
  };

  const handleOpenAnnotations = () => {
    if (!sideBarBookKey) return;
    setSearchBarVisible(false);
    clearBooknotesNav(sideBarBookKey);
    const config = getConfig(sideBarBookKey);
    if (config) {
      setConfig(sideBarBookKey, {
        viewSettings: { ...config.viewSettings, sideBarTab: 'annotations' },
      });
    }
    setSideBarVisible(true);
    if (isMobile) hideNotebook();
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-annotations-heading]')?.focus();
    });
  };

  const handleDeleteExcerpt = (excerpt: BookNote) => {
    if (!sideBarBookKey) return;
    const config = getConfig(sideBarBookKey);
    if (!config?.booknotes) return;
    const booknotes = config.booknotes.map((note) =>
      note.id === excerpt.id && note.type === 'excerpt' ? { ...note, deletedAt: Date.now() } : note,
    );
    const updatedConfig = updateBooknotes(sideBarBookKey, booknotes);
    if (updatedConfig) void saveConfig(envConfig, sideBarBookKey, updatedConfig, settings);
  };

  const { handleResizeStart: handleDragStart, handleResizeKeyDown: handleDragKeyDown } =
    usePanelResize({
      side: 'end',
      minWidth: MIN_NOTEBOOK_WIDTH,
      maxWidth: MAX_NOTEBOOK_WIDTH,
      getWidth: getNotebookWidth,
      onResize: handleNotebookResize,
    });

  const bookData = sideBarBookKey ? getBookData(sideBarBookKey) : null;
  const excerptNotes = (sideBarBookKey ? getConfig(sideBarBookKey)?.booknotes : []) ?? []
  const liveExcerptNotes = excerptNotes
    .filter((note) => note.type === 'excerpt' && note.text && !note.deletedAt)
    .sort((a, b) => a.createdAt - b.createdAt);
  const filteredExcerptNotes = useMemo(
    () =>
      isSearchBarVisible && searchResults
        ? searchResults.filter((note) => note.type === 'excerpt' && note.text && !note.deletedAt)
        : liveExcerptNotes,
    [liveExcerptNotes, isSearchBarVisible, searchResults],
  );
  const viewSettings = sideBarBookKey ? getViewSettings(sideBarBookKey) : null;
  if (!sideBarBookKey || !bookData?.bookDoc) return null;
  const languageDir = getBookDirFromLanguage(bookData.bookDoc.metadata.language);

  return isNotebookVisible ? (
    <>
      {!isNotebookPinned && (
        <Overlay
          className={clsx('z-[45]', viewSettings?.isEink ? '' : 'bg-black/50 sm:bg-black/20')}
          onDismiss={hideNotebook}
        />
      )}
      <div
        ref={notebookRef}
        className={clsx(
          'notebook-container right-0 flex min-w-60 select-none flex-col',
          'full-height font-sans text-base font-normal transition-[padding-top] duration-300 sm:text-sm',
          viewSettings?.isEink ? 'bg-base-100' : 'bg-base-200',
          appService?.hasRoundedWindow && 'rounded-window-top-right rounded-window-bottom-right',
          isNotebookPinned ? 'z-20' : 'z-[45] shadow-2xl',
          !isNotebookPinned && viewSettings?.isEink && 'border-base-content border-s',
        )}
        role='group'
        aria-label={_('Notebook')}
        dir={viewSettings?.rtl && languageDir === 'rtl' ? 'rtl' : 'ltr'}
        style={{
          width: isMobile ? '100%' : notebookWidth,
          maxWidth: isMobile ? '100%' : `${MAX_NOTEBOOK_WIDTH * 100}%`,
          position: isMobile ? 'fixed' : isNotebookPinned ? 'relative' : 'absolute',
          paddingTop: `${getPanelTopInset({
            isMobile,
            isFullHeightInMobile,
            systemUIVisible,
            statusBarHeight,
            safeAreaInsets,
          })}px`,
        }}
      >
        <style jsx>{`
          @media (max-width: 640px) {
            .notebook-container {
              border-top-left-radius: 16px;
              border-top-right-radius: 16px;
            }
          }
        `}</style>
        <div
          className={clsx(
            'drag-bar absolute -left-2 top-0 h-full w-0.5 cursor-col-resize bg-transparent p-2',
            isMobile && 'hidden',
          )}
          role='slider'
          tabIndex={0}
          aria-label={_('Resize Notebook')}
          aria-orientation='horizontal'
          aria-valuenow={parseFloat(notebookWidth)}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          onKeyDown={handleDragKeyDown}
        />
        <div className='shrink-0'>
          {isMobile && (
            <div
              role='slider'
              tabIndex={0}
              aria-label={_('Resize Notebook')}
              aria-orientation='vertical'
              aria-valuenow={notebookHeight.current}
              className='drag-handle flex h-6 max-h-6 min-h-6 w-full cursor-row-resize items-center justify-center'
              onMouseDown={handleVerticalDragStart}
              onTouchStart={handleVerticalDragStart}
            >
              <div className='bg-base-content/50 h-1 w-10 rounded-full' />
            </div>
          )}
          <NotebookHeader
            isPinned={isNotebookPinned}
            isSearchBarVisible={isSearchBarVisible && notebookActiveTab === 'notes'}
            handleClose={hideNotebook}
            handleTogglePin={handleTogglePin}
            handleToggleSearchBar={handleToggleSearchBar}
            showSearchButton={notebookActiveTab === 'notes'}
          />
        </div>
        {notebookActiveTab === 'ai' ? (
          <div className='flex min-h-0 flex-1 flex-col'>
            <AIAssistant key={activeConversationId ?? 'new'} bookKey={sideBarBookKey} />
          </div>
        ) : notebookActiveTab === 'vocabulary' ? (
          <VocabularyTab bookKey={sideBarBookKey} />
        ) : (
          <>
            <div
              className={clsx('search-bar shrink-0', {
                'search-bar-visible': isSearchBarVisible,
              })}
            >
              <SearchBar
                isVisible={isSearchBarVisible}
                bookKey={sideBarBookKey}
                searchTerm={searchTerm}
                onSearchResultChange={setSearchResults}
              />
            </div>
            <div className='flex min-h-0 flex-1 flex-col overflow-y-auto'>
              <NotebookEditor
                bookKey={sideBarBookKey}
                handleOpenAnnotations={handleOpenAnnotations}
                excerpts={filteredExcerptNotes}
                onDeleteExcerpt={handleDeleteExcerpt}
              />
              {(notebookNewAnnotation || notebookEditAnnotation) && !isSearchBarVisible && (
                <div className='shrink-0 px-3 pb-2'>
                  <p className='content font-size-base'>{_('Notes')}</p>
                  <NoteEditor
                    onSave={handleSaveNote}
                    onEdit={(note) => handleEditNote(note)}
                  />
                </div>
              )}
            </div>
          </>
        )}
        <div
          className='shrink-0'
          style={{ paddingBottom: `${(safeAreaInsets?.bottom || 0) / 2}px` }}
        >
          <NotebookTabNavigation activeTab={notebookActiveTab} onTabChange={handleTabChange} />
        </div>
      </div>
    </>
  ) : null;
};

export default Notebook;
