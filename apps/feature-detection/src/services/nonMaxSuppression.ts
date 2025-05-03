export function nonMaxSuppression(magnitude: Float32Array, direction: Float32Array, width: number, height: number) {
  const output = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const angle = ((direction[idx] * 180) / Math.PI + 180) % 180;
      const mag = magnitude[idx];

      let neighbor1 = 0, neighbor2 = 0;

      if ((0 <= angle && angle < 22.5) || (157.5 <= angle && angle <= 180)) {
        neighbor1 = magnitude[y * width + (x + 1)];
        neighbor2 = magnitude[y * width + (x - 1)];
      } else if (22.5 <= angle && angle < 67.5) {
        neighbor1 = magnitude[(y + 1) * width + (x - 1)];
        neighbor2 = magnitude[(y - 1) * width + (x + 1)];
      } else if (67.5 <= angle && angle < 112.5) {
        neighbor1 = magnitude[(y + 1) * width + x];
        neighbor2 = magnitude[(y - 1) * width + x];
      } else if (112.5 <= angle && angle < 157.5) {
        neighbor1 = magnitude[(y - 1) * width + (x - 1)];
        neighbor2 = magnitude[(y + 1) * width + (x + 1)];
      }

      if (mag >= neighbor1 && mag >= neighbor2) {
        output[idx] = mag;
      } else {
        output[idx] = 0;
      }
    }
  }

  return output;
}
