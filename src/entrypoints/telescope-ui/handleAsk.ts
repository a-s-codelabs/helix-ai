import { chatStore } from '@/lib/chatStore';
import { InputIntent } from '@/lib/dbSchema';
import { RewriterOptions, WriterOptions } from '@/lib/writerApiHelper';
import { AVAILABLE_MODELS } from '@/lib/multiModelStore';

export type AskOptions = {
  value: string;
  images?: string[];
  settings?: Record<string, string | number>;
  intent?:
    | InputIntent
    | 'summarize'
    | 'translate'
    | 'write'
    | 'rewrite'
    | 'proofread';
  tabId?: number | null;
  audioBlobId?: string;
  multiModel?: boolean;
  enabledModels?: string[];
};
// TODO: unify naming
export function handleAskHelper(opts: AskOptions) {
  // console.log('handleAskHelper', JSON);

  const hasMultiModalInput =
    (opts.images && opts.images.length > 0) || !!opts.audioBlobId;
  const isPromptIntent = !opts.intent || opts.intent === 'prompt';

  // Use multi-model mode if enabled and it's a prompt intent
  // Also enable multi-model for multi-modal inputs (images or audio)
  if (isPromptIntent && (opts.multiModel || hasMultiModalInput)) {
    const enabledModels =
      opts.enabledModels || AVAILABLE_MODELS.map((m) => m.id);
    chatStore.multiModelPromptStreaming({
      userMessage: opts.value,
      images: opts.images,
      audioBlobId: opts.audioBlobId,
      tabId: opts.tabId,
      enabledModels,
    });
    return;
  }

  if (opts.intent === 'prompt') {
    chatStore.promptStreaming({
      userMessage: opts.value,
      images: opts.images,
      audioBlobId: opts.audioBlobId,
      tabId: opts.tabId,
    });
  } else if (opts.intent === 'summarize') {
    chatStore.summarizeStreaming({
      userMessage: opts.value,
      tabId: opts.tabId,
    });
  } else if (opts.intent === 'translator' || opts.intent === 'translate') {
    chatStore.translateStreaming({
      userMessage: opts.value,
      targetLanguage: opts.settings?.outputLanguage as string,
      tabId: opts.tabId,
    });
  } else if (opts.intent === 'write') {
    chatStore.writeStreaming({
      userMessage: opts.value,
      options: opts.settings as WriterOptions,
      tabId: opts.tabId,
    });
  } else if (opts.intent === 'rewrite') {
    chatStore.rewriteStreaming({
      userMessage: opts.value,
      options: opts.settings as RewriterOptions,
      tabId: opts.tabId,
    });
  } else if (opts.intent === 'proofread') {
    chatStore.proofreadStreaming({
      userMessage: opts.value,
      tabId: opts.tabId,
    });
  } else {
    chatStore.promptStreaming({
      userMessage: opts.value,
      images: opts.images,
      audioBlobId: opts.audioBlobId,
      tabId: opts.tabId,
    });
    console.error('Invalid intent', opts.intent);
  }
}
