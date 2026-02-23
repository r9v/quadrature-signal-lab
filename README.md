# Quadrature Signal Lab

An interactive web-based simulator for learning **quadrature (I/Q) signal sampling** — a fundamental concept in digital signal processing (DSP), software-defined radio (SDR), and communications engineering.

![React](https://img.shields.io/badge/React-18-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🎯 What It Does

Two versions, same core concepts:

**Simple** — step-by-step walkthrough with animated visualizations, image frequency demo, and history of I/Q.

**Real** — realistic RF receiver pipeline with frequency-domain analysis, configurable filtering, receiver noise simulation, SNR measurement, and constellation diagrams.

Both let you:

- **Generate** real-valued signals (pure tones, AM, FM)
- **Downconvert** them to I/Q baseband by mixing with cos/sin local oscillators
- **Filter** the mixed output with configurable windowed-sinc low-pass filters
- **Visualize** spectra, I/Q time domain, and constellation diagrams
- **Reconstruct** the original signal and measure fidelity via SNR
- **Add noise** to simulate real receiver conditions

## 🧠 Concepts Demonstrated

- Quadrature downconversion and upconversion
- In-phase (I) and Quadrature (Q) signal components
- Low-pass filtering (moving average and windowed sinc FIR)
- I/Q constellation diagrams
- AM/FM modulation and demodulation
- Frequency domain analysis (FFT spectra)
- Receiver noise and signal-to-noise ratio
- Signal reconstruction fidelity

## 🚀 Getting Started

```bash
git clone https://github.com/r9v/quadrature-signal-lab.git
cd quadrature-signal-lab
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 📦 Deploy to GitHub Pages

```bash
npm run deploy
```

## 🛠 Tech Stack

- **React 18** — UI components
- **Recharts** — Signal visualization
- **Vite** — Build tool
- **Vanilla JS** — All DSP math (no external DSP libraries)

## 📐 The Math

**Downconversion (Real → I/Q):**
```
I(t) = LPF[ signal(t) · cos(2π·fc·t) ]
Q(t) = LPF[ signal(t) · (-sin(2π·fc·t)) ]
```

**Upconversion (I/Q → Real):**
```
output(t) = I(t)·cos(2π·fc·t) - Q(t)·sin(2π·fc·t)
```

## License

MIT
