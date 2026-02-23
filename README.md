# Quadrature Signal Lab

An interactive web-based simulator for learning **quadrature (I/Q) signal sampling** — a fundamental concept in digital signal processing (DSP), software-defined radio (SDR), and communications engineering.

![React](https://img.shields.io/badge/React-18-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🎯 What It Does

This app lets you:

- **Generate** real-valued signals (tones, AM, FM, chirps)
- **Downconvert** them to I/Q baseband by mixing with cos/sin local oscillators
- **Filter** the mixed output with configurable low-pass filters
- **Visualize** the I/Q components, constellation diagram, and reconstructed signal
- **Reconstruct** the original signal from I/Q to verify the round-trip

## 🧠 Concepts Demonstrated

- Quadrature downconversion and upconversion
- In-phase (I) and Quadrature (Q) signal components
- Low-pass filtering (moving average and windowed sinc FIR)
- I/Q constellation diagrams
- AM/FM modulation and demodulation
- Signal reconstruction fidelity

## 🚀 Getting Started

```bash
git clone https://github.com/YOUR_USERNAME/quadrature-signal-lab.git
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
