import React, { useRef, useState, useCallback } from 'react'
import { PlantState } from '../types'
import { LAYOUT, SVG_W, SVG_H, NodePos } from '../layout'

// ---- colour helpers -------------------------------------------------------
const C = {
  water: '#3b82f6',
  steam: '#e2e8f0',
  condensate: '#7dd3fc',
  electric: '#fbbf24',
  pipe: '#334155',
  active: '#4ade80',
  fault: '#ef4444',
  warn: '#f59e0b',
  dim: '#1e293b',
  border: '#475569',
  bg: '#0f172a',
}

// ---- animated dash flow ---------------------------------------------------
function FlowPipe({ d, active, color, rev = false }: { d: string; active: boolean; color: string; rev?: boolean }) {
  return (
    <>
      <path d={d} fill="none" stroke={C.pipe} strokeWidth={6} strokeLinecap="round" />
      {active && (
        <path d={d} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round"
          strokeDasharray="10 14" opacity={0.85}
          style={{ animation: `dash${rev ? 'Rev' : ''} 1.2s linear infinite` }} />
      )}
    </>
  )
}

// ---- equipment symbols ----------------------------------------------------
function FeedTank({ pos, levelPct }: { pos: NodePos; levelPct: number }) {
  const { x, y, w, h } = pos
  const fillH = Math.max(0, Math.min(h - 16, (levelPct / 100) * (h - 16)))
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={C.dim} stroke={C.border} strokeWidth={2} />
      <rect x={x + 3} y={y + h - fillH - 3} width={w - 6} height={fillH} rx={3} fill={C.water} opacity={0.7} />
      <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fill="white" fontSize={13} fontWeight="bold">{levelPct.toFixed(0)}%</text>
      <text x={x + w / 2} y={y + h + 14} textAnchor="middle" fill="#94a3b8" fontSize={10}>Feed Tank</text>
    </g>
  )
}

function Pump({ pos, running, fault }: { pos: NodePos; running: boolean; fault: boolean }) {
  const { x, y, w, h } = pos
  const cx = x + w / 2; const cy = y + h / 2; const r = w / 2 - 2
  const col = fault ? C.fault : running ? C.active : C.dim
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={C.dim} stroke={col} strokeWidth={2.5} />
      {/* impeller blades */}
      {[0, 60, 120, 180, 240, 300].map(deg => {
        const rad = (deg * Math.PI) / 180
        return <line key={deg} x1={cx} y1={cy} x2={cx + Math.cos(rad) * (r - 4)} y2={cy + Math.sin(rad) * (r - 4)}
          stroke={col} strokeWidth={2} />
      })}
      <circle cx={cx} cy={cy} r={4} fill={col} />
      <text x={cx} y={y + h + 14} textAnchor="middle" fill="#94a3b8" fontSize={10}>Pump</text>
    </g>
  )
}

function WaterFilter({ pos, health }: { pos: NodePos; health: number }) {
  const { x, y, w, h } = pos
  const col = health < 15 ? C.fault : health < 30 ? C.warn : C.active
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={5} fill={C.dim} stroke={col} strokeWidth={2} />
      {/* filter mesh lines */}
      {[0.25, 0.5, 0.75].map(f => (
        <line key={f} x1={x + 6} y1={y + h * f} x2={x + w - 6} y2={y + h * f} stroke={col} strokeWidth={1} opacity={0.5} />
      ))}
      <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fill={col} fontSize={11} fontWeight="bold">{health.toFixed(0)}%</text>
      <text x={x + w / 2} y={y + h + 14} textAnchor="middle" fill="#94a3b8" fontSize={10}>Filter</text>
    </g>
  )
}

