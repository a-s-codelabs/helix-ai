/**
 * Writer Popup Store
 * Manages state for the Writer API popup
 */

import { writable } from 'svelte/store';

export interface WriterPopupState {
  visible: boolean;
  popupOpen: boolean;
  x: number;
  y: number;
  targetElement: HTMLTextAreaElement | HTMLInputElement | HTMLElement | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: WriterPopupState = {
  visible: false,
  popupOpen: false,
  x: 0,
  y: 0,
  targetElement: null,
  isLoading: false,
  error: null,
};

function createWriterPopupStore() {
  const { subscribe, set, update } = writable<WriterPopupState>(initialState);

  return {
    subscribe,
    show: (
      x: number,
      y: number,
      targetElement: HTMLTextAreaElement | HTMLInputElement | HTMLElement
    ) => {
      update((state) => ({
        ...state,
        visible: true,
        x,
        y,
        targetElement,
        error: null,
      }));
    },
    hide: () => {
      update((state) => ({
        ...state,
        visible: false,
        popupOpen: false,
        isLoading: false,
        error: null,
      }));
    },
    setPopupOpen: (open: boolean) => {
      update((state) => ({ ...state, popupOpen: open }));
    },
    setLoading: (isLoading: boolean) => {
      update((state) => ({ ...state, isLoading }));
    },
    setError: (error: string | null) => {
      update((state) => ({ ...state, error, isLoading: false }));
    },
    reset: () => set(initialState),
  };
}

export const writerPopupStore = createWriterPopupStore();
export const writerPopupState = { subscribe: writerPopupStore.subscribe };
