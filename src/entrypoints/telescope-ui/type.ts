export const StateValues = ['ask', 'chat'] as const;
export const DirectionValues = ['up', 'down'] as const;

export type State = (typeof StateValues)[number];
export type Direction = (typeof DirectionValues)[number];

export type InputProps = {
  inputState?: State;
  inputValue?: string;
  placeholder?: string;
  searchIndex?: number;
  totalResults?: number;
  isExpanded?: boolean;
  suggestedQuestions?: string[];
  disabled?: boolean;
  inputImageAttached?: string[];
  messages?: Message[];
  quotedContent: string[];
  onInput?: ({ value }: { value: string }) => void;
  onStateChange?: ({ state }: { state: State }) => void;
  onAsk?: ({ value, images }: { value: string; images?: string[] }) => void;
  onVoiceInput?: () => void;
  onAttachment?: () => void;
  onClear?: () => void;
  onSuggestedQuestion?: ({ question }: { question: string }) => void;
  onSearchNavigation?: ({
    direction,
    currentIndex,
  }: {
    direction: 'up' | 'down';
    currentIndex: number;
  }) => void;
  onClose?: () => void;
  handleSuggestedQuestion?: (question: string) => void;
  isStreaming?: boolean;
  streamingMessageId?: number | null;
  onStop?: () => void;
  onDragStart?: (event: MouseEvent) => void;
};

export type Message = {
  id: number;
  type: 'user' | 'assistant';
  content: string;
  images?: string[];
  timestamp: Date;
};

export type ChatboxProps = {
  input: () => any;
  messages?: Message[];
  suggestedQuestions?: string[];
  onSuggestedQuestion?: ({ question }: { question: string }) => void;
  onClose?: () => void;
  isStreaming?: boolean;
  streamingMessageId?: number | null;
  // Additional props for side panel functionality
  inputValue?: string;
  inputImageAttached?: string[];
  searchIndex?: number;
  totalResults?: number;
  currentState?: State;
  onDragStart?: (event: MouseEvent) => void;
};
