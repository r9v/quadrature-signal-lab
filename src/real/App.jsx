import React, { useState, useMemo } from "react";
import WaveformPlot from "../components/WaveformPlot";
import ConstellationPlot from "../components/ConstellationPlot";
import SpectrumPlot from "../components/SpectrumPlot";
import {
  generateTimeArray,
  generateSignal,
  downconvert,
  upconvert,
} from "../dsp/iq";
import { fftReal, fftComplex, toDb } from "../dsp/fft";
import { sincLPF } from "../dsp/filter";
import realCaptures from "../data/fm_captures.json";

const COLORS = {
  input: "#1aad50",
  I: "#2563eb",
  Q: "#dc2626",
  output: "#7c3aed",
};

// Downsample for chart rendering
function downsampleForChart(t, signals, maxPoints = 2000) {
  const step = Math.max(1, Math.floor(t.length / maxPoints));
  const data = [];
  for (let i = 0; i < t.length; i += step) {
    const point = { t: t[i] };
    for (const [key, arr] of Object.entries(signals)) {
      point[key] = arr[i];
    }
    data.push(point);
  }
  return data;
}

// Downsample spectrum data
function downsampleSpectrum(frequencies, dbValues, maxPoints = 500) {
  const step = Math.max(1, Math.floor(frequencies.length / maxPoints));
  const data = [];
  for (let i = 0; i < frequencies.length; i += step) {
    data.push({ f: frequencies[i], mag: dbValues[i] });
  }
  return data;
}

