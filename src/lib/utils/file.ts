// Convert base64 image to File before sending to the session
export function base64ToFile(base64Data: string, filename = 'image.png') {

  base64Data = base64Data.startsWith('data:')
  ? base64Data
  : `data:image/png;base64,${base64Data}`

  const arr = base64Data.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr.length > 1 ? arr[1] : arr[0]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}