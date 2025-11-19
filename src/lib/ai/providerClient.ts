import { streamText, generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export type Provider = 'openai' | 'anthropic' | 'gemini';

export type ProviderConfig = {
  provider: Provider;
  model: string;
  apiKey: string;
};

export type RunOptions = {
  system?: string;
  messages: any[];
};

export type StreamResult = {
  stream: ReadableStream<string>;
};

export function getDefaultModels(p: Provider): string[] {
  if (p === 'openai') return ['gpt-4o', 'gpt-4o-mini', 'o3-mini'];
  if (p === 'anthropic')
    return [
      'claude-3-5-sonnet-latest',
      'claude-3-5-haiku-latest',
      'claude-3-opus-latest',
    ];
  return ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
}

export function buildProviderModel(cfg: ProviderConfig) {
  if (cfg.provider === 'openai') {
    const openai = createOpenAI({ apiKey: cfg.apiKey });
    return openai(cfg.model);
  }
  if (cfg.provider === 'anthropic') {
    const anthropic = createAnthropic({ apiKey: cfg.apiKey });
    return anthropic(cfg.model);
  }
  const google = createGoogleGenerativeAI({ apiKey: cfg.apiKey });
  return google(cfg.model);
}

export async function runProviderStream(
  cfg: ProviderConfig,
  opts: RunOptions
): Promise<StreamResult> {
  try {
    const model = buildProviderModel(cfg) as any;
    const { textStream } = await streamText({
      model,
      system: opts.system,
      messages: opts.messages,
    });
    // Adapter to the extension's expected ReadableStream<string>
    return { stream: textStream as unknown as ReadableStream<string> };
  } catch (error) {
    console.error(
      `Error creating stream for ${cfg.provider}/${cfg.model}:`,
      error
    );
    // Check if error is related to unsupported content type (like audio)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes('audio') ||
      errorMessage.includes('unsupported')
    ) {
      throw new Error(
        `Audio input is not supported for ${cfg.model}. Please use text input instead.`
      );
    }
    throw error;
  }
}

export async function runProviderFullText(
  cfg: ProviderConfig,
  opts: RunOptions
): Promise<string> {
  try {
    const model = buildProviderModel(cfg) as any;
    const result = await generateText({
      model,
      system: opts.system,
      messages: opts.messages,
    });
    return result.text;
  } catch (error) {
    console.error(
      `Error fetching full response for ${cfg.provider}/${cfg.model}:`,
      error
    );
    throw error;
  }
}

export function imagePartFromDataURL(dataUrl: string): any {
  return { type: 'image', image: dataUrl };
}

export function textPart(text: string): any {
  return { type: 'text', text };
}

export async function audioPartFromBlob(blob: Blob): Promise<any> {
  // Convert blob to data URL for AI SDK compatibility
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // Use data URL format similar to images for better compatibility
      resolve({ type: 'audio', audio: dataUrl });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
