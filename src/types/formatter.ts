/**
 * Type definitions for formatter features
 */

// Collection types
export type CollectionType = 'recipe' | 'image';

// Recipe related types
export interface Ingredient {
  name: string;
  amount?: string;
  unit?: string;
}

export interface Recipe {
  title: string;
  servings?: number;
  ingredients: Ingredient[];
  main: string[];
  optional?: string[];
}

// Image related types
export interface ImageItem {
  url: string;
  title: string;
  alt?: string;
}

export interface ImageData {
  images: ImageItem[];
}

// Site type
export type Site = {
  id: string;
  type: CollectionType;
  url?: string;
  title: string;
  addedAt: string;
} & (
  | { type: 'recipe'; data: Recipe }
  | { type: 'image'; data: ImageData }
);

// Collection type
export interface Collection {
  id: string;
  name: string;
  type: CollectionType;
  sites: Site[];
  createdAt: string;
  updatedAt: string;
}

// Input/Output types
export interface ExtractFromUrlInput {
  url: string;
  type: CollectionType;
}

export interface ExtractFromDataInput {
  data: string;
  type: CollectionType;
}

export interface ExtractOutput {
  title: string;
  url?: string;
  data: Recipe | ImageData;
}

export interface FormatRecipeInput {
  rawData: string;
  url?: string;
}

export interface FormatImageInput {
  rawData: string;
  url?: string;
}

export interface ExportToMarkdownInput {
  collection: Collection;
}

export interface ExportToMarkdownOutput {
  markdown: string;
  filename: string;
}

// Claude API types
export interface ClaudeExtractInput {
  content: string;
  type: CollectionType;
}

