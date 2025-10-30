
export function base64ToFile(base64Data: string, filename = 'image.png') {
  const normalized = base64Data.startsWith('data:')
    ? base64Data
    : `data:image/png;base64,${base64Data}`;

  const [meta, dataPart = ''] = normalized.split(',');
  const mimeMatch = meta.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';

  const safeBase64 = (dataPart || meta)
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padded = safeBase64 + '='.repeat((4 - (safeBase64.length % 4)) % 4);

  let binaryString = '';
  try {
    binaryString = atob(padded);
  } catch (e) {
    try {
      binaryString = atob(decodeURIComponent(padded));
    } catch (e2) {
      throw new Error("Invalid base64 image data: can't decode");
    }
  }

  let n = binaryString.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = binaryString.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

export async function imageStringToFile(
  input: string,
  filename = 'image'
): Promise<File> {
  try {
    if (
      input.startsWith('data:') ||
      input.startsWith('blob:') ||
      input.startsWith('http')
    ) {
      const res = await fetch(input);
      const blob = await res.blob();
      const inferredType = blob.type || 'application/octet-stream';
      const inferredExt = inferredType.split('/')[1] || 'bin';
      const name = filename.includes('.')
        ? filename
        : `${filename}.${inferredExt}`;
      return new File([blob], name, { type: inferredType });
    }

    return base64ToFile(input, filename);
  } catch (e) {
    throw new Error('Failed to convert image string to File');
  }
}


export async function ensurePngFile(
  input: string | File,
  filename = 'image.png'
): Promise<File> {
  const file: File =
    typeof input === 'string'
      ? await imageStringToFile(input, filename)
      : input;

  if (file.type === 'image/png') {
    return file;
  }

  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error('Failed to load image for conversion'));
      image.src = blobUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');
    ctx.drawImage(img, 0, 0);

    const pngBlob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))),
        'image/png'
      );
    });

    return new File(
      [pngBlob],
      filename.endsWith('.png') ? filename : 'image.png',
      { type: 'image/png' }
    );
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}