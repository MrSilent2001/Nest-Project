import * as sharp from 'sharp';

/**
 * Converts an image at the given path to greyscale using standard luminance formula
 * and returns the resulting buffer and image dimensions.
 */
export async function convertToGreyscale(imagePath: string): Promise<{ buffer: Buffer, width: number, height: number }> {
  const { data, info } = await sharp(imagePath)
      .raw()
      .toBuffer({ resolveWithObject: true });

  const greyscaleBuffer = Buffer.alloc(info.width * info.height); // Only one channel for grayscale

  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

    greyscaleBuffer[i / info.channels] = y;
  }

  return {
    buffer: greyscaleBuffer,
    width: info.width,
    height: info.height,
  };
}
