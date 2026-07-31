export const MAX_RESUME_UPLOAD_BYTES = 8_000_000;

export const isUsableResumeText = (text: string) => text.replace(/\s/g, "").length >= 30;

export const readImageAsCompressedDataUrl = (file: File) =>
  new Promise<{ imageDataUrl: string; width: number; height: number }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const maxSide = 1900;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("IMAGE_CANVAS_UNAVAILABLE"));
        return;
      }
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      const imageDataUrl = [0.82, 0.7, 0.58, 0.46]
        .map((quality) => canvas.toDataURL("image/jpeg", quality))
        .find((candidate) => candidate.length <= 1_450_000)
        || canvas.toDataURL("image/jpeg", 0.38);
      resolve({ imageDataUrl, width: canvas.width, height: canvas.height });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("IMAGE_LOAD_FAILED"));
    };
    image.src = objectUrl;
  });
