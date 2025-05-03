/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import * as sharp from 'sharp';
import { MessagePattern } from '@nestjs/microservices';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RotateService {
  private rotatePixels(
      inputBuffer: Buffer,
      width: number,
      height: number,
      angle: number,
      channels: number
  ): { buffer: Buffer, newWidth: number, newHeight: number } {
    const radian = (angle * Math.PI) / 180;
    const isRightAngle = angle % 180 !== 0;

    const newWidth = isRightAngle ? height : width;
    const newHeight = isRightAngle ? width : height;

    const outputBuffer = Buffer.alloc(newWidth * newHeight * channels);

    const centerX = width / 2;
    const centerY = height / 2;
    const newCenterX = newWidth / 2;
    const newCenterY = newHeight / 2;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - centerX;
        const dy = y - centerY;

        const rotatedX = Math.round(dx * Math.cos(radian) - dy * Math.sin(radian) + newCenterX);
        const rotatedY = Math.round(dx * Math.sin(radian) + dy * Math.cos(radian) + newCenterY);

        if (
            rotatedX >= 0 && rotatedX < newWidth &&
            rotatedY >= 0 && rotatedY < newHeight
        ) {
          for (let c = 0; c < channels; c++) {
            const sourceIndex = (y * width + x) * channels + c;
            const targetIndex = (rotatedY * newWidth + rotatedX) * channels + c;
            outputBuffer[targetIndex] = inputBuffer[sourceIndex];
          }
        }
      }
    }

    return { buffer: outputBuffer, newWidth, newHeight };
  }

  @MessagePattern({ cmd: 'rotate_image' })
  async rotate(data: { imagePath: string; angle: number }) {
    try {
      const { imagePath, angle } = data;

      if (!fs.existsSync(imagePath)) {
        throw new Error('File does not exist');
      }

      const outputDir = path.join(process.cwd(), 'apps/basic-processing/output_images');
      const outputFileName = `rotated_${angle}_image.png`;
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

      const { buffer: rotatedBuffer, newWidth, newHeight } = this.rotatePixels(
          rawData, width, height, angle, channels
      );

      await sharp(rotatedBuffer, {
        raw: {
          width: newWidth,
          height: newHeight,
          channels
        }
      })
          .png()
          .toFile(outputFilePath);

      return {
        success: true,
        message: 'Image rotated successfully',
        savedImagePath: outputFilePath,
      };
    } catch (error) {
      console.error('Rotation error:', error);
      return {
        success: false,
        message: 'Failed to rotate image',
        error: error.message,
      };
    }
  }
}
