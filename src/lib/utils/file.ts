// Convert base64 image to File before sending to the session
export function base64ToFile(base64Data: string, filename = 'image.png') {
  // Ensure we always have a data URL prefix for consistent parsing
  const normalized = base64Data.startsWith('data:')
    ? base64Data
    : `data:image/png;base64,${base64Data}`;

  const [meta, dataPart = ''] = normalized.split(',');
  const mimeMatch = meta.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';

  // Some providers return URL-safe base64 or missing padding; normalize it
  const safeBase64 = (dataPart || meta)
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padded = safeBase64 + '='.repeat((4 - (safeBase64.length % 4)) % 4);

  // Fallback-safe decode
  let binaryString = '';
  try {
    binaryString = atob(padded);
  } catch (e) {
    // If still failing, try decoding percent-encoded sequences
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

// Convert various image string inputs (data URL, blob URL, http URL, or raw base64)
// into a File. Uses fetch for URL-like inputs to avoid manual base64 decoding errors.
export async function imageStringToFile(
  input: string,
  filename = 'image'
): Promise<File> {
  try {
    // If it's a data URL or blob/http(s) URL, use fetch which handles both base64 and utf-8 data URLs
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

    // Fallback: treat as raw base64 (no data: prefix)
    return base64ToFile(input, filename);
  } catch (e) {
    throw new Error('Failed to convert image string to File');
  }
}

// Ensure the input image (string or File) is a PNG File by rasterizing via Canvas
export async function ensurePngFile(
  input: string | File,
  filename = 'image.png'
): Promise<File> {
  // First, get a Blob from input
  const file: File =
    typeof input === 'string'
      ? await imageStringToFile(input, filename)
      : input;

  // If it's already a PNG, return as-is
  if (file.type === 'image/png') {
    return file;
  }

  // Create an object URL and draw onto a canvas to rasterize (handles SVG/WebP/etc.)
  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      // Allow drawing cross-origin images; data/blob URLs are fine
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