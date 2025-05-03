import * as sharp from 'sharp';

export async function convertToGreyscale(imagePath: string): Promise<{ buffer: Buffer, width: number, height: number }> {
  const { data, info } = await sharp(imagePath).raw().toBuffer({ resolveWithObject: true });

  const greyscaleBuffer = Buffer.alloc(info.width * info.height);

  for (let i = 0; i < info.width * info.height; i++) {
    // Calculate index for RGB values (assuming RGBA)
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];

    // Greyscale conversion using luminance formula (Y = 0.299R + 0.587G + 0.114B)
    const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

    // Store greyscale value (use a single channel for greyscale)
    greyscaleBuffer[i] = y;
  }

  return {
    buffer: greyscaleBuffer,
    width: info.width,
    height: info.height,
  };
}
