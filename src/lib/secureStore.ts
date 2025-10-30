import { globalStorage } from './globalStorage';

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

async function getOrCreateKdfSalt(): Promise<Uint8Array> {
  const store = globalStorage();
  const existing = await store.get('secureProviderKeys');
  if (existing && existing.kdfSalt) {
    return Uint8Array.from(atob(existing.kdfSalt), (c) => c.charCodeAt(0));
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await store.set('secureProviderKeys', {
    openai: existing?.openai ?? null,
    anthropic: existing?.anthropic ?? null,
    gemini: existing?.gemini ?? null,
    kdfSalt: btoa(String.fromCharCode(...salt)),
  });
  return salt;
}

async function deriveKey(): Promise<CryptoKey> {
  const salt = await getOrCreateKdfSalt();
  // Use extension id and a static label as the base secret; this is not perfect but avoids plain text at rest
  const base = `${chrome.runtime.id}-helix-ai-secure`; // runtime.id is stable per install
  const material = await crypto.subtle.importKey(
    'raw',
    TEXT_ENCODER.encode(base),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptSecret(plain: string): Promise<{ iv: string; cipher: string }> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    TEXT_ENCODER.encode(plain)
  );
  return {
    iv: btoa(String.fromCharCode(...iv)),
    cipher: btoa(String.fromCharCode(...new Uint8Array(cipherBuf))),
  };
}

export async function decryptSecret(payload: { iv: string; cipher: string } | null): Promise<string | null> {
  if (!payload) return null;
  const key = await deriveKey();
  const iv = Uint8Array.from(atob(payload.iv), (c) => c.charCodeAt(0));
  const data = Uint8Array.from(atob(payload.cipher), (c) => c.charCodeAt(0));
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return TEXT_DECODER.decode(plainBuf);
}

export type ProviderKey = 'openai' | 'anthropic' | 'gemini';

export async function saveProviderKey(provider: ProviderKey, apiKey: string): Promise<void> {
  const store = globalStorage();
  const cleaned = apiKey.trim();
  const blob = await encryptSecret(cleaned);
  const current = (await store.get('secureProviderKeys')) || {
    openai: null,
    anthropic: null,
    gemini: null,
    kdfSalt: null,
  };
  await store.set('secureProviderKeys', { ...current, [provider]: blob });
}

export async function loadProviderKey(provider: ProviderKey): Promise<string | null> {
  const store = globalStorage();
  const current = await store.get('secureProviderKeys');
  if (!current) return null;
  return decryptSecret(current[provider]);
}


