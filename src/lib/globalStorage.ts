import { storage } from 'wxt/utils/storage';

const STORAGE_KEY = {
  config: 'local:global:config',
} as const;

type GlobalStorageKey = keyof typeof STORAGE_KEY;

const getGlobalStorage = async <T = unknown>(key: GlobalStorageKey): Promise<T | null> => {
  const value = await storage.getItem<T>(STORAGE_KEY[key]);
  return value;
};

const setGlobalStorage = async <T = unknown>(key: GlobalStorageKey, value: T): Promise<void> => {
  await storage.setItem(STORAGE_KEY[key], value);
};

const deleteGlobalStorage = async (key: GlobalStorageKey): Promise<void> => {
  await storage.removeItem(STORAGE_KEY[key]);
};

const appendGlobalStorage = async <T = unknown>(key: GlobalStorageKey, value: T): Promise<void> => {
  const currentValue = await getGlobalStorage<T>(key);
  if (!currentValue) {
    await storage.setItem(STORAGE_KEY[key], value);
    return;
  }
  if (Array.isArray(currentValue)) {
    await storage.setItem(STORAGE_KEY[key], [...currentValue, value]);
    return;
  }
  else if (typeof currentValue === 'object') {
    await storage.setItem(STORAGE_KEY[key], { ...currentValue, ...value });
    return;
  }

  await storage.setItem(STORAGE_KEY[key], value);
};

export function globalStorage() {
  return {
    get: getGlobalStorage,
    set: setGlobalStorage,
    delete: deleteGlobalStorage,
    append: appendGlobalStorage,
    keys: STORAGE_KEY,
  };
}
