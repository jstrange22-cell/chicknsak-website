/**
 * Maximum canvas pixels for iOS Safari to avoid silent failures.
 * iOS Safari caps around 16.7 megapixels for canvas.
 * We use a conservative 16MP limit.
 */
const MAX_CANVAS_PIXELS = 16_000_000;

/**
 * Timeout (ms) for image processing operations.
 * Prevents hanging promises when canvas.toBlob silently fails.
 */
const IMAGE_PROCESSING_TIMEOUT_MS = 30_000;

/**
 * Wrap a promise with a timeout so it never hangs indefinitely.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms. This may happen on devices with limited memory.`));
    }, ms);

    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

/**
 * Calculate dimensions that fit within both maxWidth and the iOS canvas pixel limit.
 */
function calcSafeDimensions(
  srcWidth: number,
  srcHeight: number,
  maxWidth: number
): { width: number; height: number } {
  let width = srcWidth;
  let height = srcHeight;

  // Scale down to maxWidth first
  if (width > maxWidth) {
    height = (height * maxWidth) / width;
    width = maxWidth;
  }

  // Then enforce the total-pixel cap for iOS Safari
  const totalPixels = width * height;
  if (totalPixels > MAX_CANVAS_PIXELS) {
    const scale = Math.sqrt(MAX_CANVAS_PIXELS / totalPixels);
    width = Math.floor(width * scale);
    height = Math.floor(height * scale);
  }

  return { width, height };
}

/**
 * Compress an image to a maximum width while maintaining aspect ratio.
 * Includes iOS Safari canvas-size safety, Object URL cleanup, and a timeout
 * to prevent silently hanging on certain devices.
 */
export async function compressImage(
  file: Blob,
  maxWidth: number = 2048,
  quality: number = 0.8
): Promise<Blob> {
  const inner = new Promise<Blob>((resolve, reject) => {
    let objectUrl: string | null = null;

    const cleanup = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    const img = new Image();

    img.onload = () => {
      try {
        const { width, height } = calcSafeDimensions(img.naturalWidth, img.naturalHeight, maxWidth);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          reject(new Error('Failed to get canvas 2D context. Your browser may not support this operation.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        cleanup(); // Release the object URL as soon as drawing is done

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error(
                'Failed to compress image (canvas.toBlob returned null). '
                + 'This can happen on iOS Safari with very large photos. '
                + `Image was ${img.naturalWidth}x${img.naturalHeight}, canvas was ${width}x${height}.`
              ));
            }
          },
          'image/jpeg',
          quality
        );
      } catch (err) {
        cleanup();
        reject(new Error(`Image compression error: ${err instanceof Error ? err.message : String(err)}`));
      }
    };

    img.onerror = () => {
      cleanup();
      reject(new Error('Failed to load image for compression. The file may be corrupted or in an unsupported format.'));
    };

    objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
  });

  return withTimeout(inner, IMAGE_PROCESSING_TIMEOUT_MS, 'Image compression');
}

/**
 * Generate a thumbnail from an image
 */
export async function generateThumbnail(
  file: Blob,
  maxWidth: number = 400,
  quality: number = 0.6
): Promise<Blob> {
  return compressImage(file, maxWidth, quality);
}

/**
 * Get image dimensions with proper cleanup and timeout
 */
export async function getImageDimensions(
  file: Blob
): Promise<{ width: number; height: number }> {
  const inner = new Promise<{ width: number; height: number }>((resolve, reject) => {
    let objectUrl: string | null = null;

    const cleanup = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    const img = new Image();
    img.onload = () => {
      const result = { width: img.naturalWidth, height: img.naturalHeight };
      cleanup();
      resolve(result);
    };
    img.onerror = () => {
      cleanup();
      reject(new Error('Failed to load image for dimension detection.'));
    };

    objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
  });

  return withTimeout(inner, IMAGE_PROCESSING_TIMEOUT_MS, 'Image dimension detection');
}

/**
 * Convert a data URL to a Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Generate a unique filename
 */
export function generateFilename(extension: string = 'jpg'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}.${extension}`;
}
