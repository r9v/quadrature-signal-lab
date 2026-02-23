/**
 * Digital filters for I/Q processing.
 */

/**
 * Simple moving average low-pass filter.
 * @param {Float64Array} signal - input signal
 * @param {number} taps - number of taps (window size)
 * @returns {Float64Array} filtered signal
 */
export function movingAverageLPF(signal, taps = 15) {
  const output = new Float64Array(signal.length);
  const halfTaps = Math.floor(taps / 2);

  for (let i = 0; i < signal.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = -halfTaps; j <= halfTaps; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < signal.length) {
        sum += signal[idx];
        count++;
      }
    }
    output[i] = sum / count;
  }

  return output;
}

/**
 * Windowed sinc low-pass filter (FIR).
 * More accurate than moving average, better frequency response.
 * @param {Float64Array} signal - input signal
 * @param {number} cutoffNormalized - cutoff frequency as fraction of sample rate (0 to 0.5)
 * @param {number} taps - number of filter taps (odd number recommended)
 * @returns {Float64Array}
 */
export function sincLPF(signal, cutoffNormalized = 0.1, taps = 31) {
  // Generate sinc filter kernel with Hamming window
  const kernel = new Float64Array(taps);
  const halfTaps = Math.floor(taps / 2);
  let sum = 0;

  for (let i = 0; i < taps; i++) {
    const n = i - halfTaps;
    if (n === 0) {
      kernel[i] = 2 * cutoffNormalized;
    } else {
      kernel[i] =
        Math.sin(2 * Math.PI * cutoffNormalized * n) / (Math.PI * n);
    }
    // Hamming window
    kernel[i] *= 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (taps - 1));
    sum += kernel[i];
  }

  // Normalize
  for (let i = 0; i < taps; i++) {
    kernel[i] /= sum;
  }

  // Convolve
  const output = new Float64Array(signal.length);
  for (let i = 0; i < signal.length; i++) {
    let val = 0;
    for (let j = 0; j < taps; j++) {
      const idx = i - halfTaps + j;
      if (idx >= 0 && idx < signal.length) {
        val += signal[idx] * kernel[j];
      }
    }
    output[i] = val;
  }

  return output;
}
