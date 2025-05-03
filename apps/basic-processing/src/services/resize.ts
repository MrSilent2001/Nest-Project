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

      // Read the image as raw buffer and get its info
      const inputImage = await fs.promises.readFile(imagePath);
      const { data: inputBuffer, info: inputInfo } = await sharp(inputImage)
          .raw()
          .toBuffer({ resolveWithObject: true });

      // Perform bilinear interpolation resizing
      const resizedBuffer = this.bilinearInterpolation(
          inputBuffer,
          inputInfo.width,
          inputInfo.height,
          width,
          height,
          inputInfo.channels,
      );

      // Save the resized image as PNG
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
      channels: number,
  ): Buffer {
    const outputBuffer = Buffer.alloc(outputWidth * outputHeight * channels);

    for (let y = 0; y < outputHeight; y++) {
      const srcY = (y / (outputHeight - 1)) * (inputHeight - 1);
      const y0 = Math.floor(srcY);
      const y1 = Math.min(y0 + 1, inputHeight - 1);
      const dy = srcY - y0;

      for (let x = 0; x < outputWidth; x++) {
        const srcX = (x / (outputWidth - 1)) * (inputWidth - 1);
        const x0 = Math.floor(srcX);
        const x1 = Math.min(x0 + 1, inputWidth - 1);
        const dx = srcX - x0;

        for (let c = 0; c < channels; c++) {
          const i00 = inputBuffer[(y0 * inputWidth + x0) * channels + c];
          const i10 = inputBuffer[(y0 * inputWidth + x1) * channels + c];
          const i01 = inputBuffer[(y1 * inputWidth + x0) * channels + c];
          const i11 = inputBuffer[(y1 * inputWidth + x1) * channels + c];

          const i0 = i00 * (1 - dx) + i10 * dx;
          const i1 = i01 * (1 - dx) + i11 * dx;
          const value = i0 * (1 - dy) + i1 * dy;

          outputBuffer[(y * outputWidth + x) * channels + c] = value;
        }
      }
    }

    return outputBuffer;
  }
}
