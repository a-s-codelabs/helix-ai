import { chatStore } from '@/lib/chatStore';
import { InputIntent } from '@/lib/dbSchema';
import { RewriterOptions, WriterOptions } from '@/lib/writerApiHelper';

export type AskOptions = {
  value: string;
  images?: string[];
  settings?: Record<string, string | number>;
  intent?: InputIntent | "summarise" | "translate" | "write" | "rewrite";
  tabId?: number | null;
};
// TODO: unify naming
export function handleAskHelper(opts: AskOptions) {
  // console.log('handleAskHelper', JSON);
  if (opts.intent === 'prompt') {
    chatStore.promptStreaming({ userMessage: opts.value, images: opts.images, tabId: opts.tabId });
  } else if (opts.intent === 'summarise' || opts.intent === "summarize") {
    chatStore.summariseStreaming({ userMessage: opts.value, tabId: opts.tabId });
  } else if (opts.intent === 'translator' || opts.intent === "translate") {
    chatStore.translateStreaming({ userMessage: opts.value, targetLanguage: opts.settings?.outputLanguage as string, tabId: opts.tabId });
  }
  else if (opts.intent === 'write') {
    chatStore.writeStreaming({ userMessage: opts.value, options: opts.settings as WriterOptions, tabId: opts.tabId });
  }
  else if (opts.intent === 'rewrite') {
    chatStore.rewriteStreaming({ userMessage: opts.value, options: opts.settings as RewriterOptions, tabId: opts.tabId });
  }
  else {
    chatStore.promptStreaming({ userMessage: opts.value, images: opts.images, tabId: opts.tabId });
    console.error('Invalid intent', opts.intent);
  }
}
