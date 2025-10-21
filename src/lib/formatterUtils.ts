/**
 * Utility functions for extraction, formatting, and export
 */

import type {
  Collection,
  CollectionType,
  ExportToMarkdownInput,
  ExportToMarkdownOutput,
  ExtractFromDataInput,
  ExtractFromUrlInput,
  ExtractOutput,
  FormatImageInput,
  FormatRecipeInput,
  ImageItem,
  Ingredient,
  Recipe,
  Site,
} from '@/types/formatter';

/**
 * Generate a unique ID
 */
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

/**
 * Extract data from URL using Claude AI
 */
export const extractFromUrl = async (input: ExtractFromUrlInput): Promise<ExtractOutput> => {
  const { url, type } = input;

  // Send message to background script to fetch URL content
  const response = await browser.runtime.sendMessage({
    action: 'fetchUrl',
    data: { url },
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to fetch URL');
  }

  // Extract data using Claude AI
  const extracted = await extractWithClaude({ content: response.content, type });

  return {
    title: extracted.title,
    url: url,
    data: extracted.data,
  };
};

/**
 * Extract and format data from pasted text using Claude AI
 */
export const extractFromData = async (input: ExtractFromDataInput): Promise<ExtractOutput> => {
  const { data, type } = input;

  // Extract data using Claude AI
  const extracted = await extractWithClaude({ content: data, type });

  return {
    title: extracted.title,
    url: undefined,
    data: extracted.data,
  };
};

/**
 * Extract data using Claude AI based on collection type
 */
const extractWithClaude = async (input: {
  content: string;
  type: CollectionType;
}): Promise<{ title: string; data: Recipe | { images: ImageItem[] } }> => {
  const { content, type } = input;

  // Send message to background script to extract with Claude
  const response = await browser.runtime.sendMessage({
    action: 'extractWithClaude',
    data: { content, type },
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to extract data');
  }

  return response.data;
};

/**
 * Format recipe data from raw text (fallback without AI)
 */
export const formatRecipeData = (input: FormatRecipeInput): ExtractOutput => {
  const { rawData, url } = input;

  const lines = rawData.split('\n').filter((line) => line.trim());

  const recipe: Recipe = {
    title: lines[0] || 'Untitled Recipe',
    main: [],
    optional: [],
    servings: undefined,
    ingredients: [],
  };

  // Simple parsing logic - look for common patterns
  let currentSection = '';

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    const lowerLine = line.toLowerCase();

    // Detect sections
    if (lowerLine.includes('serving') || lowerLine.includes('serves')) {
      const servingMatch = line.match(/(\d+)/);
      if (servingMatch) {
        recipe.servings = parseInt(servingMatch[1]);
      }
      continue;
    }

    if (lowerLine.startsWith('ingredients') || lowerLine === 'ingredients:') {
      currentSection = 'ingredients';
      continue;
    }

    if (lowerLine.startsWith('main') || lowerLine === 'main:') {
      currentSection = 'main';
      continue;
    }

    if (lowerLine.startsWith('optional') || lowerLine === 'optional:') {
      currentSection = 'optional';
      continue;
    }

    // Add to current section
    if (currentSection === 'ingredients') {
      const ingredient = parseIngredient(line);
      recipe.ingredients.push(ingredient);
    } else if (currentSection === 'main') {
      recipe.main.push(line);
    } else if (currentSection === 'optional') {
      recipe.optional?.push(line);
    }
  }

  return {
    title: recipe.title,
    url,
    data: recipe,
  };
};

/**
 * Parse a single ingredient line
 */
const parseIngredient = (line: string): Ingredient => {
  // Try to parse "amount unit name" pattern
  const match = line.match(/^([\d/.]+)?\s*([a-z]+)?\s*(.+)$/i);

  if (match) {
    const [, amount, unit, name] = match;
    return {
      amount: amount?.trim(),
      unit: unit?.trim(),
      name: name?.trim() || line,
    };
  }

  return {
    name: line,
  };
};

/**
 * Format image data from raw text (fallback without AI)
 */
export const formatImageData = (input: FormatImageInput): ExtractOutput => {
  const { rawData, url } = input;

  const lines = rawData.split('\n').filter((line) => line.trim());

  const images: ImageItem[] = [];
  let currentImage: Partial<ImageItem> = {};

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if it's a URL (image URL)
    if (trimmed.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)/i)) {
      if (currentImage.url) {
        images.push(currentImage as ImageItem);
      }
      currentImage = { url: trimmed, title: '' };
    }
    // Otherwise treat as title or alt text
    else if (currentImage.url) {
      if (!currentImage.title) {
        currentImage.title = trimmed;
      } else {
        currentImage.alt = trimmed;
      }
    }
  }

  // Add last image
  if (currentImage.url) {
    images.push(currentImage as ImageItem);
  }

  return {
    title: lines[0] || 'Image Collection',
    url,
    data: { images },
  };
};

