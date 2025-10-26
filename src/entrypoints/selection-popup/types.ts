export type SelectionAction = 'summarise' | 'translate' | 'addToChat';

export interface SelectionPopupState {
  visible: boolean;
  x: number;
  y: number;
  selectedText: string;
}