function Boiler({ pos, levelPct, pressure, reliefOpen, heaterFault }: { pos: NodePos; levelPct: number; pressure: number; reliefOpen: boolean; heaterFault: boolean }) {
  const { x, y, w, h } = pos
  const fillH = Math.max(0, Math.min(h - 30, (levelPct / 100) * (h - 30)))
  const presCol = pressure > 15 ? C.fault : pressure > 12 ? C.warn : '#38bdf8'
  return (
    <g>
      {/* vessel */}
      <rect x={x} y={y + 10} width={w} height={h - 10} rx={8} fill={C.dim} stroke={heaterFault ? C.fault : C.border} strokeWidth={2.5} />
      {/* dome */}
      <ellipse cx={x + w / 2} cy={y + 10} rx={w / 2} ry={14} fill={C.dim} stroke={heaterFault ? C.fault : C.border} strokeWidth={2.5} />
      {/* water fill */}
      <rect x={x + 4} y={y + h - fillH - 4} width={w - 8} height={fillH} fill={C.water} opacity={0.5} rx={4} />
      {/* heater coil at bottom */}
      <path d={`M${x + 12},${y + h - 18} Q${x + w / 2},${y + h - 30} ${x + w - 12},${y + h - 18}`}
        fill="none" stroke={heaterFault ? C.fault : '#f97316'} strokeWidth={2.5} />
      {/* labels */}
      <text x={x + w / 2} y={y + h / 2 - 4} textAnchor="middle" fill={presCol} fontSize={14} fontWeight="bold">{pressure.toFixed(1)}</text>
      <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" fill={presCol} fontSize={10}>bar</text>
      <text x={x + w / 2} y={y + h / 2 + 26} textAnchor="middle" fill="#94a3b8" fontSize={10}>{levelPct.toFixed(0)}%</text>
      <text x={x + w / 2} y={y + h + 14} textAnchor="middle" fill="#94a3b8" fontSize={10}>Boiler</text>
      {reliefOpen && <circle cx={x + w - 6} cy={y + 18} r={5} fill={C.fault} opacity={0.9} />}
    </g>
  )
}

function ReliefValve({ pos, open }: { pos: NodePos; open: boolean }) {
  const { x, y, w, h } = pos
  const cx = x + w / 2; const cy = y + h / 2
  return (
    <g>
      <polygon points={`${cx},${y} ${x + w},${y + h} ${x},${y + h}`} fill={open ? C.fault : C.dim} stroke={open ? C.fault : C.border} strokeWidth={2} />
      <text x={cx} y={y + h + 13} textAnchor="middle" fill="#94a3b8" fontSize={9}>PRV</text>
    </g>
  )
}

function SteamValve({ pos, open, stuck }: { pos: NodePos; open: boolean; stuck: boolean }) {
  const { x, y, w, h } = pos
  const cx = x + w / 2; const cy = y + h / 2
  const col = stuck ? C.fault : open ? C.active : C.border
  return (
    <g>
      {/* butterfly body */}
      <circle cx={cx} cy={cy} r={w / 2 - 1} fill={C.dim} stroke={col} strokeWidth={2.5} />
      <line x1={cx - w / 2 + 4} y1={cy} x2={cx + w / 2 - 4} y2={cy} stroke={col} strokeWidth={open ? 1 : 3} />
      {open && <line x1={cx} y1={cy - h / 2 + 4} x2={cx} y2={cy + h / 2 - 4} stroke={col} strokeWidth={1} />}
      <text x={cx} y={y + h + 14} textAnchor="middle" fill="#94a3b8" fontSize={10}>S.Valve</text>
      {stuck && <text x={cx} y={y - 6} textAnchor="middle" fill={C.fault} fontSize={9}>STUCK</text>}
    </g>
  )
}

function SteamEngine({ pos, rpm, jammed }: { pos: NodePos; rpm: number; jammed: boolean }) {
  const { x, y, w, h } = pos
  const cx = x + w / 2; const cy = y + h / 2
  const rpmFrac = Math.min(1, rpm / 3000)
  const col = jammed ? C.fault : rpmFrac > 0.1 ? C.active : C.border
  const finLen = Math.min(w, h) / 2 - 4
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={C.dim} stroke={col} strokeWidth={2} />
      {/* 8 fins */}
      {Array.from({ length: 8 }, (_, i) => {
        const ang = (i * Math.PI) / 4
        return <line key={i}
          x1={cx} y1={cy}
          x2={cx + Math.cos(ang) * finLen} y2={cy + Math.sin(ang) * finLen}
          stroke={col} strokeWidth={2} strokeLinecap="round" />
      })}
      <circle cx={cx} cy={cy} r={5} fill={col} />
      <text x={cx} y={y + h + 14} textAnchor="middle" fill="#94a3b8" fontSize={10}>Steam Engine</text>
      <text x={cx} y={y - 4} textAnchor="middle" fill={col} fontSize={10}>{rpm.toFixed(0)} RPM</text>
    </g>
  )
}