/**
 * Create a site object from extracted data
 */
export const createSite = (extracted: ExtractOutput, type: CollectionType): Site => {
  const id = generateId();
  const addedAt = new Date().toISOString();

  if (type === 'recipe') {
    return {
      id,
      type: 'recipe',
      url: extracted.url,
      title: extracted.title,
      addedAt,
      data: extracted.data as Recipe,
    };
  } else {
    return {
      id,
      type: 'image',
      url: extracted.url,
      title: extracted.title,
      addedAt,
      data: extracted.data as { images: ImageItem[] },
    };
  }
};

/**
 * Export collection to markdown
 */
export const exportToMarkdown = (input: ExportToMarkdownInput): ExportToMarkdownOutput => {
  const { collection } = input;

  let markdown = `# ${collection.name}\n\n`;
  markdown += `Type: ${collection.type}\n`;
  markdown += `Created: ${new Date(collection.createdAt).toLocaleDateString()}\n`;
  markdown += `Sites: ${collection.sites.length}\n\n`;
  markdown += '---\n\n';

  for (const site of collection.sites) {
    markdown += `## ${site.title}\n\n`;

    if (site.url) {
      markdown += `**URL**: ${site.url}\n\n`;
    }

    if (site.type === 'recipe') {
      const recipe = site.data;

      if (recipe.servings) {
        markdown += `**Servings**: ${recipe.servings}\n\n`;
      }

      if (recipe.ingredients.length > 0) {
        markdown += '### Ingredients\n\n';
        for (const ingredient of recipe.ingredients) {
          const amount = ingredient.amount ? `${ingredient.amount} ` : '';
          const unit = ingredient.unit ? `${ingredient.unit} ` : '';
          markdown += `- ${amount}${unit}${ingredient.name}\n`;
        }
        markdown += '\n';
      }

      if (recipe.main.length > 0) {
        markdown += '### Main Steps\n\n';
        recipe.main.forEach((step, i) => {
          markdown += `${i + 1}. ${step}\n`;
        });
        markdown += '\n';
      }

      if (recipe.optional && recipe.optional.length > 0) {
        markdown += '### Optional Steps\n\n';
        recipe.optional.forEach((step, i) => {
          markdown += `${i + 1}. ${step}\n`;
        });
        markdown += '\n';
      }
    } else if (site.type === 'image') {
      const imageData = site.data;

      if (imageData.images.length > 0) {
        markdown += '### Images\n\n';
        for (const image of imageData.images) {
          const alt = image.alt || image.title;
          markdown += `![${alt}](${image.url})\n`;
          if (image.title) {
            markdown += `*${image.title}*\n`;
          }
          markdown += '\n';
        }
      }
    }

    markdown += '---\n\n';
  }

  const filename = `${collection.name.toLowerCase().replace(/\s+/g, '-')}.md`;

  return {
    markdown,
    filename,
  };
};

/**
 * Download markdown file
 */
export const downloadMarkdown = (output: ExportToMarkdownOutput): void => {
  const blob = new Blob([output.markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = output.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

