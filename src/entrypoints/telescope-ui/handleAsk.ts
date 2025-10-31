import { chatStore } from '@/lib/chatStore';
import { InputIntent } from '@/lib/dbSchema';
import { RewriterOptions, WriterOptions } from '@/lib/writerApiHelper';

export type AskOptions = {
  value: string;
  images?: string[];
  settings?: Record<string, string | number>;
  intent?: InputIntent | "summarise" | "translate" | "write" | "rewrite";
};
// TODO: unify naming
export function handleAskHelper(opts: AskOptions) {
  if (opts.intent === 'prompt') {
    chatStore.promptStreaming(opts.value, opts.images);
  } else if (opts.intent === 'summarise' || opts.intent === "summarize") {
    chatStore.summariseStreaming(opts.value);
  } else if (opts.intent === 'translator' || opts.intent === "translate") {
    chatStore.translateStreaming(opts.value, opts.settings?.outputLanguage as string);
  }
  else if (opts.intent === 'write') {
    chatStore.writeStreaming(opts.value, opts.settings as WriterOptions);
  }
  else if (opts.intent === 'rewrite') {
    chatStore.rewriteStreaming(opts.value, opts.settings as RewriterOptions);
  }
  else {
    chatStore.promptStreaming(opts.value, opts.images);
    console.error('Invalid intent', opts.intent);
  }
}
