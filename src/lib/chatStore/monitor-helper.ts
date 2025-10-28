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
  const downloadStatus = await globalStorage().append({
    key: 'downloadStatus',
    value: {
      [`${key}-en`]: {
        isDownloading: loaded > 0 ? true : loaded < 1 ? false : undefined,
        loaded,
        uniqueKey: `${key}-${"unique"}`,
        source,
        createdAt,
      }
    }
  });
  console.debug('downloading ${key} ${progress}%', downloadStatus);
}


function genDownloadKey({ key, options }: { key: Source, options: Record<string, any> }) {
  console.log({ options })
  switch (key) {
    case "prompt":
      return "prompt"
    // case "writer"
    //   return "writer"
    default:
      return key
  }
}