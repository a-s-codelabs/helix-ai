import { writable } from 'svelte/store';
import type { SelectionPopupState } from '../entrypoints/selection-popup/types';

class SelectionPopupStore {
  private state = writable<SelectionPopupState>({
    visible: false,
    x: 0,
    y: 0,
    selectedText: '',
    isAtTop: false,
  });

  getState() {
    return this.state;
  }

  show(x: number, y: number, selectedText: string, isAtTop: boolean = false) {
    this.state.update((current) => ({
      ...current,
      visible: true,
      x,
      y,
      selectedText,
      isAtTop,
    }));
  }

  hide() {
    this.state.update((current) => ({
      ...current,
      visible: false,
    }));
  }

  updatePosition(x: number, y: number) {
    this.state.update((current) => ({
      ...current,
      x,
      y,
    }));
  }

  updateText(selectedText: string) {
    this.state.update((current) => ({
      ...current,
      selectedText,
    }));
  }
}

export const selectionPopupStore = new SelectionPopupStore();
export const selectionPopupState = selectionPopupStore.getState();
