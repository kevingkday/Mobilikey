const MAX_DIMENSION = 256;
const MAX_DATA_URL_LENGTH = 190_000;

/**
 * Reads an image file from the user's device and returns a compact data URL
 * suitable for storing as a company logo or avatar.
 */
export async function readImageFileAsDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select an image file (PNG, JPG, WebP, GIF, or SVG).');
  }

  // Allow small SVG files directly
  if (file.type === 'image/svg+xml') {
    const raw = await fileToDataUrl(file);
    if (raw.length > MAX_DATA_URL_LENGTH) {
      throw new Error('SVG file is too large. Please choose an image under 140 KB.');
    }
    return raw;
  }

  const rawDataUrl = await fileToDataUrl(file);
  const img = await loadImage(rawDataUrl);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not process image in this browser.');
  }

  ctx.drawImage(img, 0, 0, width, height);

  // Prefer PNG to preserve transparency for logos; fall back to compressed WebP/JPEG if large
  let output = canvas.toDataURL('image/png');
  if (output.length > MAX_DATA_URL_LENGTH) {
    output = canvas.toDataURL('image/webp', 0.85);
  }
  if (output.length > MAX_DATA_URL_LENGTH) {
    output = canvas.toDataURL('image/jpeg', 0.82);
  }
  if (output.length > MAX_DATA_URL_LENGTH) {
    throw new Error('Image is still too large after resizing. Please choose a simpler image.');
  }

  return output;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read selected file.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read selected file.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode selected image.'));
    img.src = src;
  });
}
