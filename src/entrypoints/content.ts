/*@ts-ignore */
import App from './telescope-ui/App.svelte';
/*@ts-ignore */
import SelectionPopupContainer from './selection-popup/SelectionPopupContainer.svelte';
/*@ts-ignore */
import WriterAssistant from './writer-popup/WriterAssistant.svelte';
import { mount, unmount } from 'svelte';
import { get } from 'svelte/store';
import { selectionPopupStore } from '../lib/selectionPopupStore';
import { writerPopupStore } from '../lib/writerPopupStore';
import { sidePanelUtils } from '../lib/sidePanelStore';
import type { SelectionAction } from './selection-popup/types';
import { globalStorage } from '@/lib/globalStorage';
import { getFeatureConfig } from '../lib/featureConfig';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    let ui: any = null;
    let isVisible = false;
    globalStorage().onBoard();
    let selectionPopupUI: any = null;
    let writerAssistantUI: any = null;

    const createUI = async () => {
      if (ui) return ui;

      try {
        ui = await createShadowRootUi(ctx, {
          position: 'inline',
          name: 'telescope-ui',
          anchor: 'body',
          onMount: (container) => {
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '0';
            container.style.right = '0';
            container.style.bottom = '0';
            container.style.zIndex = '99999';

            const app = mount(App, {
              target: container,
              props: { isInSidePanel: false },
            });
            return app;
          },
          onRemove: (app) => {
            unmount(app as any);
            ui = null;
            isVisible = false;
          },
        });

        return ui;
      } catch (error) {
        console.error('Failed to create UI:', error);
        throw error;
      }
    };

    const createSelectionPopupUI = async () => {
      if (selectionPopupUI) return selectionPopupUI;

      try {
        selectionPopupUI = await createShadowRootUi(ctx, {
          position: 'inline',
          name: 'selection-popup-ui',
          anchor: 'body',
          onMount: (container) => {
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = '0';
            container.style.height = '0';
            container.style.zIndex = '2147483647';
            container.style.pointerEvents = 'none';

            const app = mount(SelectionPopupContainer, {
              target: container,
              props: {
                onClose: hideSelectionPopup,
              },
            });

            container.style.pointerEvents = 'auto';

            return app;
          },
          onRemove: (app) => {
            unmount(app as any);
            selectionPopupUI = null;
          },
        });

        return selectionPopupUI;
      } catch (error) {
        console.error('Failed to create selection popup UI:', error);
        throw error;
      }
    };

    const createWriterAssistantUI = async () => {
      if (writerAssistantUI) return writerAssistantUI;

      try {
        writerAssistantUI = await createShadowRootUi(ctx, {
          position: 'inline',
          name: 'writer-assistant-ui',
          anchor: 'body',
          onMount: (container) => {
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = '0';
            container.style.height = '0';
            container.style.zIndex = '2147483647';
            container.style.pointerEvents = 'none';

            const app = mount(WriterAssistant, {
              target: container,
              props: {},
            });

            container.style.pointerEvents = 'auto';

            return app;
          },
          onRemove: (app) => {
            unmount(app as any);
            writerAssistantUI = null;
          },
        });

        return writerAssistantUI;
      } catch (error) {
        console.error('Failed to create writer assistant UI:', error);
        throw error;
      }
    };

    const getSelectionPosition = (): { x: number; y: number } | null => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      const x = rect.left + rect.width / 2;
      const y = rect.top;

      return { x, y };
    };

    const showSelectionPopup = async () => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();

      if (!selectedText || selectedText.length === 0) {
        hideSelectionPopup();
        return;
      }

      const position = getSelectionPosition();
      if (!position) return;

      const popupWidth = 200;
      const popupHeight = 60;
      const margin = 20;

      let { x, y } = position;

      if (x - popupWidth / 2 < margin) {
        x = margin + popupWidth / 2;
      } else if (x + popupWidth / 2 > window.innerWidth - margin) {
        x = window.innerWidth - margin - popupWidth / 2;
      }

      let isAtTop = false;
      if (y - popupHeight - margin < 0) {
        y = margin + 40;
        isAtTop = true;
      } else if (y > window.innerHeight - margin) {
        y = window.innerHeight - margin;
      }

      if (!selectionPopupUI) {
        await createSelectionPopupUI();
        selectionPopupUI.mount();
      }

      selectionPopupStore.show(x, y, selectedText, isAtTop);
    };

    const hideSelectionPopup = () => {
      selectionPopupStore.hide();
    };

    const isSelectionPopupVisible = () => {
      return get(selectionPopupStore.getState()).visible;
    };

    const updateSelectionPopupPosition = async () => {
      if (!isSelectionPopupVisible()) return;

      const featureConfig = await getFeatureConfig();
      if (!featureConfig.selectionTelescopeEnabled) {
        hideSelectionPopup();
        return;
      }

      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();
      if (!selectedText || selectedText.length === 0) {
        hideSelectionPopup();
        return;
      }

      const position = getSelectionPosition();
      if (!position) {
        hideSelectionPopup();
        return;
      }

      const popupWidth = 200;
      const popupHeight = 60;
      const margin = 20;

      let { x, y } = position;

      if (x - popupWidth / 2 < margin) {
        x = margin + popupWidth / 2;
      } else if (x + popupWidth / 2 > window.innerWidth - margin) {
        x = window.innerWidth - margin - popupWidth / 2;
      }

      let isAtTop = false;
      if (y - popupHeight - margin < 0) {
        y = margin + 40;
        isAtTop = true;
      } else if (y > window.innerHeight - margin) {
        y = window.innerHeight - margin;
      }

      selectionPopupStore.show(x, y, selectedText, isAtTop);
    };

    const handleSelectionChange = async () => {
      clearTimeout((window as any).__selectionTimeout);
      (window as any).__selectionTimeout = setTimeout(async () => {
        const featureConfig = await getFeatureConfig();
        if (!featureConfig.selectionTelescopeEnabled) {
          hideSelectionPopup();
          return;
        }

        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();

        if (selectedText && selectedText.length > 0) {
          showSelectionPopup();
        } else {
          hideSelectionPopup();
        }
      }, 100);
    };

    const handleMouseUp = async (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest('.selection-popup')) {
        return;
      }

      setTimeout(async () => {
        await handleSelectionChange();
      }, 10);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mouseup', handleMouseUp);

    let resizeScrollObserver: (() => void) | null = null;

    const setupSelectionPopupRepositioning = () => {
      if (resizeScrollObserver) {
        resizeScrollObserver();
      }

      let timeout: number | null = null;
      const onRecalc = () => {
        if (timeout) clearTimeout(timeout);
        timeout = window.setTimeout(async () => {
          await updateSelectionPopupPosition();
        }, 50);
      };

      window.addEventListener('resize', onRecalc);
      window.addEventListener('scroll', onRecalc, true);

      let mutationObserver: MutationObserver | null = null;
      if (typeof MutationObserver !== 'undefined') {
        mutationObserver = new MutationObserver(() => {
          onRecalc();
        });
        mutationObserver.observe(document.body, {
          attributes: true,
          childList: true,
          subtree: true,
        });
      }

      resizeScrollObserver = () => {
        window.removeEventListener('resize', onRecalc);
        window.removeEventListener('scroll', onRecalc, true);
        if (mutationObserver) mutationObserver.disconnect();
      };
    };

    selectionPopupStore.getState().subscribe((current) => {
      if (current.visible) {
        setupSelectionPopupRepositioning();
      } else if (resizeScrollObserver) {
        resizeScrollObserver();
        resizeScrollObserver = null;
      }
    });
    let currentFocusedElement:
      | HTMLTextAreaElement
      | HTMLInputElement
      | HTMLElement
      | null = null;

    const isWritableElement = (
      element: Element | null
    ): element is HTMLTextAreaElement | HTMLInputElement | HTMLElement => {
      if (!element) return false;

      if (element.tagName === 'TEXTAREA') return true;
      if (
        element.tagName === 'DIV' &&
        (element as HTMLDivElement).contentEditable === 'true'
      )
        return true;

      if (element.tagName === 'INPUT') {
        const input = element as HTMLInputElement;
        const writableTypes = [
          'text',
          'email',
          'search',
          'url',
          'tel',
          'password',
        ];
        return writableTypes.includes(input.type);
      }

      if ((element as HTMLElement).contentEditable === 'true') {
        return true;
      }

      return false;
    };

    const showWriterButton = async (
      element: HTMLTextAreaElement | HTMLInputElement | HTMLElement
    ) => {
      try {
        const featureConfig = await getFeatureConfig();
        if (!featureConfig.writerTelescopeEnabled) {
          return;
        }
      } catch { }

      if (!writerAssistantUI) {
        await createWriterAssistantUI();
        writerAssistantUI.mount();
      }

      const rect = element.getBoundingClientRect();

      const x = rect.right - 20;
      const y = rect.top + 20;

      currentFocusedElement = element;
      writerPopupStore.show(x, y, element);
    };

    const hideWriterButton = () => {
      writerPopupStore.hide();
      currentFocusedElement = null;
    };

    const handleTextareaFocus = (event: FocusEvent) => {
      const target = event.target;

      if (isWritableElement(target as Element | null)) {
        const writableElement = target;
        setTimeout(() => {
          if (document.activeElement === writableElement) {
            showWriterButton(writableElement as HTMLTextAreaElement | HTMLInputElement | HTMLElement);
          }
        }, 100);
      }
    };

    const handleTextareaBlur = (event: FocusEvent) => {
      const target = event.target;
      if (isWritableElement(target as Element | null)) {
        setTimeout(() => {
          let isPopupOpen = false;
          const unsubscribe = writerPopupStore.subscribe((state) => {
            isPopupOpen = state.popupOpen;
          });
          unsubscribe();

          if (!isPopupOpen) {
            hideWriterButton();
          }
        }, 150);
      }
    };

    const handleTextareaClick = (event: MouseEvent) => {
      const target = event.target;

      if (
        isWritableElement(target as Element) &&
        target === currentFocusedElement
      ) {
        const writableElement = target;
        showWriterButton(writableElement as HTMLTextAreaElement | HTMLInputElement | HTMLElement);
      }
    };

    document.addEventListener('focusin', handleTextareaFocus, true);
    document.addEventListener('focusout', handleTextareaBlur, true);
    document.addEventListener('click', handleTextareaClick, true);

    async function toggleTelescope() {
      const featureConfig = await getFeatureConfig();
      if (!featureConfig.floatingTelescopeEnabled) {
        return;
      }

      if (!isVisible || !ui) {
        await createUI();
        ui.mount();
        isVisible = true;
      } else if (isVisible && ui) {
        ui.remove();
        isVisible = false;
        ui = null;
      }
    }

    async function hasKeyboardShortcut(): Promise<boolean> {
      const config = await globalStorage().get('config');
      if (
        config &&
        typeof config === 'object' &&
        config.assignedTelescopeCommand
      ) {
        return true;
      }
      return false;
    }

    const handleKeyDown = async (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isVisible && ui) {
        event.preventDefault();
        ui.remove();
        isVisible = false;
        ui = null;
        return;
      }
      const hasShortcut = await hasKeyboardShortcut();
      if (!hasShortcut) {
        event.preventDefault();
        const isCtrlOrCmd = event.ctrlKey || event.metaKey;
        const isEKey = event.key === 'y' || event.key === 'Y';
        if (isCtrlOrCmd && isEKey) {
          void toggleTelescope();
          return true as boolean;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    const handleTelescopeClose = () => {
      if (isVisible && ui) {
        ui.remove();
        isVisible = false;
        ui = null;
      }
    };

    window.addEventListener('telescope-close', handleTelescopeClose);

    const handleMessage = async (
      message: any,
      sender: any,
      sendResponse: any
    ) => {
      if (message.action === 'openTelescope') {
        void toggleTelescope();
        return true;
      }

      if (message.type === 'EXTRACT_PAGE_CONTENT') {
        (async () => {
          try {
            const { cleanHTML, htmlToMarkdown, processTextForLLM } =
              await import('../lib/utils/converters');

            const html = document.documentElement.outerHTML;
            const cleanedHTML = cleanHTML(html);
            const markdown = htmlToMarkdown(cleanedHTML);
            const processedMarkdown = processTextForLLM(markdown);

            const metadata = `# ${document.title || 'Web Page'}

**URL:** ${window.location.href}
**Converted:** ${new Date().toISOString()}

---

`;

            const maxLength = 6_000;
            const finalContent = metadata + processedMarkdown;
            const pageContext =
              finalContent.length > maxLength
                ? finalContent.substring(0, maxLength) +
                '\n\n... [Content truncated for AI context]'
                : finalContent;

            sendResponse({ success: true, pageContext });
          } catch (error) {
            console.error(
              'Content script: Error extracting page content:',
              error
            );
            sendResponse({
              success: false,
              error: 'Failed to extract page content',
              pageContext: `# ${document.title || 'Web Page'}

**URL:** ${window.location.href}

**Error:** Failed to convert to markdown

---

${document.body.textContent || 'No content available'}`,
            });
          }
        })();
        return true as boolean;
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    ctx.onInvalidated(() => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('focusin', handleTextareaFocus, true);
      document.removeEventListener('focusout', handleTextareaBlur, true);
      document.removeEventListener('click', handleTextareaClick, true);
      window.removeEventListener('telescope-close', handleTelescopeClose);
      chrome.runtime.onMessage.removeListener(handleMessage);

      if (ui && isVisible) {
        ui.remove();
      }

      if (selectionPopupUI) {
        selectionPopupUI.remove();
      }

      if (writerAssistantUI) {
        writerAssistantUI.remove();
      }

      clearTimeout((window as any).__selectionTimeout);
    });
  },
});
