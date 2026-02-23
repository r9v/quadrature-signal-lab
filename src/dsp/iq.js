/**
 * Core I/Q (Quadrature) signal processing functions.
 *
 * Quadrature sampling decomposes a real signal into two orthogonal components:
 *   I (In-phase)    = signal * cos(2π·fc·t)  → then low-pass filtered
 *   Q (Quadrature)  = signal * -sin(2π·fc·t) → then low-pass filtered
 *
 * Reconstruction (upconversion):
 *   output = I·cos(2π·fc·t) - Q·sin(2π·fc·t)
 */

const TWO_PI = 2 * Math.PI;

/**
 * Generate a time array for the given sample rate and duration.
 */
export function generateTimeArray(sampleRate, duration) {
  const numSamples = Math.floor(sampleRate * duration);
  const t = new Float64Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    t[i] = i / sampleRate;
  }
  return t;
}

/**
 * Generate a signal.
 *
 * Simple types (frequency + amplitude only):
 *   - sine, cosine, square, sawtooth
 *
 * Modulated types (carrier + modulating signal):
 *   - am, fm, chirp
 *
 * @param {string} type
 * @param {Float64Array} t - time array
 * @param {object} params
 *   Simple:    { frequency, amplitude }
 *   AM/FM:     { carrierFreq, modulatingFreq, modulationIndex }
 *   Chirp:     { carrierFreq, chirpEndFreq }
 */
export function generateSignal(type, t, params) {
  const signal = new Float64Array(t.length);

  switch (type) {
    // ---- Simple signals ----

    case 'sine': {
      const { frequency, amplitude = 1 } = params;
      for (let i = 0; i < t.length; i++) {
        signal[i] = amplitude * Math.sin(TWO_PI * frequency * t[i]);
      }
      break;
    }

    case 'cosine': {
      const { frequency, amplitude = 1 } = params;
      for (let i = 0; i < t.length; i++) {
        signal[i] = amplitude * Math.cos(TWO_PI * frequency * t[i]);
      }
      break;
    }

    case 'square': {
      const { frequency, amplitude = 1 } = params;
      for (let i = 0; i < t.length; i++) {
        signal[i] = amplitude * Math.sign(Math.sin(TWO_PI * frequency * t[i]));
      }
      break;
    }

    case 'sawtooth': {
      const { frequency, amplitude = 1 } = params;
      for (let i = 0; i < t.length; i++) {
        // Sawtooth: 2 * (t*f - floor(t*f + 0.5))
        const phase = frequency * t[i];
        signal[i] = amplitude * 2 * (phase - Math.floor(phase + 0.5));
      }
      break;
    }

    // ---- Modulated signals ----

    case 'am': {
      const { carrierFreq, modulatingFreq, modulationIndex = 0.5 } = params;
      // [1 + m·cos(2π·f_mod·t)] · cos(2π·f_c·t)
      for (let i = 0; i < t.length; i++) {
        const envelope = 1 + modulationIndex * Math.cos(TWO_PI * modulatingFreq * t[i]);
        signal[i] = envelope * Math.cos(TWO_PI * carrierFreq * t[i]);
      }
      break;
    }

    case 'fm': {
      const { carrierFreq, modulatingFreq, modulationIndex = 2 } = params;
      // cos(2π·f_c·t + m·sin(2π·f_mod·t))
      for (let i = 0; i < t.length; i++) {
        const phase = TWO_PI * carrierFreq * t[i]
          + modulationIndex * Math.sin(TWO_PI * modulatingFreq * t[i]);
        signal[i] = Math.cos(phase);
      }
      break;
    }

    case 'chirp': {
      const { carrierFreq, chirpEndFreq } = params;
      const duration = t[t.length - 1] || 1;
      const rate = (chirpEndFreq - carrierFreq) / duration;
      for (let i = 0; i < t.length; i++) {
        signal[i] = Math.cos(
          TWO_PI * (carrierFreq * t[i] + 0.5 * rate * t[i] * t[i])
        );
      }
      break;
    }

    default:
      break;
  }

  return signal;
}

/**
 * Downconvert a real signal to I/Q (baseband).
 */
export function downconvert(signal, t, carrierFreq) {
  const I = new Float64Array(signal.length);
  const Q = new Float64Array(signal.length);

  for (let i = 0; i < signal.length; i++) {
    const phase = TWO_PI * carrierFreq * t[i];
    I[i] = signal[i] * Math.cos(phase);
    Q[i] = signal[i] * -Math.sin(phase);
  }

  return { I, Q };
}

/**
 * Upconvert I/Q back to a real signal.
 */
export function upconvert(I, Q, t, carrierFreq) {
  const output = new Float64Array(I.length);

  for (let i = 0; i < I.length; i++) {
    const phase = TWO_PI * carrierFreq * t[i];
    output[i] = I[i] * Math.cos(phase) - Q[i] * Math.sin(phase);
  }

  return output;
}

/**
 * Compute magnitude from I/Q: sqrt(I² + Q²)
 */
export function magnitude(I, Q) {
  const mag = new Float64Array(I.length);
  for (let i = 0; i < I.length; i++) {
    mag[i] = Math.sqrt(I[i] * I[i] + Q[i] * Q[i]);
  }
  return mag;
}

/**
 * Compute phase from I/Q: atan2(Q, I)
 */
export function phase(I, Q) {
  const ph = new Float64Array(I.length);
  for (let i = 0; i < I.length; i++) {
    ph[i] = Math.atan2(Q[i], I[i]);
  }
  return ph;
}