function Condenser({ pos }: { pos: NodePos }) {
  const { x, y, w, h } = pos
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={5} fill={C.dim} stroke="#7dd3fc" strokeWidth={2} />
      {/* cooling fins */}
      {[0.2, 0.4, 0.6, 0.8].map(f => (
        <line key={f} x1={x + 4} y1={y + h * f} x2={x + w - 4} y2={y + h * f} stroke="#7dd3fc" strokeWidth={1} opacity={0.4} />
      ))}
      <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fill="#7dd3fc" fontSize={10}>Cond.</text>
      <text x={x + w / 2} y={y + h + 14} textAnchor="middle" fill="#94a3b8" fontSize={10}>Condenser</text>
    </g>
  )
}

function Battery({ pos, charge, depleted }: { pos: NodePos; charge: number; depleted: boolean }) {
  const { x, y, w, h } = pos
  const fillH = Math.max(0, Math.min(h - 16, (charge / 100) * (h - 16)))
  const col = depleted ? C.fault : charge > 20 ? C.active : C.warn
  return (
    <g>
      {/* terminal */}
      <rect x={x + w / 2 - 8} y={y - 6} width={16} height={8} rx={2} fill={col} />
      <rect x={x} y={y} width={w} height={h} rx={4} fill={C.dim} stroke={col} strokeWidth={2} />
      <rect x={x + 4} y={y + h - fillH - 4} width={w - 8} height={fillH} rx={2} fill={col} opacity={0.7} />
      <text x={x + w / 2} y={y + h / 2 + 5} textAnchor="middle" fill="white" fontSize={12} fontWeight="bold">{charge.toFixed(0)}%</text>
      <text x={x + w / 2} y={y + h + 14} textAnchor="middle" fill="#94a3b8" fontSize={10}>Battery</text>
    </g>
  )
}

// ---- CSS animation injector -----------------------------------------------
const ANIM_CSS = `
@keyframes dash { to { stroke-dashoffset: -24; } }
@keyframes dashRev { to { stroke-dashoffset: 24; } }
`

// ---- main component -------------------------------------------------------
interface Props { state: PlantState }

