import { storage } from 'wxt/utils/storage';
import { DB_SCHEMA, DBStorageKey, ExtractColumnType } from './dbSchema';

const getGS = async <K extends DBStorageKey>(key: K, { whereKey }: { whereKey?: string } = {}): Promise<ExtractColumnType<K> | null> => {
  const value = await storage.getItem<ExtractColumnType<K>>(DB_SCHEMA[key].storageKey);
  if (whereKey && typeof value === 'object' && value !== null) {
    return value?.[whereKey as keyof typeof value] as ExtractColumnType<K> | null ?? null;
  }
  return value;
};

const setGS = async <K extends DBStorageKey>(key: K, value: ExtractColumnType<K>): Promise<void> => {
  await storage.setItem(DB_SCHEMA[key].storageKey, value);
};

const deleteGS = async <K extends DBStorageKey>(key: K): Promise<void> => {
  await storage.removeItem(DB_SCHEMA[key].storageKey);
};

const appendGS = async <K extends DBStorageKey>({ key, value, whereKey }: { key: K, value: ExtractColumnType<K>, whereKey?: string }): Promise<void> => {
  const currentValue = await getGS<K>(key, { whereKey });
  if (!currentValue) {
    if ("maxLimit" in DB_SCHEMA[key] && Array.isArray(value) && value.length > DB_SCHEMA[key].maxLimit) {
      value = value.slice(0, DB_SCHEMA[key].maxLimit) as ExtractColumnType<K>;
    }
    await storage.setItem(DB_SCHEMA[key].storageKey, value);
    return;
  }
  if (Array.isArray(currentValue)) {
    if ("maxLimit" in DB_SCHEMA[key] && Array.isArray(value) && currentValue.length + value.length > DB_SCHEMA[key].maxLimit) {
      value = currentValue.slice(0, DB_SCHEMA[key].maxLimit - value.length) as ExtractColumnType<K>;
    }
    await storage.setItem(DB_SCHEMA[key].storageKey, [value, ...currentValue]);
    return;
  }
  else if (typeof currentValue === 'object') {
    await storage.setItem(DB_SCHEMA[key].storageKey, { ...value, ...currentValue });
    return;
  }

  await storage.setItem(DB_SCHEMA[key].storageKey, value);
};

const onBoardGS = async ({ force = false }: { force?: boolean } = {}) => {
  const keys = Object.keys(DB_SCHEMA);
  if (await getGS("config") && !force) {
    return;
  }
  for (const key of keys) {
    const value = await getGS(key as DBStorageKey);
    if (!value) {
      await setGS(key as DBStorageKey, DB_SCHEMA[key as keyof typeof DB_SCHEMA].default);
    }
  }
}

export function globalStorage() {
  return {
    get: getGS,
    set: setGS,
    delete: deleteGS,
    append: appendGS,
    keys: Object.keys(DB_SCHEMA) as DBStorageKey[],
    onBoard: onBoardGS,
    ACTION_STATE_EVENT: DB_SCHEMA.action_state.storageKey,
    watch: storage.watch,
    unwatch: storage.unwatch,
  };
}
