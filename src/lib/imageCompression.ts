/**
 * Image compression utility for reducing file size before upload
 */

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeMB?: number;
}

const MEGABYTE = 1024 * 1024;

function getFileExtension(file: File) {
  const match = file.name.match(/\.([^.]+)$/);
  return match?.[1]?.toLowerCase() || "jpg";
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to decode image"));
    };

    image.src = objectUrl;
  });
}

async function drawCompressedBlob(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Failed to get canvas context');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(source, 0, 0, width, height);

  const blob = await new Promise<Blob>((res, rej) => {
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error('Failed to compress image'))),
      'image/jpeg',
      quality
    );
  });

  canvas.width = 0;
  canvas.height = 0;

  return blob;
}

async function createResizedBitmap(file: File, width: number, height: number) {
  return createImageBitmap(file, {
    resizeWidth: width,
    resizeHeight: height,
    resizeQuality: 'high',
    imageOrientation: 'from-image',
  });
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.7,
  maxSizeMB: 0.4,
};

/**
 * Compresses an image file to reduce storage size and improve upload speed
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Promise<File> - The compressed image file
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (file.size <= opts.maxSizeMB * MEGABYTE) {
    return file;
  }

  let targetWidth = opts.maxWidth;
  let targetHeight = opts.maxHeight;
  let source: CanvasImageSource | null = null;
  let bitmap: ImageBitmap | null = null;

  try {
    try {
      bitmap = await createResizedBitmap(file, opts.maxWidth, opts.maxHeight);
      targetWidth = bitmap.width;
      targetHeight = bitmap.height;
      source = bitmap;
    } catch {
      const image = await loadImageElement(file);
      const aspectRatio = image.naturalWidth / image.naturalHeight;

      targetWidth = image.naturalWidth;
      targetHeight = image.naturalHeight;

      if (targetWidth > opts.maxWidth || targetHeight > opts.maxHeight) {
        if (targetWidth > targetHeight) {
          targetWidth = opts.maxWidth;
          targetHeight = Math.round(targetWidth / aspectRatio);
        } else {
          targetHeight = opts.maxHeight;
          targetWidth = Math.round(targetHeight * aspectRatio);
        }
      }

      source = image;
    }

    let finalBlob = await drawCompressedBlob(source, targetWidth, targetHeight, opts.quality);

    if (finalBlob.size > opts.maxSizeMB * MEGABYTE) {
      finalBlob = await drawCompressedBlob(
        source,
        Math.max(960, Math.round(targetWidth * 0.75)),
        Math.max(960, Math.round(targetHeight * 0.75)),
        Math.max(0.35, opts.quality - 0.25)
      );
    }

    const compressedFile = new File(
      [finalBlob],
      file.name.replace(/\.[^/.]+$/, '.jpg'),
      { type: 'image/jpeg', lastModified: Date.now() }
    );

    console.log(`Image compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB`);
    return compressedFile;
  } catch (error) {
    console.warn(`Image compression skipped for ${file.name}.${getFileExtension(file)}:`, error);
    return file;
  } finally {
    bitmap?.close();
  }
}
