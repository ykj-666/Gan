// Client-side image utilities

/**
 * Compress and resize an image file to a target max dimension.
 * Returns a base64 data URL.
 */
export function compressImage(
  file: File,
  maxWidth = 400,
  maxHeight = 400,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxWidth) {
            h *= maxWidth / w;
            w = maxWidth;
          }
        } else {
          if (h > maxHeight) {
            w *= maxHeight / h;
            h = maxHeight;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context not available"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Generate an AI avatar using the backend API.
 */
export async function generate_image(params: {
  description: string;
  output_file: string;
  ratio?: "1:1" | "3:2" | "2:3";
  resolution?: "1K" | "2K";
}): Promise<string | null> {
  try {
    const resp = await fetch("/api/trpc/user.generateAvatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: { prompt: params.description },
      }),
    });
    const data = await resp.json();
    return data.result?.data?.json?.url ?? null;
  } catch {
    return null;
  }
}
