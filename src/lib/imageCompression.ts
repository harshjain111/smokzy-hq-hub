/**
 * Image compression utility for reducing file size before upload
 */

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeMB?: number;
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
  maxSizeMB: 1,
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

  // Use createImageBitmap + canvas for memory-efficient processing
  // Avoids FileReader.readAsDataURL which doubles memory for large files
  const bitmap = await createImageBitmap(file);

  try {
    let { width, height } = bitmap;

    if (width > opts.maxWidth || height > opts.maxHeight) {
      const aspectRatio = width / height;
      if (width > height) {
        width = opts.maxWidth;
        height = Math.round(width / aspectRatio);
      } else {
        height = opts.maxHeight;
        width = Math.round(height * aspectRatio);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);

    // Release bitmap memory immediately
    bitmap.close();

    const blob = await new Promise<Blob>((res, rej) => {
      canvas.toBlob(
        (b) => (b ? res(b) : rej(new Error('Failed to compress image'))),
        'image/jpeg',
        opts.quality
      );
    });

    // If still too large, retry with lower quality
    let finalBlob = blob;
    if (blob.size / (1024 * 1024) > opts.maxSizeMB && opts.quality > 0.4) {
      finalBlob = await new Promise<Blob>((res, rej) => {
        canvas.toBlob(
          (b) => (b ? res(b) : rej(new Error('Re-compress failed'))),
          'image/jpeg',
          Math.max(0.3, opts.quality - 0.2)
        );
      });
    }

    // Release canvas memory
    canvas.width = 0;
    canvas.height = 0;

    const compressedFile = new File(
      [finalBlob],
      file.name.replace(/\.[^/.]+$/, '.jpg'),
      { type: 'image/jpeg' }
    );

    console.log(`Image compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB`);
    return compressedFile;
  } catch (error) {
    bitmap.close();
    throw error;
  }
}
