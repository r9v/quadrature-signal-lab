/**
 * Low-pass filter implementations.
 */

/**
 * Moving-average low-pass filter.
 * @param {Float64Array} signal
 * @param {number} windowSize - half-width of the averaging window
 * @returns {Float64Array}
 */
export function movingAverageLPF(signal, windowSize = 20) {
  const out = new Float64Array(signal.length);
  for (let i = 0; i < signal.length; i++) {
    let sum = 0;
    let count = 0;
    const lo = Math.max(0, i - windowSize);
    const hi = Math.min(signal.length - 1, i + windowSize);
    for (let j = lo; j <= hi; j++) {
      sum += signal[j];
      count++;
    }
    out[i] = sum / count;
  }
  return out;
}

/**
 * Windowed-sinc low-pass filter.
 * Sharper cutoff than moving average.
 * @param {Float64Array} signal
 * @param {number} cutoffFreq - cutoff frequency in Hz
 * @param {number} sampleRate
 * @param {number} taps - filter length (odd number, higher = sharper)
 * @returns {Float64Array}
 */
export function sincLPF(signal, cutoffFreq, sampleRate, taps = 101) {
  const fc = cutoffFreq / sampleRate;
  const halfTaps = Math.floor(taps / 2);
  const kernel = new Float64Array(taps);

  // Build windowed sinc kernel
  let sum = 0;
  for (let i = 0; i < taps; i++) {
    const n = i - halfTaps;
    if (n === 0) {
      kernel[i] = 2 * Math.PI * fc;
    } else {
      kernel[i] = Math.sin(2 * Math.PI * fc * n) / n;
    }
    // Blackman window
    kernel[i] *= 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (taps - 1))
      + 0.08 * Math.cos((4 * Math.PI * i) / (taps - 1));
    sum += kernel[i];
  }
  // Normalize
  for (let i = 0; i < taps; i++) kernel[i] /= sum;

  // Convolve
  const out = new Float64Array(signal.length);
  for (let i = 0; i < signal.length; i++) {
    let val = 0;
    for (let j = 0; j < taps; j++) {
      const idx = i - halfTaps + j;
      if (idx >= 0 && idx < signal.length) {
        val += signal[idx] * kernel[j];
      }
    }
    out[i] = val;
  }
  return out;
}
