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
}: {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
}) => `Translate the following text ${sourceLanguage !== 'auto' ? `from ${sourceLanguage} ` : ''}to ${targetLanguage}. Preserve meaning and tone.\n---\n${text}`;

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
}: {
  text: string;
  tone?: string;
  format?: string;
  length?: string;
  outputLanguage?: string;
}) => `Rewrite the text with tone=${tone}, length=${length}, format=${format}${outputLanguage ? `, language=${outputLanguage}` : ''}. Keep original meaning.\n---\n${text}`;
