export function applyConvolution(
    imageData: Buffer,
    width: number,
    height: number,
    channels: number,
    kernel: number[][]
): Buffer {
    const result = Buffer.alloc(imageData.length);

    const kernelSize = kernel.length;
    const half = Math.floor(kernelSize / 2);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            for (let c = 0; c < channels; c++) {
                let sum = 0;

                for (let ky = -half; ky <= half; ky++) {
                    for (let kx = -half; kx <= half; kx++) {
                        const posX = x + kx;
                        const posY = y + ky;

                        // Check if neighbor is inside image bounds
                        if (posX >= 0 && posX < width && posY >= 0 && posY < height) {
                            const pixelIndex = (posY * width + posX) * channels + c;
                            const weight = kernel[ky + half][kx + half];
                            sum += imageData[pixelIndex] * weight;
                        }
                    }
                }

                const finalValue = Math.round(Math.max(0, Math.min(255, sum)));
                const resultIndex = (y * width + x) * channels + c;
                result[resultIndex] = finalValue;
            }
        }
    }

    return result;
}
