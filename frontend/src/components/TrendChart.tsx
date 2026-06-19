import React from 'react'

interface Props {
  data: number[]
  color?: string
  min?: number
  max?: number
  label: string
  unit: string
  width?: number
  height?: number
}

export default function TrendChart({
  data, color = '#38bdf8', min, max, label, unit, width = 220, height = 60,
}: Props) {
  if (data.length < 2) return (
    <div style={{ width, height, background: '#0f172a', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 11 }}>
      {label}: waiting…
    </div>
  )

  const lo = min ?? Math.min(...data)
  const hi = max ?? Math.max(...data)
  const range = hi - lo || 1
  const pad = 4
  const w = width - pad * 2
  const h = height - pad * 2

  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * w
    const y = pad + h - ((v - lo) / range) * h
    return `${x},${y}`
  }).join(' ')

  const current = data[data.length - 1]

  return (
    <div style={{ position: 'relative', width, height: height + 20 }}>
      <svg width={width} height={height} style={{ display: 'block', background: '#0f172a', borderRadius: 4 }}>
        {/* grid lines */}
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1={pad} x2={width - pad}
            y1={pad + h * (1 - f)} y2={pad + h * (1 - f)}
            stroke="#1e293b" strokeWidth={1} />
        ))}
        <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {/* current value dot */}
        <circle
          cx={pad + w} cy={pad + h - ((current - lo) / range) * h}
          r={3} fill={color} />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginTop: 2 }}>
        <span>{label}</span>
        <span style={{ color }}>{current.toFixed(1)} {unit}</span>
      </div>
    </div>
  )
}
