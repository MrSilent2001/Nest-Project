/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import * as sharp from 'sharp';
import { MessagePattern } from '@nestjs/microservices';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ResizeService {
  @MessagePattern({ cmd: 'resize_image' })
  async resize(data: { imagePath: string; width: number; height: number }) {
    try {
      const { imagePath, width, height } = data;

      if (!fs.existsSync(imagePath)) {
        throw new Error('File does not exist');
      }

      const outputDir = path.join(process.cwd(), 'apps/basic-processing/output_images');
      const outputFileName = 'resized_image.png';
      const outputFilePath = path.join(outputDir, outputFileName);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const inputImage = await fs.promises.readFile(imagePath);
      const { data: inputBuffer, info: inputInfo } = await sharp(inputImage).raw().toBuffer({ resolveWithObject: true });

      const resizedBuffer = this.bilinearInterpolation(
          inputBuffer,
          inputInfo.width,
          inputInfo.height,
          width,
          height,
          inputInfo.channels
      );

      // Save the resized image
      await sharp(resizedBuffer, {
        raw: {
          width: width,
          height: height,
          channels: inputInfo.channels,
        },
      })
          .png()
          .toFile(outputFilePath);

      return {
        success: true,
        message: 'Image resized successfully',
        savedImagePath: outputFilePath,
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private bilinearInterpolation(
      inputBuffer: Buffer,
      inputWidth: number,
      inputHeight: number,
      outputWidth: number,
      outputHeight: number,
      channels: number
  ): Buffer {
    const outputBuffer = Buffer.alloc(outputWidth * outputHeight * channels);

    const xRatio = inputWidth / outputWidth;
    const yRatio = inputHeight / outputHeight;

    for (let j = 0; j < outputHeight; j++) {
      for (let i = 0; i < outputWidth; i++) {
        const x = (i + 0.5) * xRatio - 0.5;
        const y = (j + 0.5) * yRatio - 0.5;

        const xL = Math.floor(Math.max(x, 0));
        const yT = Math.floor(Math.max(y, 0));
        const xH = Math.min(xL + 1, inputWidth - 1);
        const yB = Math.min(yT + 1, inputHeight - 1);

        const xWeight = x - xL;
        const yWeight = y - yT;

        for (let c = 0; c < channels; c++) {
          const topLeft = inputBuffer[(yT * inputWidth + xL) * channels + c];
          const topRight = inputBuffer[(yT * inputWidth + xH) * channels + c];
          const bottomLeft = inputBuffer[(yB * inputWidth + xL) * channels + c];
          const bottomRight = inputBuffer[(yB * inputWidth + xH) * channels + c];

          const top = topLeft + (topRight - topLeft) * xWeight;
          const bottom = bottomLeft + (bottomRight - bottomLeft) * xWeight;
          const value = top + (bottom - top) * yWeight;

          outputBuffer[(j * outputWidth + i) * channels + c] = value;
        }
      }
    }

    return outputBuffer;
  }
}
