export type ImageAspect = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

export interface GeneratedImage {
  /** Raw base64 (no data: prefix). */
  b64: string;
  mime: string;
}

export interface ImageProvider {
  generateImage(prompt: string, aspect?: ImageAspect): Promise<GeneratedImage>;
}

export class ImageGenerationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ImageGenerationError";
  }
}
