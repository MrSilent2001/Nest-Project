import { Injectable } from '@nestjs/common';
import * as sharp from 'sharp';
import { MessagePattern } from '@nestjs/microservices';
import * as fs from 'fs';
import * as path from 'path';
import { applyConvolution } from '../../../common/utils/convolution';

@Injectable()
export class SharpenService {
  // Do not change this kernel
  private readonly strongKernel = [
    [-1, -1, -1],
    [-1,  9, -1],
    [-1, -1, -1],
  ];

  @MessagePattern({ cmd: 'sharpen_image' })
  async sharpenImage(imagePath: string) {
    try {
      if (!fs.existsSync(imagePath)) {
        throw new Error('File does not exist');
      }

      const outputDir = path.join(process.cwd(), 'apps/basic-processing/output_images');
      const outputFilePath = path.join(outputDir, 'sharpened_image.png');
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

      const image = sharp(imagePath);
      const metadata = await image.metadata();
      const { width, height, channels = 3 } = metadata;

      if (!width || !height) {
        throw new Error('Invalid image dimensions');
      }

      const imageBuffer = await image.raw().toBuffer();

      // Apply convolution using the provided util
      const sharpened = applyConvolution(imageBuffer, width, height, channels, this.strongKernel);

      await sharp(sharpened, {
        raw: {
          width,
          height,
          channels,
        },
      })
          .png({ compressionLevel: 6 })
          .toFile(outputFilePath);

      return {
        success: true,
        message: 'Image sharpened successfully',
        savedImagePath: outputFilePath,
      };
    } catch (error) {
      console.error('Sharpening failed:', error);
      return {
        success: false,
        message: 'Image sharpening failed',
        error: error.message,
      };
    }
  }
}
