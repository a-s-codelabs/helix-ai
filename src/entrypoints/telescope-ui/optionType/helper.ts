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
  // {
  //   uiType: 'dropdown',
  //   name: 'AI Platform',
  //   id: 'aiPlatform',
  //   options: [
  //     { label: 'Built-in (Private)', value: 'builtin' },
  //     { label: 'OpenAI', value: 'openai' },
  //     // { label: 'Claude', value: 'anthropic' },
  //     { label: 'Gemini', value: 'gemini' },
  //   ],
  // },
  // {
  //   uiType: 'dropdown',
  //   name: 'Model',
  //   id: 'aiModel',
  //   options: [
  //     // OpenAI
  //     { label: 'OpenAI - gpt-4o', value: 'gpt-4o' },
  //     { label: 'OpenAI - gpt-4o-mini', value: 'gpt-4o-mini' },
  //     { label: 'OpenAI - o3-mini', value: 'o3-mini' },
  //     // Anthropic
  //     // { label: 'Claude - claude-3-5-sonnet-latest', value: 'claude-3-5-sonnet-latest' },
  //     // { label: 'Claude - claude-3-5-haiku-latest', value: 'claude-3-5-haiku-latest' },
  //     // { label: 'Claude - claude-3-opus-latest', value: 'claude-3-opus-latest' },
  //     // Gemini
  //     { label: 'Gemini 2.5 Pro (best quality)', value: 'gemini-2.5-pro' },
  //     { label: 'Gemini 2.5 Flash (value for money)', value: 'gemini-2.5-flash' },
  //     { label: 'Gemini 2.5 Flash-Lite (low cost)', value: 'gemini-2.5-flash-lite' },
  //   ],
  // },
  {
    uiType: 'slider',
    name: 'Temperature',
    id: 'temperature',
    defaultValue: 0.7,
    step: 0.1,
    min: 0,
    max: 2,
  },
  {
    uiType: 'slider',
    name: 'TopK',
    id: 'topK',
    defaultValue: 0,
    step: 1,
    min: 0,
    max: 100,
  },
] as const;

export const summaryType = [
  {
    uiType: 'dropdown',
    name: 'Summary type',
    id: 'summaryType',
    options: [
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
    ],
  },
] as const;

export const lengthOption = [
  {
    uiType: 'dropdown',
    name: 'Length',
    id: 'length',
    options: [
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
    ],
  },
] as const;

export const rewriterLengthOption = [
  {
    uiType: 'dropdown',
    name: 'Length',
    id: 'length',
    defaultValue: 'as-is',
    options: [
      {
        label: 'Shorter',
        value: 'shorter',
      },
      {
        label: 'As-Is',
        value: 'as-is',
      },
      {
        label: 'Longer',
        value: 'longer',
      },
    ],
  },
] as const;

export const formatOption = [
  {
    uiType: 'dropdown',
    name: 'Format',
    id: 'format',
    options: [
      {
        label: 'Markdown',
        value: 'markdown',
      },
      {
        label: 'Plain Text',
        value: 'plain-text',
      },
    ],
  },
] as const;

export const rewriterFormatOption = [
  {
    uiType: 'dropdown',
    name: 'Format',
    id: 'format',
    defaultValue: 'as-is',
    options: [
      {
        label: 'As-Is',
        value: 'as-is',
      },
      {
        label: 'Markdown',
        value: 'markdown',
      },
      {
        label: 'Plain Text',
        value: 'plain-text',
      },
    ],
  },
] as const;

export const toneOption = [
  {
    uiType: 'dropdown',
    name: 'Tone',
    id: 'tone',
    options: [
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
    ],
  },
] as const;

export const rewriterToneOption = [
  {
    uiType: 'dropdown',
    name: 'Tone',
    id: 'tone',
    defaultValue: 'as-is',
    options: [
      {
        label: 'More Formal',
        value: 'more-formal',
      },
      {
        label: 'As-Is',
        value: 'as-is',
      },
      {
        label: 'More Casual',
        value: 'more-casual',
      },
    ],
  },
] as const;

export const writerOutputLanguageOption = [
  {
    uiType: 'dropdown',
    name: 'Output Language',
    id: 'outputLanguage',
    options: [
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
    ],
  },
] as const;
