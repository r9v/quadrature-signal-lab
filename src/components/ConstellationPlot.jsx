import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
} from 'recharts';

/**
 * I/Q constellation diagram — plots Q vs I as a scatter plot.
 * This shows the signal's complex representation in the I/Q plane.
 */
export default function ConstellationPlot({ I, Q, color = '#2563eb', size = 300 }) {
  const data = [];
  // Downsample for performance
  const step = Math.max(1, Math.floor(I.length / 500));
  for (let i = 0; i < I.length; i += step) {
    data.push({ i: I[i], q: Q[i] });
  }

  const maxVal = Math.max(
    ...data.map((d) => Math.max(Math.abs(d.i), Math.abs(d.q)))
  );
  const domain = [-(maxVal * 1.2), maxVal * 1.2];

  return (
    <div className="constellation-container">
      <ResponsiveContainer width="100%" height={size}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d8dbe5" />
          <XAxis
            dataKey="i"
            type="number"
            domain={domain}
            stroke="#5c6178"
            fontSize={11}
            name="I"
            label={{ value: 'I', position: 'bottom', offset: 5, fill: '#2563eb', fontSize: 11 }}
            tickFormatter={(v) => v.toFixed(2)}
          />
          <YAxis
            dataKey="q"
            type="number"
            domain={domain}
            stroke="#5c6178"
            fontSize={11}
            name="Q"
            label={{ value: 'Q', angle: -90, position: 'insideLeft', fill: '#dc2626', fontSize: 11 }}
            tickFormatter={(v) => v.toFixed(2)}
          />
          <ReferenceLine x={0} stroke="#b0b5c5" />
          <ReferenceLine y={0} stroke="#b0b5c5" />
          <Tooltip
            contentStyle={{
              background: '#ffffff',
              border: '1px solid #d8dbe5',
              borderRadius: 8,
              fontSize: 12,
              fontFamily: 'JetBrains Mono, monospace',
            }}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const d = payload[0].payload;
              return (
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #d8dbe5',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  <div style={{ color: '#2563eb' }}>I: {d.i.toFixed(4)}</div>
                  <div style={{ color: '#dc2626' }}>Q: {d.q.toFixed(4)}</div>
                </div>
              );
            }}
          />
          <Scatter data={data} fill={color} fillOpacity={0.6} r={2} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
