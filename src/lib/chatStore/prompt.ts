export const systemPrompt = ({
  pageContext,
}: {
  pageContext: string;
}) => `You are a helpful AI assistant embedded in a browser extension. Your name is "Helix". You have access to the current page's content and can answer questions about it. So answer questions based on the page content.
Your capabilities:
• Answer questions about the page content
• If the question isn't related to the page, provide a brief general answer
Current Page Content:
---
${pageContext.substring(0, 2000)}
---
When answering, prioritize information from the page content above.

`;

export const buildSummarizePrompt = ({
  text,
  type = 'tldr',
  format = 'markdown',
  length = 'short',
  pageContext,
}: {
  text: string;
  type?: 'keyPoints' | 'tldr' | 'teaser' | 'headline';
  format?: 'markdown' | 'plain-text';
  length?: 'short' | 'medium' | 'long';
  pageContext?: string;
}) => {
  const instructions = `Summarize the following content.
Type: ${type}
Length: ${length}
Format: ${format}
`;
  const context = pageContext ? `\nContext from page:\n${pageContext.substring(0, 2000)}` : '';
  return `${instructions}${context}\n---\n${text}`;
};

export const buildTranslatePrompt = ({
  text,
  sourceLanguage = 'auto',
  targetLanguage = 'en',
  pageContext,
}: {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  pageContext?: string;
}) => {
  const ctx = pageContext ? `\nUse this page context if relevant:\n${pageContext.substring(0, 1500)}` : '';
  return `Translate the following text ${sourceLanguage !== 'auto' ? `from ${sourceLanguage} ` : ''}to ${targetLanguage}. Preserve meaning and tone.${ctx}\n---\n${text}`;
};

export const buildWritePrompt = ({
  text,
  tone = 'neutral',
  format = 'plain-text',
  length = 'medium',
  outputLanguage,
  pageContext,
}: {
  text: string;
  tone?: string;
  format?: string;
  length?: string;
  outputLanguage?: string;
  pageContext?: string;
}) => {
  const ctx = pageContext ? `\nUse this page context if relevant:\n${pageContext.substring(0, 2000)}` : '';
  return `Write content with tone=${tone}, length=${length}, format=${format}${outputLanguage ? `, language=${outputLanguage}` : ''}.${ctx}\n---\n${text}`;
};

export const buildRewritePrompt = ({
  text,
  tone = 'as-is',
  format = 'as-is',
  length = 'as-is',
  outputLanguage,
  pageContext,
}: {
  text: string;
  tone?: string;
  format?: string;
  length?: string;
  outputLanguage?: string;
  pageContext?: string;
}) => {
  const ctx = pageContext ? `\nUse this page context if helpful:\n${pageContext.substring(0, 1500)}` : '';
  return `Rewrite the text with tone=${tone}, length=${length}, format=${format}${outputLanguage ? `, language=${outputLanguage}` : ''}. Keep original meaning.${ctx}\n---\n${text}`;
};

// Fallback system prompts for when built-in APIs are unavailable
export const writerFallbackSystemPrompt =
  'You are a writer, please check the user query and write a sentence';

export const rewriterFallbackSystemPrompt =
  'You are a rewriter, please check the user query and rewrite a sentence';

export const proofreaderFallbackSystemPrompt =
  'You are a proofreader, please check the user query and proofread a sentence';

export const languageDetectorFallbackSystemPrompt =
  'You are a language detector, please check the user query and detect language of a sentence';