/**
 * WXT Storage utilities for persisting collections
 * Uses WXT's storage API instead of localStorage
 */

import { storage } from 'wxt/utils/storage';
import type { Collection, Site } from '@/types/formatter';
import { generateId } from './formatterUtils';

const STORAGE_KEY = 'formatter:collections';

/**
 * Get all collections from storage
 */
export const getCollections = async (): Promise<Collection[]> => {
  try {
    const collections = await storage.getItem<Collection[]>(STORAGE_KEY);
    return collections || [];
  } catch (error) {
    console.error('Error reading collections from storage:', error);
    return [];
  }
};

/**
 * Save collections to storage
 */
export const saveCollections = async (
  collections: Collection[]
): Promise<void> => {
  try {
    await storage.setItem(STORAGE_KEY, collections);
  } catch (error) {
    console.error('Error saving collections to storage:', error);
  }
};

/**
 * Get a single collection by ID
 */
export const getCollection = async (id: string): Promise<Collection | undefined> => {
  const collections = await getCollections();
  return collections.find((c) => c.id === id);
};

/**
 * Create a new collection
 */
export const createCollection = async (
  name: string,
  type: 'recipe' | 'image'
): Promise<Collection> => {
  const collection: Collection = {
    id: generateId(),
    name,
    type,
    sites: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const collections = await getCollections();
  collections.push(collection);
  await saveCollections(collections);

  return collection;
};

/**
 * Update a collection
 */
export const updateCollection = async (
  id: string,
  updates: Partial<Collection>
): Promise<Collection | null> => {
  const collections = await getCollections();
  const index = collections.findIndex((c) => c.id === id);

  if (index === -1) return null;

  collections[index] = {
    ...collections[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await saveCollections(collections);
  return collections[index];
};

/**
 * Delete a collection
 */
export const deleteCollection = async (id: string): Promise<boolean> => {
  const collections = await getCollections();
  const filtered = collections.filter((c) => c.id !== id);

  if (filtered.length === collections.length) return false;

  await saveCollections(filtered);
  return true;
};

/**
 * Add a site to a collection
 */
export const addSiteToCollection = async (
  collectionId: string,
  site: Site
): Promise<Collection | null> => {
  const collection = await getCollection(collectionId);

  if (!collection) return null;

  collection.sites.push(site);
  return updateCollection(collectionId, { sites: collection.sites });
};

/**
 * Remove a site from a collection
 */
export const removeSiteFromCollection = async (
  collectionId: string,
  siteId: string
): Promise<Collection | null> => {
  const collection = await getCollection(collectionId);

  if (!collection) return null;

  collection.sites = collection.sites.filter((s) => s.id !== siteId);
  return updateCollection(collectionId, { sites: collection.sites });
};

