import { defaultOption, formatOption, lengthOption, summaryType, toneOption, translateOption, writerOutputLanguageOption } from './helper';

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
        {...translateOption},
      ],
      defaultValue: 'auto',
      name: 'Input language',
      id: 'inputLanguage',
    },
  ],

  prompt: [{ ...defaultOption }],
  summarise: [
    {...defaultOption},
    {
      uiType: 'dropdown',
      name: 'Summary type',
      id: 'summaryType',
      options: {...summaryType},
    },
    {
      uiType: 'dropdown',
      name: 'Length',
      id: 'length',
      options: {...lengthOption},
    },
    {
      uiType: 'dropdown',
      name: 'Format',
      id: 'format',
      options: {...formatOption},
    }
  ],

  write: [
    {...defaultOption},
    {
      uiType: 'dropdown',
      name: 'Tone',
      id: 'tone',
      options: {...toneOption},
    },
    {
      uiType: 'dropdown',
      name: 'Length',
      id: 'length',
      options: {...lengthOption},
    },
    {
      uiType: 'dropdown',
      name: 'Format',
      id: 'format',
      options: {...formatOption},
    },
    {
      uiType: 'dropdown',
      name: 'Output Language',
      id: 'outputLanguage',
      options: {...writerOutputLanguageOption},
    },
  ],

  rewrite: [
    {...defaultOption},
    {
      uiType: 'dropdown',
      name: 'Tone',
      id: 'tone',
      options: {...toneOption},
    },
    {
      uiType: 'dropdown',
      name: 'Length',
      id: 'length',
      options: {...lengthOption},
    },
    {
      uiType: 'dropdown',
      name: 'Format',
      id: 'format',
      options: {...formatOption},
    },
    {
      uiType: 'dropdown',
      name: 'Output Language',
      id: 'outputLanguage',
      options: {...writerOutputLanguageOption},
    },
  ]
} as const;
