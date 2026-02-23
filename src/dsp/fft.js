/**
 * FFT implementation (radix-2 Cooley-Tukey).
 * Input length must be a power of 2.
 */

const TWO_PI = 2 * Math.PI;

/**
 * Compute FFT of a real signal. Returns { magnitudes, frequencies }.
 * @param {Float64Array} signal
 * @param {number} sampleRate
 */
export function fftReal(signal, sampleRate) {
  const N = nextPow2(signal.length);
  // Zero-pad
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < signal.length; i++) re[i] = signal[i];

  fftInPlace(re, im, false);

  const half = N / 2;
  const magnitudes = new Float64Array(half);
  const frequencies = new Float64Array(half);
  const scale = 2 / N;

  for (let i = 0; i < half; i++) {
    magnitudes[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]) * scale;
    frequencies[i] = (i * sampleRate) / N;
  }

  return { magnitudes, frequencies };
}

/**
 * Compute FFT of complex I/Q signal. Returns { magnitudes, frequencies }.
 * Frequencies range from -sampleRate/2 to +sampleRate/2 (shifted).
 */
export function fftComplex(I, Q, sampleRate) {
  const N = nextPow2(I.length);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < I.length; i++) {
    re[i] = I[i];
    im[i] = Q[i];
  }

  fftInPlace(re, im, false);

  // FFT-shift: move DC to center
  const magnitudes = new Float64Array(N);
  const frequencies = new Float64Array(N);
  const scale = 1 / N;

  for (let i = 0; i < N; i++) {
    const shifted = (i + N / 2) % N;
    magnitudes[i] = Math.sqrt(re[shifted] * re[shifted] + im[shifted] * im[shifted]) * scale;
    frequencies[i] = ((i - N / 2) * sampleRate) / N;
  }

  return { magnitudes, frequencies };
}

/**
 * Convert magnitudes to dB scale (relative to max).
 */
export function toDb(magnitudes, floor = -80) {
  const max = Math.max(...magnitudes);
  const db = new Float64Array(magnitudes.length);
  for (let i = 0; i < magnitudes.length; i++) {
    const val = magnitudes[i] > 0 ? 20 * Math.log10(magnitudes[i] / max) : floor;
    db[i] = Math.max(val, floor);
  }
  return db;
}

// --- Internal helpers ---

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function fftInPlace(re, im, inverse) {
  const N = re.length;
  // Bit-reversal permutation
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  // Cooley-Tukey
  for (let len = 2; len <= N; len <<= 1) {
    const angle = (inverse ? TWO_PI : -TWO_PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);

    for (let i = 0; i < N; i += len) {
      let curRe = 1, curIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j;
        const b = i + j + len / 2;
        const tRe = curRe * re[b] - curIm * im[b];
        const tIm = curRe * im[b] + curIm * re[b];
        re[b] = re[a] - tRe;
        im[b] = im[a] - tIm;
        re[a] += tRe;
        im[a] += tIm;
        const newRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = newRe;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < N; i++) {
      re[i] /= N;
      im[i] /= N;
    }
  }
}
