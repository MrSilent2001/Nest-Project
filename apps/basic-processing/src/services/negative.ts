import { Injectable } from '@nestjs/common';
import * as sharp from 'sharp';
import { MessagePattern } from '@nestjs/microservices';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class NegativeService {
  @MessagePattern({ cmd: 'create_negative' })
  async createNegative(imagePath: string) {
    try {
      if (!fs.existsSync(imagePath)) {
        throw new Error('File does not exist');
      }

      const outputDir = path.join(process.cwd(), 'apps/basic-processing/output_images');
      const outputFileName = 'negative_image.png';
      const outputFilePath = path.join(outputDir, outputFileName);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const image = sharp(imagePath);
      const metadata = await image.metadata();
      const { width, height, channels = 3 } = metadata;  // Assuming RGB

      if (!width || !height || channels < 3) {
        throw new Error('Invalid image dimensions or channels');
      }

      const rawData = await image.raw().toBuffer();
      const negativeBuffer = this.createNegativeBuffer(rawData, width, height, channels);

      await sharp(negativeBuffer, {
        raw: {
          width,
          height,
          channels,
        },
      })
          .png()
          .toFile(outputFilePath);

      return {
        success: true,
        message: 'Negative image created successfully',
        savedImagePath: outputFilePath,
      };
    } catch (error) {
      console.error('Negative image creation error:', error);
      return {
        success: false,
        message: 'Failed to process image',
        error: error.message,
      };
    }
  }

  // Function to create negative image by inverting pixel values
  private createNegativeBuffer(
      imageData: Buffer,
      width: number,
      height: number,
      channels: number
  ): Buffer {
    const result = Buffer.alloc(imageData.length);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        for (let c = 0; c < channels; c++) {
          const pixelIndex = (y * width + x) * channels + c;
          const pixelValue = imageData[pixelIndex];
          result[pixelIndex] = 255 - pixelValue; // Invert the pixel value
        }
      }
    }

    return result;
  }
}
