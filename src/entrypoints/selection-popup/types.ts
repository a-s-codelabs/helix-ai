export type SelectionAction = 'summarize' | 'translate' | 'addToChat';

export interface SelectionPopupState {
  visible: boolean;
  x: number;
  y: number;
  selectedText: string;
  isAtTop?: boolean;
  source?: 'summarize' | 'translate';
  targetLanguage?: string;
}