export default function PlantDiagram({ state }: Props) {
  const L = LAYOUT
  const { boiler, pump, filter, feed_tank, steam_valve, steam_engine, condenser, battery } = state

  const waterFlow = pump.running && !pump.fault
  const steamFlow = steam_valve.open && boiler.pressure >= 8
  const condensateFlow = condenser.condensate_flow > 0.001
  const electricFlow = steam_engine.rpm > 100

  // Pipe paths (SVG path strings)
  // Feed Tank outlet → Pump inlet
  const p_ft_pump = `M${L.feedTank.x + L.feedTank.w},${L.feedTank.y + L.feedTank.h - 30} H${L.pump.x + L.pump.w / 2 - L.pump.w / 2}`
  // Pump → Filter
  const p_pump_filt = `M${L.pump.x + L.pump.w},${L.pump.y + L.pump.h / 2} H${L.filter.x}`
  // Filter → Boiler (up)
  const p_filt_boiler = `M${L.filter.x + L.filter.w},${L.filter.y + L.filter.h / 2} H${L.boiler.x - 10} V${L.boiler.y + L.boiler.h - 40} H${L.boiler.x}`
  // Boiler top → Relief valve
  const p_boil_prv = `M${L.boiler.x + L.boiler.w / 2},${L.boiler.y} V${L.reliefValve.y + L.reliefValve.h}`
  // Boiler → Steam valve
  const p_boil_sv = `M${L.boiler.x + L.boiler.w},${L.boiler.y + 40} H${L.steamValve.x}`
  // Steam valve → Steam engine
  const p_sv_eng = `M${L.steamValve.x + L.steamValve.w},${L.steamValve.y + L.steamValve.h / 2} H${L.steamEngine.x}`
  // Steam engine → Condenser
  const p_eng_cond = `M${L.steamEngine.x + L.steamEngine.w / 2},${L.steamEngine.y + L.steamEngine.h} V${L.condenser.y}`
  // Condenser → Feed tank (return)
  const p_cond_ft = `M${L.condenser.x},${L.condenser.y + L.condenser.h / 2} H${L.feedTank.x + L.feedTank.w / 2} V${L.feedTank.y + L.feedTank.h}`
  // Steam engine → Battery (electrical)
  const p_eng_bat = `M${L.steamEngine.x + L.steamEngine.w},${L.steamEngine.y + L.steamEngine.h / 2} H${L.battery.x}`

  return (
    <div style={{ background: '#0a0f1e', borderRadius: 8, border: '1px solid #1e293b', overflow: 'hidden' }}>
      <style>{ANIM_CSS}</style>
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ display: 'block' }}>
        {/* background grid */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40,0 L0,0 0,40" fill="none" stroke="#0f172a" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={SVG_W} height={SVG_H} fill="url(#grid)" />

        {/* --- Pipes --- */}
        <FlowPipe d={p_ft_pump} active={waterFlow} color={C.water} />
        <FlowPipe d={p_pump_filt} active={waterFlow} color={C.water} />
        <FlowPipe d={p_filt_boiler} active={waterFlow} color={C.water} />
        <FlowPipe d={p_boil_prv} active={boiler.relief_open} color={C.steam} />
        <FlowPipe d={p_boil_sv} active={steamFlow} color={C.steam} />
        <FlowPipe d={p_sv_eng} active={steamFlow} color={C.steam} />
        <FlowPipe d={p_eng_cond} active={condensateFlow} color={C.condensate} rev />
        <FlowPipe d={p_cond_ft} active={condensateFlow} color={C.condensate} rev />
        <FlowPipe d={p_eng_bat} active={electricFlow} color={C.electric} />

        {/* --- Equipment --- */}
        <FeedTank pos={L.feedTank} levelPct={feed_tank.level_pct} />
        <Pump pos={L.pump} running={pump.running} fault={pump.fault} />
        <WaterFilter pos={L.filter} health={filter.health} />
        <Boiler pos={L.boiler} levelPct={boiler.level_pct} pressure={boiler.pressure}
          reliefOpen={boiler.relief_open} heaterFault={boiler.heater_fault} />
        <ReliefValve pos={L.reliefValve} open={boiler.relief_open} />
        <SteamValve pos={L.steamValve} open={steam_valve.open} stuck={steam_valve.stuck} />
        <SteamEngine pos={L.steamEngine} rpm={steam_engine.rpm} jammed={steam_engine.jammed} />
        <Condenser pos={L.condenser} />
        <Battery pos={L.battery} charge={battery.charge} depleted={battery.depleted} />

        {/* --- Flow labels --- */}
        <text x={135} y={L.pump.y + L.pump.h / 2 - 6} textAnchor="middle" fill="#3b82f6" fontSize={9} opacity={waterFlow ? 0.9 : 0.3}>
          {pump.flow_rate.toFixed(0)} L/min
        </text>
        <text x={L.steamEngine.x + L.steamEngine.w / 2} y={L.condenser.y - 6} textAnchor="middle" fill={C.condensate} fontSize={9} opacity={condensateFlow ? 0.9 : 0.3}>
          return
        </text>
        <text x={L.battery.x - 22} y={L.steamEngine.y + L.steamEngine.h / 2 - 5} textAnchor="middle" fill={C.electric} fontSize={9} opacity={electricFlow ? 0.9 : 0.3}>
          {steam_engine.power_output.toFixed(2)} kW
        </text>

        {/* --- Mode badge --- */}
        <rect x={8} y={8} width={60} height={20} rx={4} fill={state.mode === 'AUTO' ? '#166534' : '#92400e'} />
        <text x={38} y={22} textAnchor="middle" fill="white" fontSize={11} fontWeight="bold">{state.mode}</text>

        {/* --- Active alarm count --- */}
        {state.alarms.filter(a => a.active).length > 0 && (
          <>
            <rect x={SVG_W - 70} y={8} width={62} height={20} rx={4} fill="#7f1d1d" />
            <text x={SVG_W - 39} y={22} textAnchor="middle" fill="#fca5a5" fontSize={11}>
              ⚠ {state.alarms.filter(a => a.active).length} alarm{state.alarms.filter(a => a.active).length > 1 ? 's' : ''}
            </text>
          </>
        )}
      </svg>
    </div>
  )
}
