/* eslint-disable prettier/prettier */
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
      const { width, height, channels } = metadata;

      if (!width || !height || !channels) {
        throw new Error('Invalid image metadata');
      }

      const rawData = await image.raw().toBuffer();
      const negativeBuffer = Buffer.alloc(rawData.length);

      for (let i = 0; i < rawData.length; i += channels) {
        negativeBuffer[i] = 255 - rawData[i];             // R
        negativeBuffer[i + 1] = 255 - rawData[i + 1];     // G
        negativeBuffer[i + 2] = 255 - rawData[i + 2];     // B

        if (channels === 4) {
          negativeBuffer[i + 3] = rawData[i + 3];         // A
        }
      }

      await sharp(negativeBuffer, {
        raw: {
          width,
          height,
          channels
        }
      })
          .png()
          .toFile(outputFilePath);

      // Return result
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
}
