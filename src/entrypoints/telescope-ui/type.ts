export const StateValues = ['ask', 'chat'] as const;
export const DirectionValues = ['up', 'down'] as const;

export type State = (typeof StateValues)[number];
export type Direction = (typeof DirectionValues)[number];

export type InputProps = {
  hasChatBox?: boolean;
  inputState?: State;
  inputValue?: string;
  placeholder?: string;
  searchIndex?: number;
  totalResults?: number;
  isExpanded?: boolean;
  tabId?: number | null;
  currentUrl?: string | null;
  suggestedQuestions?: string[];
  disabled?: boolean;
  inputImageAttached?: string[];
  messages?: Message[];
  quotedContent: string[];
  isInSidePanel?: boolean;
  onInput?: ({ value }: { value: string }) => void;
  onStateChange?: ({ state }: { state: State }) => void;
  onAsk?: ({
    value,
    images,
    settings,
    intent,
    audioBlobId,
  }: {
    value: string;
    images?: string[];
    settings?: Record<string, string | number>;
    intent?: string;
    audioBlobId?: string;
  }) => void;
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
  multiModel?: boolean;
  enabledModels?: string[];
};

export type Message = {
  id: number;
  type: 'user' | 'assistant';
  content: string;
  images?: string[];
  audioUrl?: string;
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
  inputValue?: string;
  inputImageAttached?: string[];
  searchIndex?: number;
  totalResults?: number;
  currentState?: State;
  isInSidePanel?: boolean;
  onDragStart?: (event: MouseEvent) => void;
  multiModel?: boolean;
  enabledModels?: string[];
};
