/**
 * Web Worker for Off-Thread Image Compression
 * Converts raw high-res images to optimized WebP off the main UI thread.
 */

self.onmessage = async function (e) {
  const { id, file, maxDimension = 2560, quality = 0.85 } = e.data;

  try {
    if (!file || !file.type.startsWith("image/") || file.type === "image/svg+xml" || file.type === "image/gif") {
      self.postMessage({ id, success: true, blob: file, name: file.name });
      return;
    }

    // Decode image off-thread using createImageBitmap
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;

    // Calculate aspect-preserving dimensions
    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    // Use OffscreenCanvas if available
    if (typeof OffscreenCanvas !== "undefined") {
      const offscreen = new OffscreenCanvas(width, height);
      const ctx = offscreen.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();

      const blob = await offscreen.convertToBlob({
        type: "image/webp",
        quality: quality
      });

      const cleanName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
      self.postMessage({ id, success: true, blob, name: cleanName, width, height });
    } else {
      bitmap.close();
      self.postMessage({ id, success: false, error: "OffscreenCanvas not supported in worker" });
    }
  } catch (err) {
    self.postMessage({ id, success: false, error: err.message || String(err) });
  }
};
