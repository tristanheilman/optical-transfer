// Minimal typings for `omggif` (no bundled types).
declare module "omggif" {
  export interface GifWriterOptions {
    loop?: number;
    palette?: number[] | null;
    background?: number;
  }
  export interface GifFrameOptions {
    palette?: number[] | null;
    delay?: number; // hundredths of a second
    disposal?: number;
    transparent?: number;
  }
  export class GifWriter {
    constructor(buf: Uint8Array, width: number, height: number, gopts?: GifWriterOptions);
    addFrame(
      x: number,
      y: number,
      w: number,
      h: number,
      indexedPixels: ArrayLike<number>,
      opts?: GifFrameOptions,
    ): number;
    end(): number;
  }
  export class GifReader {
    constructor(buf: Uint8Array);
    width: number;
    height: number;
    numFrames(): number;
    loopCount(): number;
    frameInfo(index: number): {
      x: number;
      y: number;
      width: number;
      height: number;
      delay: number;
      disposal: number;
    };
    decodeAndBlitFrameRGBA(index: number, pixels: Uint8Array | Uint8ClampedArray): void;
  }
  const omggif: { GifWriter: typeof GifWriter; GifReader: typeof GifReader };
  export default omggif;
}
