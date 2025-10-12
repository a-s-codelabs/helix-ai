export const StateValues = ["ask", "search", "chat"] as const;
export const DirectionValues = ["up", "down"] as const;

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
  onInput?: ({ value }: { value: string }) => void;
  onStateChange?: ({ state }: { state: State }) => void;
  onAsk?: ({ value }: { value: string }) => void;
  onVoiceInput?: () => void;
  onAttachment?: () => void;
  onClear?: () => void;
  onSuggestedQuestion?: ({ question }: { question: string }) => void;
  onSearchNavigation?: ({
    direction,
    currentIndex,
  }: {
    direction: "up" | "down";
    currentIndex: number;
  }) => void;
  onClose?: () => void;
}

export type Message = {
  role: "user" | "assistant";
  content: string;
  timeStamp: string;
};