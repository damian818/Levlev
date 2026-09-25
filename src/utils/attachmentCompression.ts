import { TransactionAttachment } from '../types';

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0
  targetFormat?: string; // default 'image/jpeg'
}

/**
 * Accurately calculate byte size of a base64 Data URL
 */
export function getBase64ByteLength(dataUrl: string): number {
  if (!dataUrl) return 0;
  const base64Index = dataUrl.indexOf(',');
  const base64Str = base64Index !== -1 ? dataUrl.substring(base64Index + 1) : dataUrl;
  const padding = (base64Str.match(/=*$/) || [''])[0].length;
  return Math.max(0, Math.floor((base64Str.length * 3) / 4) - padding);
}

/**
 * Format bytes into human-readable string (B, KB, MB)
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i === 0) return `${bytes} B`;
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Calculate reduction percentage between original and compressed size
 */
export function getReductionPercentage(originalSize?: number, compressedSize?: number): number {
  if (!originalSize || !compressedSize || originalSize <= compressedSize) return 0;
  return Math.round(((originalSize - compressedSize) / originalSize) * 100);
}

/**
 * Compress an image file using an offscreen canvas.
 * Resizes down to target dimensions (max 1280px by default) and recompresses with JPEG quality.
 * Preserves high legibility for receipts, invoices, and numbers while drastically reducing byte size.
 */
export async function compressImageFile(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<{ dataUrl: string; size: number; originalSize: number; type: string }> {
  const maxWidth = options.maxWidth || 1280;
  const maxHeight = options.maxHeight || 1280;
  const quality = options.quality !== undefined ? options.quality : 0.72;
  const targetFormat = options.targetFormat || 'image/jpeg';
  const originalSize = file.size;

  return new Promise((resolve) => {
    // Fallback reader if canvas is unavailable or image fails to load
    const fallbackToRawReader = () => {
      const reader = new FileReader();
      reader.onload = () => {
        const rawDataUrl = reader.result as string;
        resolve({
          dataUrl: rawDataUrl,
          size: getBase64ByteLength(rawDataUrl) || originalSize,
          originalSize,
          type: file.type || 'image/jpeg',
        });
      };
      reader.onerror = () => {
        resolve({
          dataUrl: '',
          size: 0,
          originalSize,
          type: file.type || 'image/jpeg',
        });
      };
      reader.readAsDataURL(file);
    };

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      fallbackToRawReader();
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height) {
          fallbackToRawReader();
          return;
        }

        // Scale down proportionally if larger than maximum bounds
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          fallbackToRawReader();
          return;
        }

        // High-quality image downsampling settings
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw white background for transparency (e.g. transparent PNG receipt screenshots)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to optimized JPEG data URL
        const compressedDataUrl = canvas.toDataURL(targetFormat, quality);
        const compressedSize = getBase64ByteLength(compressedDataUrl);

        // If compression resulted in smaller size than original, use it;
        // otherwise if original was already smaller and valid image, keep original
        if (compressedSize < originalSize) {
          resolve({
            dataUrl: compressedDataUrl,
            size: compressedSize,
            originalSize,
            type: targetFormat,
          });
        } else {
          // If original was already smaller, read as dataUrl directly
          const rawReader = new FileReader();
          rawReader.onload = () => {
            const rawUrl = rawReader.result as string;
            resolve({
              dataUrl: rawUrl,
              size: originalSize,
              originalSize,
              type: file.type || targetFormat,
            });
          };
          rawReader.readAsDataURL(file);
        }
      } catch (err) {
        console.warn('Canvas compression failed, falling back to raw file:', err);
        fallbackToRawReader();
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      fallbackToRawReader();
    };

    img.src = objectUrl;
  });
}

/**
 * Process any uploaded file (Images are compressed and reduced in size; PDFs are read with size checks)
 */
export async function processAttachmentFile(
  file: File,
  options?: ImageCompressionOptions
): Promise<TransactionAttachment> {
  const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(file.name);
  const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (isImage) {
    const result = await compressImageFile(file, options);
    return {
      id,
      name: file.name,
      size: result.size,
      originalSize: result.originalSize,
      type: result.type,
      dataUrl: result.dataUrl,
      uploadedAt: new Date().toISOString(),
    };
  }

  // Non-image files (PDFs, documents)
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const size = getBase64ByteLength(dataUrl) || file.size;
      resolve({
        id,
        name: file.name,
        size,
        originalSize: file.size,
        type: file.type || 'application/pdf',
        dataUrl,
        uploadedAt: new Date().toISOString(),
      });
    };
    reader.onerror = () => {
      resolve({
        id,
        name: file.name,
        size: file.size,
        originalSize: file.size,
        type: file.type || 'application/octet-stream',
        dataUrl: '',
        uploadedAt: new Date().toISOString(),
      });
    };
    reader.readAsDataURL(file);
  });
}
