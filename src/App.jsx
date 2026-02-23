import React, { useState, useMemo } from "react";
import WaveformPlot from "./components/WaveformPlot";
import ConstellationPlot from "./components/ConstellationPlot";
import {
  generateTimeArray,
  generateSignal,
  downconvert,
  upconvert,
} from "./dsp/iq";

const COLORS = {
  input: "#1aad50",
  I: "#2563eb",
  Q: "#dc2626",
  output: "#7c3aed",
};

const SIMPLE_TYPES = ["sine", "cosine", "square", "sawtooth"];

function isSimple(type) {
  return SIMPLE_TYPES.includes(type);
}

// Downsample data for chart rendering
function downsampleForChart(t, signals) {
  const maxPoints = 2000;
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

export default function App() {
  // Signal type
  const [signalType, setSignalType] = useState("am");

  // Simple signal params
  const [frequency, setFrequency] = useState(55);
  const amplitude = 1;

  // Modulated signal params
  const [carrierFreq, setCarrierFreq] = useState(100);
  const [fmIndex] = useState(4);
  const [amIndex] = useState(1);
  const [modulatingFreq, setModulatingFreq] = useState(20);
  const [chirpEndFreq, setChirpEndFreq] = useState(150);
  const [startFreq, setStartFreq] = useState(5);

  // I/Q downconversion — auto-tuned to signal frequency (like RTL-SDR)
  const mixerFreq = useMemo(() => {
    if (isSimple(signalType)) return frequency;
    if (signalType === 'chirp') return startFreq;
    return carrierFreq; // AM/FM: tune to carrier
  }, [signalType, frequency, carrierFreq, startFreq]);

  // Sampling (fixed)
  const sampleRate = 2000;
  const duration = 0.3;

  // I/Q downconversion trace visibility
  const [iqTraces, setIqTraces] = useState({ input: true, I: true, Q: true });
  const toggleIqTrace = (key) => setIqTraces(prev => ({ ...prev, [key]: !prev[key] }));

  // I/Q hover state for live equations
  const [iqHover, setIqHover] = useState(null);

  // Build signal params based on type
  const signalParams = useMemo(() => {
    if (isSimple(signalType)) {
      return { frequency, amplitude };
    }
    if (signalType === "chirp") {
      return { carrierFreq: startFreq, chirpEndFreq };
    }
    if (signalType === "am") {
      return { carrierFreq, modulatingFreq, modulationIndex: amIndex };
    }
    // fm
    return { carrierFreq, modulatingFreq, modulationIndex: fmIndex };
  }, [
    signalType,
    frequency,
    amplitude,
    carrierFreq,
    modulatingFreq,
    amIndex,
    fmIndex,
    startFreq,
    chirpEndFreq,
  ]);

  // Compute all signals
  const results = useMemo(() => {
    const t = generateTimeArray(sampleRate, duration);
    const inputSignal = generateSignal(signalType, t, signalParams);

    const { I: rawI, Q: rawQ } = downconvert(inputSignal, t, mixerFreq);
    const reconstructed = upconvert(rawI, rawQ, t, mixerFreq);

    return { t, inputSignal, rawI, rawQ, reconstructed };
  }, [
    signalType,
    signalParams,
    mixerFreq,
    sampleRate,
    duration,
  ]);

  // Chart data
  const inputChartData = useMemo(
    () => downsampleForChart(results.t, { input: results.inputSignal }),
    [results],
  );
  const iqRawChartData = useMemo(
    () => downsampleForChart(results.t, { input: results.inputSignal, I: results.rawI, Q: results.rawQ }),
    [results],
  );
  const reconstructedChartData = useMemo(
    () => downsampleForChart(results.t, { input: results.inputSignal, output: results.reconstructed }),
    [results],
  );

  // Image frequency demo
  const imageDemo = useMemo(() => {
    const fc = 100;
    const offset = 15;
    const t = generateTimeArray(2000, 0.15);
    const sigAbove = new Float64Array(t.length);
    const sigBelow = new Float64Array(t.length);
    for (let i = 0; i < t.length; i++) {
      sigAbove[i] = Math.cos(2 * Math.PI * (fc + offset) * t[i]);
      sigBelow[i] = Math.cos(2 * Math.PI * (fc - offset) * t[i]);
    }
    const aboveRaw = downconvert(sigAbove, t, fc);
    const belowRaw = downconvert(sigBelow, t, fc);

    // Simple moving-average LPF to strip double-frequency terms
    const lpf = (arr, windowSize = 40) => {
      const out = new Float64Array(arr.length);
      for (let i = 0; i < arr.length; i++) {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, i - windowSize); j <= Math.min(arr.length - 1, i + windowSize); j++) {
          sum += arr[j];
          count++;
        }
        out[i] = sum / count;
      }
      return out;
    };

    return {
      t,
      aboveDown: { I: lpf(aboveRaw.I), Q: lpf(aboveRaw.Q) },
      belowDown: { I: lpf(belowRaw.I), Q: lpf(belowRaw.Q) },
    };
  }, []);

  const imageDemoChartReal = useMemo(() => {
    const { t, aboveDown, belowDown } = imageDemo;
    // Also compute raw input signals for display
    const sigAbove = new Float64Array(t.length);
    const sigBelow = new Float64Array(t.length);
    for (let i = 0; i < t.length; i++) {
      sigAbove[i] = Math.cos(2 * Math.PI * 115 * t[i]);
      sigBelow[i] = Math.cos(2 * Math.PI * 85 * t[i]);
    }
    return downsampleForChart(t, {
      sigAbove,
      sigBelow,
      aboveI: aboveDown.I,
      belowI: belowDown.I,
    });
  }, [imageDemo]);

  const imageDemoChartIQ = useMemo(() => {
    const { t, aboveDown, belowDown } = imageDemo;
    return downsampleForChart(t, {
      aboveI: aboveDown.I,
      aboveQ: aboveDown.Q,
      belowI: belowDown.I,
      belowQ: belowDown.Q,
    });
  }, [imageDemo]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Quadrature Signal Lab</h1>
        <p>
          Interactive quadrature (<span style={{ color: '#2563eb' }}>I</span>/<span style={{ color: '#dc2626' }}>Q</span>) sampling simulator
        </p>
      </header>

      {/* Explanation */}
      <div className="info-panel">
        <h3>What is Quadrature Sampling?</h3>
        <p>
          Quadrature sampling splits a real signal into two orthogonal
          components: the <strong style={{ color: '#2563eb' }}>In-phase (I)</strong> and{" "}
          <strong style={{ color: '#dc2626' }}>Quadrature (Q)</strong> channels. The input signal is
          multiplied by{" "}
          <span className="math">
            cos(2π·f<sub>c</sub>·t)
          </span>{" "}
          to get <strong style={{ color: '#2563eb' }}>I</strong>, and by{" "}
          <span className="math" style={{ color: '#dc2626' }}>
            −sin(2π·f<sub>c</sub>·t)
          </span>{" "}
          to get <strong style={{ color: '#dc2626' }}>Q</strong>. Together, <strong style={{ color: '#2563eb' }}>I</strong> and <strong style={{ color: '#dc2626' }}>Q</strong> fully represent the signal's
          amplitude and phase at baseband.
        </p>
        <h3 style={{ marginTop: 16 }}>Why bother?</h3>
        <p>A one-dimensional sample only captures amplitude — you lose all phase
          information. With <strong style={{ color: '#2563eb' }}>I</strong>/<strong style={{ color: '#dc2626' }}>Q</strong>, you preserve both, which is essential for
          demodulating FM, decoding digital modulation (PSK, QAM), measuring Doppler shift,
          and doing direction-finding. Every SDR receiver, radar system, and modern
          communications link uses quadrature sampling — without it, no receiver could
          tell the difference between a signal above and below its tuned frequency,
          and digital receivers couldn't distinguish between symbols that differ only in phase.
        </p>

        <h3 style={{ marginTop: 16 }}>Why not just digitize the original signal?</h3>
        <p>
          Real RF signals live at very high frequencies — 100 MHz, 2.4 GHz, and beyond.
          No ADC can sample that fast, and even if it could, you'd waste enormous bandwidth
          capturing frequencies you don't care about. I/Q downconversion shifts just the
          slice of spectrum you're interested in down to baseband (near 0 Hz), where it can
          be sampled at a manageable rate. The "original signal" only exists as an analog
          waveform on a wire or antenna — the I/Q representation is how you digitize it
          efficiently. Without it, software-defined radio, Wi-Fi, 4G/5G, GPS, radar,
          and satellite communications wouldn't be practical.
        </p>
        <p style={{ marginTop: 8 }}>
          This simulator uses low frequencies (Hz instead of MHz) so you can see the
          waveforms directly, but the math is identical to what happens inside every
          real receiver.
        </p>

        <h3 style={{ marginTop: 16 }} id="image-frequency">The image frequency problem</h3>
        <p>
          Two different signals — one at{" "}
          <span className="math">115 Hz</span> and one at{" "}
          <span className="math">85 Hz</span> — mixed
          with a local oscillator at <span className="math">f<sub>c</sub> = 100 Hz</span>.
          With only one channel (<strong style={{ color: '#2563eb' }}>I</strong>), they're identical. Add the{" "}
          <strong style={{ color: '#dc2626' }}>Q</strong> channel and the difference is clear.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginTop: 16 }}>
          <div>
            <p className="chart-desc" style={{ marginBottom: 8, fontWeight: 600 }}>Two different input signals</p>
            <div className="legend">
              <span className="legend-item">
                <span className="legend-dot" style={{ background: '#1aad50' }} />
                115 Hz
              </span>
              <span className="legend-item">
                <span className="legend-dot" style={{ background: '#7c3aed' }} />
                85 Hz
              </span>
            </div>
            <WaveformPlot
              data={imageDemoChartReal}
              traces={[
                { key: 'sigAbove', color: '#1aad50', label: '115 Hz' },
                { key: 'sigBelow', color: '#7c3aed', label: '85 Hz' },
              ]}
              height={150}
              yDomain={[-1.2, 1.2]}
            />
          </div>
          <div>
            <p className="chart-desc" style={{ marginBottom: 8, fontWeight: 600 }}>Single channel (I only) — ambiguous</p>
            <div className="legend">
              <span className="legend-item">
                <span className="legend-dot" style={{ background: '#2563eb' }} />
                115 Hz I
              </span>
              <span className="legend-item">
                <span className="legend-dot" style={{ background: '#60a5fa' }} />
                85 Hz I
              </span>
            </div>
            <WaveformPlot
              data={imageDemoChartReal}
              traces={[
                { key: 'aboveI', color: '#2563eb', label: '115 Hz I' },
                { key: 'belowI', color: '#60a5fa', label: '85 Hz I' },
              ]}
              height={150}
              yDomain={[-1.2, 1.2]}
            />
          </div>
          <div>
            <p className="chart-desc" style={{ marginBottom: 8, fontWeight: 600 }}>With I/Q — distinguishable</p>
            <div className="legend">
              <span className="legend-item">
                <span className="legend-dot" style={{ background: '#2563eb' }} />
                115 Hz I
              </span>
              <span className="legend-item">
                <span className="legend-dot" style={{ background: '#dc2626' }} />
                115 Hz Q
              </span>
              <span className="legend-item">
                <span className="legend-dot" style={{ background: '#60a5fa' }} />
                85 Hz I
              </span>
              <span className="legend-item">
                <span className="legend-dot" style={{ background: '#7c3aed' }} />
                85 Hz Q
              </span>
            </div>
            <WaveformPlot
              data={imageDemoChartIQ}
              traces={[
                { key: 'aboveI', color: '#2563eb', label: '115 Hz I' },
                { key: 'aboveQ', color: '#dc2626', label: '115 Hz Q' },
                { key: 'belowI', color: '#60a5fa', label: '85 Hz I' },
                { key: 'belowQ', color: '#7c3aed', label: '85 Hz Q' },
              ]}
              height={150}
              yDomain={[-1.2, 1.2]}
            />
          </div>
        </div>
      </div>

      {/* ===== SECTION 1: INPUT SIGNAL ===== */}
      <div className="section-card">
        <div className="section-header">
          <h2>📡 Input Signal</h2>
          <p className="section-desc">
            Generate a signal to feed into the quadrature downconverter
          </p>
        </div>

        <div className="section-content">
          {/* Subsection: Parameters */}
          <div className="subsection">
            <h3 className="subsection-title">Parameters</h3>
            <div className="controls-grid">
              <div className="control-group">
                <label>Signal Type</label>
                <select
                  value={signalType}
                  onChange={(e) => {
                    const type = e.target.value;
                    setSignalType(type);
                    if (type === 'am') { setCarrierFreq(100); setModulatingFreq(20); }
                    if (type === 'fm') { setCarrierFreq(100); setModulatingFreq(25); }
                    if (type === 'chirp') { setStartFreq(5); setChirpEndFreq(150); }
                  }}
                >
                  <optgroup label="Simple">
                    <option value="sine">Sine</option>
                    <option value="cosine">Cosine</option>
                    <option value="square">Square</option>
                    <option value="sawtooth">Sawtooth</option>
                  </optgroup>
                  <optgroup label="Modulated">
                    <option value="am">AM (Amplitude Modulation)</option>
                    <option value="fm">FM (Frequency Modulation)</option>
                    <option value="chirp">Chirp (Frequency Sweep)</option>
                  </optgroup>
                </select>
              </div>

              {/* Simple signal controls */}
              {isSimple(signalType) && (
                <div className="control-group">
                  <label>Frequency</label>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    step={1}
                    value={frequency}
                    onChange={(e) => setFrequency(Number(e.target.value))}
                  />
                  <span className="control-value">{frequency} Hz</span>
                </div>
              )}

              {/* AM / FM controls */}
              {(signalType === "am" || signalType === "fm") && (
                <>
                  <div className="control-group">
                    <label>Carrier Frequency</label>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      step={1}
                      value={carrierFreq}
                      onChange={(e) => setCarrierFreq(Number(e.target.value))}
                    />
                    <span className="control-value">{carrierFreq} Hz</span>
                  </div>
                  <div className="control-group">
                    <label>Modulating Frequency</label>
                    <input
                      type="range"
                      min={1}
                      max={Math.floor(carrierFreq / 2)}
                      step={1}
                      value={modulatingFreq}
                      onChange={(e) =>
                        setModulatingFreq(Number(e.target.value))
                      }
                    />
                    <span className="control-value">{modulatingFreq} Hz</span>
                  </div>
                </>
              )}

              {/* Chirp controls */}
              {signalType === "chirp" && (
                <>
                  <div className="control-group">
                    <label>Start Frequency</label>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      step={1}
                      value={startFreq}
                      onChange={(e) => setStartFreq(Number(e.target.value))}
                    />
                    <span className="control-value">{startFreq} Hz</span>
                  </div>
                  <div className="control-group">
                    <label>End Frequency</label>
                    <input
                      type="range"
                      min={startFreq + 10}
                      max={100}
                      step={1}
                      value={chirpEndFreq}
                      onChange={(e) => setChirpEndFreq(Number(e.target.value))}
                    />
                    <span className="control-value">{chirpEndFreq} Hz</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Subsection: Waveform Preview */}
          <div className="subsection">
            <h3 className="subsection-title">Waveform Preview</h3>
            <div className="legend">
              <span className="legend-item">
                <span
                  className="legend-dot"
                  style={{ background: COLORS.input }}
                />
                Input Signal
              </span>
            </div>
            <WaveformPlot
              data={inputChartData}
              traces={[{ key: "input", color: COLORS.input, label: "Input" }]}
              yDomain={[-(amplitude || 1) * 1.5, (amplitude || 1) * 1.5]}
            />
          </div>
        </div>
      </div>

      {/* ===== SECTION 2: I/Q DOWNCONVERSION ===== */}
      <div className="section-card">
        <div className="section-header">
          <h2>⚡ I/Q Downconversion</h2>
          <p className="section-desc">
            Mixing with local oscillator
          </p>
        </div>

        <div className="section-content">
          <div className="subsection">
            <p className="chart-desc" style={{ marginBottom: 16, fontFamily: 'JetBrains Mono, monospace' }}>
              <span className="math" style={{ color: '#2563eb' }}>
                I = signal(t) · cos(2π·{mixerFreq}·t){iqHover?.input != null && iqHover?.I != null && ` = ${iqHover.input.toFixed(1)} · cos(2π·${mixerFreq}·${iqHover.t.toFixed(1)}) = ${iqHover.input.toFixed(1)} · ${Math.cos(2 * Math.PI * mixerFreq * iqHover.t).toFixed(1)} = ${iqHover.I.toFixed(1)}`}
              </span><br />
              <span className="math" style={{ color: '#dc2626' }}>
                Q = signal(t) · −sin(2π·{mixerFreq}·t){iqHover?.input != null && iqHover?.Q != null && ` = ${iqHover.input.toFixed(1)} · −sin(2π·${mixerFreq}·${iqHover.t.toFixed(1)}) = ${iqHover.input.toFixed(1)} · ${(-Math.sin(2 * Math.PI * mixerFreq * iqHover.t)).toFixed(1)} = ${iqHover.Q.toFixed(1)}`}
              </span>
            </p>
            <div className="legend">
              <label className="legend-toggle" style={{ opacity: iqTraces.input ? 1 : 0.4 }}>
                <input type="checkbox" checked={iqTraces.input} onChange={() => toggleIqTrace('input')} />
                <span className="legend-dot" style={{ background: COLORS.input }} />
                Input Signal
              </label>
              <label className="legend-toggle" style={{ opacity: iqTraces.I ? 1 : 0.4 }}>
                <input type="checkbox" checked={iqTraces.I} onChange={() => toggleIqTrace('I')} />
                <span className="legend-dot" style={{ background: COLORS.I }} />
                I (In-phase)
              </label>
              <label className="legend-toggle" style={{ opacity: iqTraces.Q ? 1 : 0.4 }}>
                <input type="checkbox" checked={iqTraces.Q} onChange={() => toggleIqTrace('Q')} />
                <span className="legend-dot" style={{ background: COLORS.Q }} />
                Q (Quadrature)
              </label>
            </div>
            <WaveformPlot
              data={iqRawChartData}
              traces={[
                iqTraces.input && { key: "input", color: COLORS.input, label: "Signal" },
                iqTraces.I && { key: "I", color: COLORS.I, label: "I" },
                iqTraces.Q && { key: "Q", color: COLORS.Q, label: "Q" },
              ].filter(Boolean)}
              onHover={setIqHover}
            />
          </div>
        </div>
      </div>

      {/* ===== SECTION 3: RECONSTRUCTION ===== */}
      <div className="section-card">
        <div className="section-header">
          <h2>🔄 Reconstruction</h2>
          <p className="section-desc">
            Upconvert <span style={{ color: '#2563eb' }}>I</span>/<span style={{ color: '#dc2626' }}>Q</span> back to a real signal and compare with the original
          </p>
        </div>

        <div className="section-content">
          <div className="subsection">
            <p className="chart-desc" style={{ marginBottom: 16, fontFamily: 'JetBrains Mono, monospace' }}>
              <span className="math">
                <span style={{ color: '#7c3aed' }}>output(t)</span> = <span style={{ color: '#2563eb' }}>I(t)·cos(2π·{mixerFreq}·t)</span> − <span style={{ color: '#dc2626' }}>Q(t)·sin(2π·{mixerFreq}·t)</span>
              </span>
            </p>
            <div className="legend">
              <span className="legend-item">
                <span
                  className="legend-dot"
                  style={{ background: COLORS.input }}
                />
                Original
              </span>
              <span className="legend-item">
                <span
                  className="legend-dot"
                  style={{ background: COLORS.output }}
                />
                Reconstructed
              </span>
            </div>
            <WaveformPlot
              data={reconstructedChartData}
              traces={[
                { key: "input", color: COLORS.input, label: "Original" },
                { key: "output", color: COLORS.output, label: "Reconstructed" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* ===== SECTION 4: NEXT STEPS ===== */}
      <div className="section-card">
        <div className="section-header">
          <h2>🚀 Try it yourself</h2>
          <p className="section-desc">
            Experiment with different signal types and see how I/Q behaves
          </p>
        </div>

        <div className="section-content">
          <div className="subsection" style={{ paddingBottom: 20 }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Go back to the input signal section and try switching between signal types.
              Watch how the <strong style={{ color: '#2563eb' }}>I</strong> and <strong style={{ color: '#dc2626' }}>Q</strong> channels
              change for each one — use the checkboxes to isolate individual traces.
              Notice how <strong>AM</strong> produces a slow envelope in I/Q,{" "}
              <strong>FM</strong> creates rapid oscillations, and <strong>chirp</strong> sweeps
              through frequencies over time.
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 12 }}>
              Ready to see what this looks like in a real receiver?
              The Real version adds frequency-domain spectrum plots, proper low-pass
              filtering, and clean constellation diagrams — the full pipeline from RF to baseband.
            </p>
            <div style={{ textAlign: 'center' }}>
              <a
                href="../real/"
                style={{
                  display: 'inline-block',
                  marginTop: 16,
                  padding: '10px 24px',
                  background: '#ea580c',
                  color: '#ffffff',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: 14,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.target.style.background = '#c2410c'}
                onMouseLeave={(e) => e.target.style.background = '#ea580c'}
              >
                📻 Switch to Real version
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ===== SECTION 5: HISTORY ===== */}
      <div className="section-card">
        <div className="section-header">
          <h2>📜 A brief history of I/Q</h2>
          <p className="section-desc">
            How quadrature sampling became the universal standard
          </p>
        </div>

        <div className="section-content">
          <div className="subsection" style={{ paddingBottom: 20 }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              The math starts with Euler's formula from the 1700s: e<sup>jθ</sup> = cos θ + j·sin θ,
              linking complex exponentials to sinusoids. The practical side began with Edwin
              Armstrong's superheterodyne receiver (1910s–20s), which introduced frequency
              mixing — the direct ancestor of I/Q downconversion.
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 12 }}>
              The key insight — that you need <em>two</em> orthogonal channels to fully
              represent a signal — came from single-sideband radio work in the 1930s–50s.
              Engineers discovered that a single mixer can't distinguish signals above and
              below its tuned frequency (<a href="#image-frequency" style={{ color: 'var(--accent-blue)' }}>the image problem demonstrated above</a>). The fix:
              use both cosine and sine references. R.B. Dome published an influential paper
              on this in 1946, the same year Dennis Gabor formalized the analytic signal,
              proving that I/Q is the minimal complete representation of any narrowband signal.
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 12 }}>
              The explosion came with digital communications in the 1960s–70s. Modulation
              schemes like QPSK and QAM encode data by independently controlling amplitude
              and phase — which maps directly to the I and Q axes. Without I/Q, modern
              Wi-Fi, 4G/5G, GPS, radar, and satellite communications wouldn't exist.
            </p>
          </div>
        </div>
      </div>



      <footer
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '20px',
          color: 'var(--text-secondary)',
          fontSize: 13,
        }}
      >
        <a href="../real/" style={{ color: 'var(--accent-blue)' }}>Switch to Real version</a>
      </footer>
    </div>
  );
}
