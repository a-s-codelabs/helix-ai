import { defaultOption, formatOption, lengthOption, rewriterFormatOption, rewriterLengthOption, rewriterToneOption, summaryType, toneOption, translateOption, writerOutputLanguageOption } from './helper';

export const option = {
  translate: [
    {
      uiType: 'dropdown',
      options: [...translateOption],
      name: 'Output language',
      id: 'outputLanguage',
    },
    {
      uiType: 'dropdown',
      options: [
        {
          label: 'Auto',
          value: 'auto',
        },
        ...translateOption,
      ],
      defaultValue: 'auto',
      name: 'Input language',
      id: 'inputLanguage',
    },
  ],

  prompt: [...defaultOption],

  summarise: [
    ...defaultOption,
    ...summaryType,
    ...lengthOption,
    ...formatOption,
  ],

  write: [
    ...defaultOption,
    ...toneOption,
    ...lengthOption,
    ...formatOption,
    ...writerOutputLanguageOption,
  ],

  rewrite: [
    ...defaultOption,
    ...rewriterToneOption,
    ...rewriterLengthOption,
    ...rewriterFormatOption,
    ...writerOutputLanguageOption,
  ],
} as const;
