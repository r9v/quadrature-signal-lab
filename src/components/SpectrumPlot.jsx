import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

/**
 * Frequency-domain spectrum plot.
 * Shows magnitude (dB) vs frequency.
 */
export default function SpectrumPlot({
  frequencies,
  magnitudesDb,
  height = 200,
  freqUnit = 'Hz',
  color = '#2563eb',
  yDomain = [-80, 0],
  traces = null,
  data = null,
}) {
  // Single-trace mode
  const chartData = data || (() => {
    const maxPoints = 2000;
    const step = Math.max(1, Math.floor(frequencies.length / maxPoints));
    const d = [];
    for (let i = 0; i < frequencies.length; i += step) {
      d.push({ f: frequencies[i], mag: magnitudesDb[i] });
    }
    return d;
  })();

  const formatFreq = (f) => {
    if (freqUnit === 'MHz') return Math.round(f / 1e6);
    if (freqUnit === 'kHz') return Math.round(f / 1e3);
    return Math.round(f);
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 20, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#d8dbe5" />
        <XAxis
          dataKey="f"
          stroke="#5c6178"
          fontSize={11}
          tickFormatter={formatFreq}
          label={{ value: `Frequency (${freqUnit})`, position: 'insideBottom', offset: -10, fill: '#5c6178', fontSize: 11 }}
        />
        <YAxis
          stroke="#5c6178"
          fontSize={11}
          domain={yDomain}
          tickFormatter={(v) => `${v}`}
          label={{ value: 'dB', angle: -90, position: 'insideLeft', fill: '#5c6178', fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{
            background: '#ffffff',
            border: '1px solid #d8dbe5',
            borderRadius: 8,
            fontSize: 12,
            fontFamily: 'JetBrains Mono, monospace',
          }}
          labelFormatter={(v) => `${formatFreq(v)} ${freqUnit}`}
          formatter={(v, name) => [`${v.toFixed(1)} dB`, name]}
        />
        {traces ? (
          traces.map((trace) => (
            <Line
              key={trace.key}
              type="monotone"
              dataKey={trace.key}
              stroke={trace.color}
              strokeWidth={1.5}
              dot={false}
              name={trace.label}
              isAnimationActive={false}
            />
          ))
        ) : (
          <Line
            type="monotone"
            dataKey="mag"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            name="Magnitude"
            isAnimationActive={false}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