export default function App() {
  // Signal type
  const [signalType, setSignalType] = useState("am");
  const [realSignalIdx, setRealSignalIdx] = useState(0);
  const isRealSignal = signalType.startsWith("real_");

  // Carrier frequency depends on signal type
  const carrierFreqMHz = isRealSignal ? realCaptures[realSignalIdx].center_freq_mhz : 1;
  const carrierFreq = carrierFreqMHz * 1e6;

  // Modulating signal params
  const [modulatingFreq, setModulatingFreq] = useState(50000); // 50 kHz
  const [fmDeviation] = useState(75000); // 75 kHz FM deviation (standard broadcast)
  const [amIndex] = useState(0.8);

  // Sampling: we simulate at a scaled rate
  // We use a scaling factor: generate at low freq, label as real freq
  // At 1 MHz carrier: scaleFactor=100, modulation stays resolvable
  const scaledCarrier = 10000; // 10 kHz internal carrier
  const scaleFactor = carrierFreq / scaledCarrier;
  const scaledModFreq = modulatingFreq / scaleFactor;
  const scaledSampleRate = 50000; // 50 kHz internal sample rate
  const duration = 0.05; // 50ms of signal

  // Filter cutoff (bandwidth around carrier)
  const [filterBW, setFilterBW] = useState(200000); // 200 kHz
  const [filterTaps, setFilterTaps] = useState(51);
  const [noisePower, setNoisePower] = useState(0.05); // noise amplitude
  const scaledFilterCutoff = filterBW / scaleFactor / 2;

  // Compute all signals
  const results = useMemo(() => {
    // --- Choose pipeline parameters based on signal source ---
    let t, inputSignal, lCarrier, lSR, lScaleFactor, lFilterCutoff;

    if (isRealSignal) {
      // Real I/Q: upconvert baseband onto an internal carrier
      const capture = realCaptures[realSignalIdx];
      const N = capture.I.length;
      lSR = capture.sample_rate;
      lCarrier = lSR / 5; // ~410 kHz — keeps 2×fc image away from Nyquist edge
      lScaleFactor = capture.center_freq_mhz * 1e6 / lCarrier;
      lFilterCutoff = filterBW / 2; // real Hz, no scaling needed
      t = new Float64Array(N);
      for (let i = 0; i < N; i++) t[i] = i / lSR;
      const captureI = new Float64Array(capture.I);
      const captureQ = new Float64Array(capture.Q);
      inputSignal = upconvert(captureI, captureQ, t, lCarrier);
    } else {
      // Synthetic: generate modulated signal at scaled carrier
      lSR = scaledSampleRate;
      lCarrier = scaledCarrier;
      lScaleFactor = scaleFactor;
      lFilterCutoff = scaledFilterCutoff;
      t = generateTimeArray(lSR, duration);
      const fmIndex = fmDeviation / modulatingFreq;
      if (signalType === "fm") {
        inputSignal = generateSignal("fm", t, {
          carrierFreq: lCarrier, modulatingFreq: scaledModFreq, modulationIndex: fmIndex,
        });
      } else if (signalType === "am") {
        inputSignal = generateSignal("am", t, {
          carrierFreq: lCarrier, modulatingFreq: scaledModFreq, modulationIndex: amIndex,
        });
      } else {
        inputSignal = generateSignal("cosine", t, { frequency: lCarrier, amplitude: 1 });
      }
    }

    // --- Shared pipeline: downconvert → noise → filter → reconstruct ---
    const { I: rawI, Q: rawQ } = downconvert(inputSignal, t, lCarrier);

    if (noisePower > 0) {
      for (let i = 0; i < rawI.length; i++) {
        const u1 = Math.random() || 1e-10;
        const u2 = Math.random();
        const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
        rawI[i] += noisePower * z0;
        rawQ[i] += noisePower * z1;
      }
    }

    const filteredI = sincLPF(rawI, lFilterCutoff, lSR, filterTaps);
    const filteredQ = sincLPF(rawQ, lFilterCutoff, lSR, filterTaps);
    const reconstructed = upconvert(filteredI, filteredQ, t, lCarrier);

    // --- Spectra ---
    const inputSpectrum = fftReal(inputSignal, lSR);
    const inputDb = toDb(inputSpectrum.magnitudes);
    const rawIQSpectrum = fftComplex(rawI, rawQ, lSR);
    const rawIQDb = toDb(rawIQSpectrum.magnitudes);
    const filteredIQSpectrum = fftComplex(filteredI, filteredQ, lSR);
    const filteredIQDb = toDb(filteredIQSpectrum.magnitudes);
    const reconstructedSpectrum = fftReal(reconstructed, lSR);
    const reconstructedDb = toDb(reconstructedSpectrum.magnitudes);

    // --- SNR ---
    const reconstructionSNR = (() => {
      const delay = Math.floor(filterTaps / 2);
      const start = delay + 10;
      const end = inputSignal.length - delay - 10;
      if (end <= start) return '0.0';
      let dotProd = 0, reconPow = 0;
      for (let i = start; i < end; i++) {
        dotProd += inputSignal[i] * reconstructed[i];
        reconPow += reconstructed[i] * reconstructed[i];
      }
      const sc = reconPow > 0 ? dotProd / reconPow : 1;
      let sigPow = 0, errPow = 0;
      for (let i = start; i < end; i++) {
        sigPow += inputSignal[i] * inputSignal[i];
        const err = inputSignal[i] - sc * reconstructed[i];
        errPow += err * err;
      }
      return errPow > 0 ? (10 * Math.log10(sigPow / errPow)).toFixed(1) : '∞';
    })();

    return {
      t, inputSignal, rawI, rawQ, filteredI, filteredQ, reconstructed,
      inputSpectrum: { frequencies: inputSpectrum.frequencies.map(f => f * lScaleFactor), db: inputDb },
      rawIQSpectrum: { frequencies: rawIQSpectrum.frequencies.map(f => f * lScaleFactor), db: rawIQDb },
      filteredIQSpectrum: { frequencies: filteredIQSpectrum.frequencies.map(f => f * lScaleFactor), db: filteredIQDb },
      reconstructedSpectrum: { frequencies: reconstructedSpectrum.frequencies.map(f => f * lScaleFactor), db: reconstructedDb },
      scaleFactor: lScaleFactor,
      reconstructionSNR,
      isReal: isRealSignal,
      captureLabel: isRealSignal ? realCaptures[realSignalIdx].label : null,
      centerFreqMHz: isRealSignal ? realCaptures[realSignalIdx].center_freq_mhz : carrierFreqMHz,
    };
  }, [signalType, scaledCarrier, scaledModFreq, scaledSampleRate, duration, amIndex, fmDeviation, modulatingFreq, scaleFactor, scaledFilterCutoff, filterTaps, noisePower, isRealSignal, realSignalIdx, filterBW]);

  // Chart data
  const filteredIQChart = useMemo(
    () => downsampleForChart(results.t, { I: results.filteredI, Q: results.filteredQ }),
    [results],
  );

  // Spectrum chart data — input zoomed around carrier
  const inputSpectrumChart = useMemo(() => {
    const freqs = results.inputSpectrum.frequencies;
    const db = results.inputSpectrum.db;
    const center = results.centerFreqMHz * 1e6;
    const margin = center * 0.5;
    const lo = center - margin;
    const hi = center + margin;
    const filtered = [];
    const step = Math.max(1, Math.floor(freqs.length / 500));
    for (let i = 0; i < freqs.length; i += step) {
      if (freqs[i] >= lo && freqs[i] <= hi) {
        filtered.push({ f: freqs[i], mag: db[i] });
      }
    }
    return filtered;
  }, [results]);
  const rawIQSpectrumChart = useMemo(
    () => downsampleSpectrum(results.rawIQSpectrum.frequencies, results.rawIQSpectrum.db),
    [results],
  );
  const filteredIQSpectrumChart = useMemo(
    () => downsampleSpectrum(results.filteredIQSpectrum.frequencies, results.filteredIQSpectrum.db),
    [results],
  );
  const reconstructionCompareChart = useMemo(() => {
    const origFreqs = results.inputSpectrum.frequencies;
    const origDb = results.inputSpectrum.db;
    const reconFreqs = results.reconstructedSpectrum.frequencies;
    const reconDb = results.reconstructedSpectrum.db;
    const center = results.centerFreqMHz * 1e6;
    const margin = center * 0.5;
    const lo = center - margin;
    const hi = center + margin;
    const maxPoints = 500;
    const step = Math.max(1, Math.floor(origFreqs.length / maxPoints));
    const data = [];
    for (let i = 0; i < origFreqs.length; i += step) {
      if (origFreqs[i] >= lo && origFreqs[i] <= hi) {
        data.push({
          f: origFreqs[i],
          original: origDb[i],
          reconstructed: i < reconFreqs.length ? reconDb[i] : -80,
        });
      }
    }
    return data;
  }, [results]);

  const handleSignalChange = (e) => {
    const val = e.target.value;
    if (val.startsWith("real_")) {
      setRealSignalIdx(parseInt(val.split("_")[1]));
    }
    setSignalType(val);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Quadrature Signal Lab — Real</h1>
        <p>
          Realistic <span style={{ color: '#2563eb' }}>I</span>/<span style={{ color: '#dc2626' }}>Q</span> receiver pipeline with frequency domain and filtering
        </p>
      </header>

      {/* ===== GROUP 1: INPUT SIGNAL (Parameters + RF Spectrum) ===== */}
      <div className="section-card">
        <div className="section-header">
          <h2>📡 Input Signal</h2>
          <p className="section-desc">
            The input RF signal — as seen by an antenna
          </p>
        </div>
        <div className="section-content">
          <div className="subsection">
            <h3 className="subsection-title">⚙️ Signal Parameters</h3>
            <div className="controls-grid">
              <div className="control-group">
                <label>Signal Type</label>
                <select value={signalType} onChange={handleSignalChange}>
                  <option value="tone">Pure Tone</option>
                  <option value="am">AM</option>
                  <option disabled>── Real Captures ──</option>
                  {realCaptures.map((c, i) => (
                    <option key={i} value={`real_${i}`}>📡 {c.label}</option>
                  ))}
                </select>
              </div>
              {!isRealSignal && signalType !== "tone" && (
                <div className="control-group">
                  <label>Modulating Frequency</label>
                  <input
                    type="range" min={1000} max={50000} step={1000}
                    value={modulatingFreq}
                    onChange={(e) => setModulatingFreq(Number(e.target.value))}
                  />
                  <span className="control-value">{(modulatingFreq / 1000).toFixed(0)} kHz</span>
                </div>
              )}
            </div>
          </div>
          {isRealSignal && (
            <div className="subsection">
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                📡 <strong>{results.captureLabel}</strong> — real I/Q captured with RTL-SDR at {results.centerFreqMHz} MHz, upconverted onto an internal carrier for visualization.
              </p>
            </div>
          )}
          <div className="subsection">
            <h3 className="subsection-title">RF Spectrum</h3>
            <SpectrumPlot
              data={inputSpectrumChart}
              freqUnit={isRealSignal ? "MHz" : "kHz"}
              color={COLORS.input}
              height={200}
            />
          </div>

        </div>
      </div>

      {/* ===== GROUP 2: I/Q DOWNCONVERSION (Mixing + Filter) ===== */}
      <div className="section-card">
        <div className="section-header">
          <h2>⚡ I/Q Downconversion</h2>
          <p className="section-desc">
            Mix with local oscillator at {carrierFreqMHz} MHz, then filter to extract the baseband signal
          </p>
        </div>
        <div className="section-content">
          <div className="subsection">
            <h3 className="subsection-title">After Mixing — Raw Baseband</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
              The input signal has been multiplied by cos and −sin at the carrier frequency,
              shifting everything down to baseband. Notice the spike near 0 Hz — that's your
              actual signal content. But there's also an unwanted copy far to the left at
              twice the carrier frequency (the mixing image). The low-pass filter in the
              next step removes it. The same thing happens in every real receiver — the
              analog or digital LPF (low-pass filter) after the mixer is specifically there to kill that image.
              Without it, the double-frequency component would corrupt your I/Q data and
              make the constellation diagram messy.
            </p>
            <div className="controls-grid" style={{ marginBottom: 12 }}>
              <div className="control-group">
                <label>Receiver Noise</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={noisePower}
                  onChange={(e) => setNoisePower(Number(e.target.value))}
                />
                <span className="control-value">{noisePower.toFixed(2)}</span>
              </div>
            </div>
            <SpectrumPlot
              data={rawIQSpectrumChart}
              freqUnit={isRealSignal ? "MHz" : "kHz"}
              color={COLORS.I}
              height={200}
            />
          </div>
          <div className="subsection">
            <h3 className="subsection-title">🔧 After Low-Pass Filter</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
              A windowed-sinc filter at {(filterBW / 1000).toFixed(0)} kHz with {filterTaps} taps has removed the
              double-frequency image, leaving only the clean baseband signal. Compare this
              with the raw spectrum above — the high-frequency spike is gone. What remains
              is just the modulation content sitting within a narrow band around 0 Hz. The
              carrier itself became DC during downconversion — it's been "mixed away." For
              FM, that bandwidth is determined by the frequency deviation (±75 kHz for
              broadcast). For AM, it's simply the modulating frequency.
              This is also where the ADC (analog-to-digital converter) samples the signal.
              Because the baseband bandwidth is so much narrower than the original RF,
              the ADC only needs to run at a fraction of the speed — hundreds of kHz
              instead of hundreds of MHz. This is what makes SDR, Wi-Fi, 4G/5G, GPS,
              radar, and satellite communications practical: all the demodulation,
              decoding, and classification happens on this filtered I/Q data.
            </p>
            <div className="controls-grid" style={{ marginBottom: 12 }}>
              <div className="control-group">
                <label>Filter Bandwidth</label>
                <input
                  type="range"
                  min={50000}
                  max={500000}
                  step={10000}
                  value={filterBW}
                  onChange={(e) => setFilterBW(Number(e.target.value))}
                />
                <span className="control-value">{(filterBW / 1000).toFixed(0)} kHz</span>
              </div>
              <div className="control-group">
                <label>Filter Taps</label>
                <input
                  type="range"
                  min={11}
                  max={501}
                  step={10}
                  value={filterTaps}
                  onChange={(e) => setFilterTaps(Number(e.target.value))}
                />
                <span className="control-value">{filterTaps} taps</span>
              </div>
            </div>
            <SpectrumPlot
              data={filteredIQSpectrumChart}
              freqUnit={isRealSignal ? "MHz" : "kHz"}
              color={COLORS.I}
              height={200}
            />
          </div>
          <div className="subsection">
            <p className="chart-desc" style={{ marginBottom: 4, fontWeight: 600 }}>Clean I/Q time domain</p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
              What you see here depends on the modulation type:
              <br /><strong>Pure tone</strong> — I and Q are flat DC lines. The carrier downconverts to a constant complex number (fixed amplitude, fixed phase).
              <br /><strong>AM</strong> — I shows the amplitude envelope (the modulating signal), Q stays near zero. This is because AM only changes the carrier's amplitude, not its phase, and I is aligned with the carrier.
              <br /><strong>FM</strong> — both I and Q oscillate as sinusoids. The carrier's amplitude is constant but its phase rotates, so you need both channels to track the instantaneous frequency.
              <br />In all cases, I and Q together form a complex number at each instant — amplitude = √(I²+Q²), phase = arctan(Q/I). That's everything a demodulator needs.
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
            </p>
            <div className="legend">
              <span className="legend-item">
                <span className="legend-dot" style={{ background: COLORS.I }} />
                I (In-phase)
              </span>
              <span className="legend-item">
                <span className="legend-dot" style={{ background: COLORS.Q }} />
                Q (Quadrature)
              </span>
            </div>
            <WaveformPlot
              data={filteredIQChart}
              traces={[
                { key: "I", color: COLORS.I, label: "I" },
                { key: "Q", color: COLORS.Q, label: "Q" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* ===== SECTION 4: RECONSTRUCTION ===== */}
      <div className="section-card">
        <div className="section-header">
          <h2>🔄 Reconstruction</h2>
          <p className="section-desc">
            Upconvert filtered <span style={{ color: '#2563eb' }}>I</span>/<span style={{ color: '#dc2626' }}>Q</span> back to RF — original vs reconstructed spectrum
          </p>
        </div>
        <div className="section-content">
          <div className="subsection">
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
              The SNR measures how faithfully the signal survives the downconvert–filter–upconvert round trip. What affects it:
            </p>
            <ul style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 16, paddingLeft: 20 }}>
              <li><strong>Filter quality</strong> — more taps = sharper rolloff = less distortion at the band edge</li>
              <li><strong>Filter cutoff vs signal bandwidth</strong> — cutoff must pass all modulation content without clipping it</li>
              <li><strong>Modulation type</strong> — a pure tone is easiest; wideband FM spreads energy near the filter edge where distortion occurs</li>
              <li><strong>Real hardware factors</strong> — ADC bit depth, oscillator phase noise, and analog imperfections (not modeled here)</li>
              <li><strong>Receiver noise</strong> — thermal noise added before filtering simulates real-world conditions. Crank it up to see how the filter fights noise</li>
            </ul>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
              SNR quality brackets:
            </p>
            <ul style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 16, paddingLeft: 20 }}>
              <li><strong style={{ color: 'var(--accent-green)' }}>&gt;40 dB</strong> — Excellent. Near-perfect reconstruction, suitable for precision measurement</li>
              <li><strong style={{ color: 'var(--accent-green)' }}>20–40 dB</strong> — Good. Clean enough for reliable demodulation and decoding</li>
              <li><strong style={{ color: '#ea580c' }}>10–20 dB</strong> — Marginal. Noticeable distortion, digital comms will see bit errors</li>
              <li><strong style={{ color: '#dc2626' }}>&lt;10 dB</strong> — Poor. Signal heavily degraded, likely unusable for most applications</li>
            </ul>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
              Try switching signal types or adjusting the filter below to see the SNR change.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 16 }}>
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Input Signal</h4>
                <div className="controls-grid">
                  <div className="control-group">
                    <label>Signal Type</label>
                    <select value={signalType} onChange={handleSignalChange}>
                      <option value="tone">Pure Tone</option>
                      <option value="am">AM</option>
                      <option disabled>── Real Captures ──</option>
                      {realCaptures.map((c, i) => (
                        <option key={i} value={`real_${i}`}>📡 {c.label}</option>
                      ))}
                    </select>
                  </div>
                  {!isRealSignal && signalType !== "tone" && (
                    <div className="control-group">
                      <label>Modulating Frequency</label>
                      <input
                        type="range" min={1000} max={50000} step={1000}
                        value={modulatingFreq}
                        onChange={(e) => setModulatingFreq(Number(e.target.value))}
                      />
                      <span className="control-value">{(modulatingFreq / 1000).toFixed(0)} kHz</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Filter</h4>
                <div className="controls-grid">
                  <div className="control-group">
                    <label>Bandwidth</label>
                    <input
                      type="range"
                      min={50000}
                      max={500000}
                      step={10000}
                      value={filterBW}
                      onChange={(e) => setFilterBW(Number(e.target.value))}
                    />
                    <span className="control-value">{(filterBW / 1000).toFixed(0)} kHz</span>
                  </div>
                  <div className="control-group">
                    <label>Taps</label>
                    <input
                      type="range"
                      min={11}
                      max={501}
                      step={10}
                      value={filterTaps}
                      onChange={(e) => setFilterTaps(Number(e.target.value))}
                    />
                    <span className="control-value">{filterTaps} taps</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Noise</h4>
                <div className="controls-grid">
                  <div className="control-group">
                    <label>Receiver Noise</label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={noisePower}
                      onChange={(e) => setNoisePower(Number(e.target.value))}
                    />
                    <span className="control-value">{noisePower.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="subsection">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="legend">
                <span className="legend-item">
                  <span className="legend-dot" style={{ background: COLORS.input }} />
                  Original
                </span>
                <span className="legend-item">
                  <span className="legend-dot" style={{ background: COLORS.output }} />
                  Reconstructed
                </span>
              </div>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 13,
                color: parseFloat(results.reconstructionSNR) > 20 ? 'var(--accent-green)' : parseFloat(results.reconstructionSNR) > 10 ? '#ea580c' : '#dc2626',
                background: 'var(--bg-secondary)',
                padding: '4px 12px',
                borderRadius: 6,
              }}>
                SNR: {results.reconstructionSNR} dB
              </div>
            </div>
            <SpectrumPlot
              data={reconstructionCompareChart}
              freqUnit={isRealSignal ? "MHz" : "kHz"}
              height={200}
              traces={[
                { key: 'original', color: COLORS.input, label: 'Original' },
                { key: 'reconstructed', color: COLORS.output, label: 'Reconstructed' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* ===== SECTION 5: CONSTELLATION ===== */}
      <div className="section-card">
        <div className="section-header">
          <h2>🎯 I/Q Constellation</h2>
          <p className="section-desc">
            <span style={{ color: '#dc2626' }}>Q</span> vs <span style={{ color: '#2563eb' }}>I</span> — with filtering, the true modulation shape is revealed
          </p>
        </div>
        <div className="section-content">
          <div className="subsection">
            <p className="chart-desc" style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
              Each point is one instant of the signal as a complex number (<strong style={{ color: '#2563eb' }}>I</strong> + j<strong style={{ color: '#dc2626' }}>Q</strong>).
              With proper filtering, the constellation reveals the modulation type.
              Try switching the input signal to see the difference:
              <br /><strong>Pure tone</strong> → single point (fixed amplitude and phase)
              <br /><strong>AM</strong> → line (amplitude changes, phase stays constant)
              <br /><strong>FM</strong> → circle (constant amplitude, rotating phase)
              <br /><strong>BPSK</strong> → two points (real systems)
              <br /><strong>QPSK</strong> → four points in a square (real systems)
              <br /><strong>16-QAM</strong> → 4×4 grid (real systems)
              <br /><strong>Noise</strong> → random cloud around the origin
            </p>
            <ConstellationPlot
              I={Array.from(results.filteredI)}
              Q={Array.from(results.filteredQ)}
              color={COLORS.output}
              size={350}
            />
          </div>
        </div>
      </div>

      <footer
        style={{
          textAlign: "center",
          padding: "20px",
          color: "var(--text-secondary)",
          fontSize: 13,
        }}
      >
        Quadrature Signal Lab —{" "}
        <a href="../simple/" style={{ color: 'var(--accent-blue)' }}>Switch to Simple version</a>
      </footer>
    </div>
  );
}
