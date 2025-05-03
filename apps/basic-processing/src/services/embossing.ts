import { Injectable } from '@nestjs/common';
import * as sharp from 'sharp';
import { MessagePattern } from '@nestjs/microservices';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EmbossService {
  private readonly customKernel = [
    [-2, -1,  0],
    [-1,  1,  1],
    [ 0,  1,  2]
  ];

  private applyKernel(
      imageData: Buffer,
      width: number,
      height: number,
      channels: number
  ): Buffer {
    const result = Buffer.alloc(imageData.length);
    const kernelSize = 3;
    const offset = Math.floor(kernelSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        for (let c = 0; c < channels; c++) {
          let sum = 0;

          for (let ky = 0; ky < kernelSize; ky++) {
            for (let kx = 0; kx < kernelSize; kx++) {
              const px = Math.max(Math.min(x + kx - offset, width - 1), 0);
              const py = Math.max(Math.min(y + ky - offset, height - 1), 0);
              const weight = this.customKernel[ky][kx];
              const sourceIndex = (py * width + px) * channels + c;
              sum += imageData[sourceIndex] * weight;
            }
          }

          const index = (y * width + x) * channels + c;
          result[index] = Math.min(255, Math.max(0, Math.round(sum + 128)));
        }
      }
    }

    return result;
  }

  @MessagePattern({ cmd: 'emboss_image' })
  async embossImage(imagePath: string) {
    try {
      if (!fs.existsSync(imagePath)) {
        throw new Error('File does not exist');
      }

      const outputDir = path.join(process.cwd(), 'apps/basic-processing/output_images');
      const outputFile = path.join(outputDir, 'emboss_image.png');
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

      const image = sharp(imagePath);
      const metadata = await image.metadata();
      const { width, height, channels = 3 } = metadata;
      const imageBuffer = await image.raw().toBuffer();

      const filtered = this.applyKernel(imageBuffer, width!, height!, channels);

      await sharp(filtered, {
        raw: {
          width: width!,
          height: height!,
          channels,
        },
      })
          .png()
          .toFile(outputFile);

      return {
        success: true,
        message: 'Image embossed successfully',
        savedImagePath: outputFile,
      };
    } catch (err) {
      return {
        success: false,
        message: 'Failed to apply emboss filter',
        error: err.message,
      };
    }
  }
}
