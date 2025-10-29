export const translateOption = [
  {
    label: 'English',
    value: 'en',
  },
  {
    label: 'Spanish',
    value: 'es',
  },
  {
    label: 'French',
    value: 'fr',
  },
  {
    label: 'German',
    value: 'de',
  },
  {
    label: 'Italian',
    value: 'it',
  },
  {
    label: 'Portuguese',
    value: 'pt',
  },
  {
    label: 'Russian',
    value: 'ru',
  },
  {
    label: 'Japanese',
    value: 'ja',
  },
] as const;

export const defaultOption = [
  {
    uiType: 'slider',
    name: 'Temperature',
    id: 'temperature',
    min: 0,
    max: 2,
  },
  {
    uiType: 'slider',
    name: 'TopK',
    id: 'topK',
    min: 0,
    max: 100,
  },
] as const;

export const summaryType = [
  {
    label: 'Key Points',
    value: 'keyPoints',
  },
  {
    label: 'TL;DR',
    value: 'tldr',
  },
  {
    label: 'Teaser',
    value: 'teaser',
  },
  {
    label: 'Headline',
    value: 'headline',
  },
] as const;

export const lengthOption = [
  {
    label: 'Short',
    value: 'short',
  },
  {
    label: 'Medium',
    value: 'medium',
  },
  {
    label: 'Long',
    value: 'long',
  },
] as const;

export const formatOption = [
  {
    label: 'Markdown',
    value: 'markdown',
  },
  {
    label: 'Plain Text',
    value: 'plain-text',
  },
] as const;

export const toneOption = [
  {
    label: 'Formal',
    value: 'formal',
  },
  {
    label: 'Neutral',
    value: 'neutral',
  },
  {
    label: 'Casual',
    value: 'casual',
  },
] as const;

export const writerOutputLanguageOption = [
  {
    label: 'English',
    value: 'en',
  },
  {
    label: 'Spanish',
    value: 'es',
  },
  {
    label: 'French',
    value: 'fr',
  },
  {
    label: 'Portuguese',
    value: 'pt',
  },
  {
    label: 'Japanese',
    value: 'ja',
  },
] as const;
