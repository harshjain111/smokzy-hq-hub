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
        try {
          // Calculate new dimensions while maintaining aspect ratio
          let { width, height } = img;
          
          if (width > opts.maxWidth || height > opts.maxHeight) {
            const aspectRatio = width / height;
            
            if (width > height) {
              width = opts.maxWidth;
              height = width / aspectRatio;
            } else {
              height = opts.maxHeight;
              width = height * aspectRatio;
            }
          }

          // Create canvas and draw resized image
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Use better image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          ctx.drawImage(img, 0, 0, width, height);

          // Convert canvas to blob with compression
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }

              // Check if compressed size meets requirements
              const sizeMB = blob.size / (1024 * 1024);
              
              // If still too large, try with lower quality
              if (sizeMB > opts.maxSizeMB && opts.quality > 0.5) {
                const lowerQuality = Math.max(0.5, opts.quality - 0.1);
                canvas.toBlob(
                  (reBlob) => {
                    if (!reBlob) {
                      reject(new Error('Failed to re-compress image'));
                      return;
                    }
                    
                    const compressedFile = new File(
                      [reBlob],
                      file.name.replace(/\.[^/.]+$/, '.jpg'),
                      { type: 'image/jpeg' }
                    );
                    
                    console.log(`Image compressed: ${(file.size / 1024).toFixed(2)}KB → ${(compressedFile.size / 1024).toFixed(2)}KB`);
                    resolve(compressedFile);
                  },
                  'image/jpeg',
                  lowerQuality
                );
              } else {
                const compressedFile = new File(
                  [blob],
                  file.name.replace(/\.[^/.]+$/, '.jpg'),
                  { type: 'image/jpeg' }
                );
                
                console.log(`Image compressed: ${(file.size / 1024).toFixed(2)}KB → ${(compressedFile.size / 1024).toFixed(2)}KB`);
                resolve(compressedFile);
              }
            },
            'image/jpeg',
            opts.quality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}
