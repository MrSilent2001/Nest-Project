import { Injectable, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';

@Injectable()
export class HarrisSharpService {
  private readonly logger = new Logger(HarrisSharpService.name);

  @MessagePattern({ cmd: 'harris_corner' })
  async detectCorners(
      @Payload()
          data: {
        imagePath: string;
        k?: number;
        windowSize?: number;
        thresh?: number;
      },
  ) {
    const { imagePath, k = 0.04, windowSize = 3, thresh = 1e-5 } = data;
    if (!fs.existsSync(imagePath)) {
      return { error: 'Image not found', statusCode: 404 };
    }

    const input = fs.readFileSync(imagePath);
    const { data: buf, info } = await sharp(input)
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const { width, height } = info;
    const img = Float32Array.from(buf).map(v => v / 255);
    const idx = (x: number, y: number) => y * width + x;

    const Sx = [
      [-1, 0, 1],
      [-2, 0, 2],
      [-1, 0, 1],
    ];
    const Sy = [
      [-1, -2, -1],
      [ 0,  0,  0],
      [ 1,  2,  1],
    ];

    const convolve = (kernel: number[][]): Float32Array => {
      const out = new Float32Array(width * height);
      const kHalf = Math.floor(kernel.length / 2);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let sum = 0;
          for (let ky = -kHalf; ky <= kHalf; ky++) {
            for (let kx = -kHalf; kx <= kHalf; kx++) {
              const ix = x + kx;
              const iy = y + ky;
              if (ix >= 0 && iy >= 0 && ix < width && iy < height) {
                sum += kernel[ky + kHalf][kx + kHalf] * img[idx(ix, iy)];
              }
            }
          }
          out[idx(x, y)] = sum;
        }
      }
      return out;
    };

    const dx = convolve(Sx);
    const dy = convolve(Sy);

    const A = new Float32Array(width * height);
    const B = new Float32Array(width * height);
    const C = new Float32Array(width * height);
    for (let i = 0; i < A.length; i++) {
      A[i] = dx[i] * dx[i];
      B[i] = dy[i] * dy[i];
      C[i] = dx[i] * dy[i];
    }

    const boxBlur = (dataArr: Float32Array): Float32Array => {
      const out = new Float32Array(width * height);
      const w = windowSize;
      const r = Math.floor(w / 2);
      const area = w * w;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let sum = 0;
          for (let yy = -r; yy <= r; yy++) {
            for (let xx = -r; xx <= r; xx++) {
              const ix = x + xx;
              const iy = y + yy;
              if (ix >= 0 && iy >= 0 && ix < width && iy < height) {
                sum += dataArr[idx(ix, iy)];
              }
            }
          }
          out[idx(x, y)] = sum / area;
        }
      }
      return out;
    };

    const Sxx = boxBlur(A);
    const Syy = boxBlur(B);
    const Sxy = boxBlur(C);

    const R = new Float32Array(width * height);
    for (let i = 0; i < R.length; i++) {
      const det = Sxx[i] * Syy[i] - Sxy[i] * Sxy[i];
      const trace = Sxx[i] + Syy[i];
      R[i] = det - k * trace * trace;
    }

    const corners: { x: number; y: number; r: number }[] = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = idx(x, y);
        const val = R[i];
        const neighbors = [
          R[idx(x-1, y-1)], R[idx(x, y-1)], R[idx(x+1, y-1)],
          R[idx(x-1, y)],                 R[idx(x+1, y)],
          R[idx(x-1, y+1)], R[idx(x, y+1)], R[idx(x+1, y+1)],
        ];
        if (val > thresh && neighbors.every(n => val > n)) {
          corners.push({ x, y, r: val });
        }
      }
    }

    const outBuf = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const src = img[idx(x, y)] * 255;
        const dstIdx = (y * width + x) * 3;
        outBuf[dstIdx] = src;
        outBuf[dstIdx + 1] = src;
        outBuf[dstIdx + 2] = src;
      }
    }

    const circleRadius = 3;
    corners.forEach(pt => {
      for (let yy = -circleRadius; yy <= circleRadius; yy++) {
        for (let xx = -circleRadius; xx <= circleRadius; xx++) {
          const nx = pt.x + xx;
          const ny = pt.y + yy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
            const dist = Math.sqrt(xx * xx + yy * yy);
            if (dist <= circleRadius) {
              const d = (ny * width + nx) * 3;
              outBuf[d] = 0;
              outBuf[d + 1] = 255;
              outBuf[d + 2] = 0;
            }
          }
        }
      }
    });

    const outputDir = path.join(process.cwd(), 'apps/feature-detection/output_images');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outPath = path.join(outputDir, `harris_sharp_${path.basename(imagePath)}`);
    await sharp(outBuf, { raw: { width, height, channels: 3 } }).png().toFile(outPath);

    this.logger.log(`Detected ${corners.length} corners, saved to ${outPath}`);
    return { corners: corners.slice(0, 20), outputPath: outPath };
  }
}
