import { chatStore } from '@/lib/chatStore';
import { InputIntent } from '@/lib/dbSchema';

type AskOptions = {
  value: string;
  images?: string[];
  settings?: Record<string, string | number>;
  intent?: InputIntent | 'summarise' | 'translate';
};
// TODO: unify naming
export function handleAskHelper(opts: AskOptions) {
  console.log('handleAsk', opts);
  if (opts.intent === 'prompt') {
    chatStore.sendMessageStreaming(opts.value, opts.images);
  } else if (opts.intent === 'summarise' || opts.intent === 'summarize') {
    chatStore.summarise(opts.value);
  } else if (opts.intent === 'translator' || opts.intent === 'translate') {
    chatStore.translate(opts.value, opts.settings?.outputLanguage as string);
  } else {
    chatStore.sendMessageStreaming(opts.value, opts.images);
    console.error('Invalid intent', opts.intent);
  }
}
