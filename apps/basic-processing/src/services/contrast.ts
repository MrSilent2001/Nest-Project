/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import * as sharp from 'sharp';
import { MessagePattern } from '@nestjs/microservices';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ContrastService {
  private applyContrast(
      imageData: Buffer,
      width: number,
      height: number,
      channels: number,
      contrast: number // in percentage: -100 to 100
  ): Buffer {
    const result = Buffer.alloc(imageData.length);

    // Convert percentage to factor: -100..100 → 0..4 (0.0 no contrast, 1 normal, >1 high)
    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * channels;
        for (let c = 0; c < channels; c++) {
          const componentIndex = pixelIndex + c;
          const pixelValue = imageData[componentIndex];
          const adjustedValue = contrastFactor * (pixelValue - 128) + 128;
          result[componentIndex] = Math.max(0, Math.min(255, Math.round(adjustedValue)));
        }
      }
    }
    return result;
  }

  @MessagePattern({ cmd: 'adjust_contrast' })
  async adjust(data: { imagePath: string; contrast: number }) {
    try {
      const { imagePath, contrast } = data;

      if (!fs.existsSync(imagePath)) {
        throw new Error('File does not exist');
      }

      const outputDir = path.join(process.cwd(), 'apps/basic-processing/output_images');
      const originalName = path.basename(imagePath, path.extname(imagePath));
      const outputFileName = `contrast_${contrast}_${originalName}.png`;
      const outputFilePath = path.join(outputDir, outputFileName);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const image = sharp(imagePath);
      const metadata = await image.metadata();
      const { width, height, channels } = metadata;

      const rawData = await image.raw().toBuffer();

      const contrastedBuffer = this.applyContrast(
          rawData,
          width!,
          height!,
          channels || 3,
          contrast // use -255 to +255
      );

      await sharp(contrastedBuffer, {
        raw: {
          width: width!,
          height: height!,
          channels: channels || 3,
        },
      })
          .png()
          .toFile(outputFilePath);

      return {
        success: true,
        message: 'Contrast adjusted successfully',
        savedImagePath: outputFilePath,
      };
    } catch (error) {
      console.error('Contrast adjustment error:', error);
      return {
        success: false,
        message: 'Failed to adjust contrast',
        error: error.message,
      };
    }
  }
}
