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
 * Reusable waveform plot component.
 */
export default function WaveformPlot({
  data,
  traces,
  xKey = 't',
  yDomain = 'auto',
  height = 200,
  onHover = null,
}) {
  const computedYDomain = yDomain === 'auto' ? (() => {
    let min = Infinity, max = -Infinity;
    for (const pt of data) {
      for (const tr of traces) {
        const v = pt[tr.key];
        if (v != null) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    const pad = (max - min) * 0.1 || 0.1;
    return [min - pad, max + pad];
  })() : yDomain;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
        onMouseMove={(e) => {
          if (onHover && e && e.activePayload && e.activePayload.length > 0) {
            const values = {};
            e.activePayload.forEach((p) => { values[p.dataKey] = p.value; });
            values.t = e.activeLabel;
            onHover(values);
          }
        }}
        onMouseLeave={() => onHover && onHover(null)}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#d8dbe5" />
        <XAxis
          dataKey={xKey}
          stroke="#5c6178"
          tick={false}
          axisLine={{ stroke: '#d8dbe5' }}
        />
        <YAxis
          stroke="#5c6178"
          fontSize={11}
          domain={computedYDomain}
          tickFormatter={(v) => v.toFixed(1)}
        />
        <Tooltip
          contentStyle={{
            background: '#ffffff',
            border: '1px solid #d8dbe5',
            borderRadius: 8,
            fontSize: 12,
            fontFamily: 'JetBrains Mono, monospace',
          }}
          labelFormatter={(v) => `t = ${typeof v === 'number' ? v.toFixed(5) : v}s`}
          formatter={(v) => [v.toFixed(4), '']}
        />
        {traces.map((trace) => (
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
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
