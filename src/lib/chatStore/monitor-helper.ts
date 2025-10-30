import { Source } from "../dbSchema";
import { globalStorage } from "../globalStorage";

export async function monitorHelperSync({
  source,
  loaded,
  options,
  createdAt,
}: {
  source: Source;
  loaded: number; // 0 - 1
  createdAt: number;
  options: Record<string, any>;
}) {
  const key = genDownloadKey({ key: source, options });
  const uniqueKey = `${key}-${createdAt}`;

  const isDownloading = loaded < 1;

  const downloadStatus = await globalStorage().append({
    key: 'downloadStatus',
    value: {
      [uniqueKey]: {
        isDownloading,
        loaded,
        uniqueKey,
        source,
        createdAt,
      }
    }
  });
}


function genDownloadKey({ key, options }: { key: Source, options: Record<string, any> }) {
  switch (key) {
    case "prompt":
      return "prompt"
    case "summarize":
      return "summarizer"
    case "translator":
      return "translator"
    case "language-detector":
      return "language-detector"
    case "writer":
      return "writer"
    case "rewriter":
      return "rewriter"
    default:
      return key
  }
}