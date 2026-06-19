import React from 'react'
import { PlantState } from '../types'

// ---- small helpers ---------------------------------------------------------
const LED = ({ on, color = '#4ade80' }: { on: boolean; color?: string }) => (
  <span style={{
    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
    background: on ? color : '#1e293b',
    boxShadow: on ? `0 0 6px ${color}` : 'none',
    flexShrink: 0,
  }} />
)

const Row = ({ label, value, unit = '', color }: { label: string; value: string | number; unit?: string; color?: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid #1e293b' }}>
    <span style={{ color: '#64748b', fontSize: 11 }}>{label}</span>
    <span style={{ color: color ?? '#e2e8f0', fontSize: 12, fontWeight: 'bold' }}>{value}{unit && <span style={{ color: '#64748b', fontWeight: 'normal' }}> {unit}</span>}</span>
  </div>
)

const Btn = ({ label, onClick, color = '#1e3a5f', textColor = '#e2e8f0', disabled = false }: {
  label: string; onClick: () => void; color?: string; textColor?: string; disabled?: boolean
}) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: '5px 10px', background: color, border: `1px solid ${color}`, borderRadius: 4,
    color: textColor, fontSize: 11, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    transition: 'opacity 0.15s',
  }}>{label}</button>
)

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ fontSize: 10, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4, borderBottom: '1px solid #1e293b', paddingBottom: 3 }}>
      {title}
    </div>
    {children}
  </div>
)

// ---- Alarm strip -----------------------------------------------------------
export function AlarmStrip({ state }: { state: PlantState }) {
  const active = state.alarms.filter(a => a.active)
  if (active.length === 0) return (
    <div style={{ background: '#052e16', border: '1px solid #166534', borderRadius: 4, padding: '4px 10px', fontSize: 11, color: '#4ade80' }}>
      ✓ No active alarms — plant normal
    </div>
  )
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {active.map(a => (
        <div key={a.id} style={{
          background: a.severity === 'CRITICAL' ? '#7f1d1d' : '#451a03',
          border: `1px solid ${a.severity === 'CRITICAL' ? '#dc2626' : '#d97706'}`,
          borderRadius: 4, padding: '3px 8px', fontSize: 11,
          color: a.severity === 'CRITICAL' ? '#fca5a5' : '#fde68a',
        }}>
          {a.severity === 'CRITICAL' ? '⚠' : '⚑'} {a.message}
        </div>
      ))}
    </div>
  )
}

// ---- Control Panel ---------------------------------------------------------
interface ControlProps {
  state: PlantState
  send: (msg: object) => void
  connected: boolean
}

export function ControlPanel({ state, send, connected }: ControlProps) {
  const manual = state.mode === 'MANUAL'

  const setMode = (m: 'AUTO' | 'MANUAL') =>
    send({ type: 'control', action: 'setMode', value: m })

  const setVal = (path: string, value: unknown) =>
    send({ type: 'control', action: 'setManualValue', path, value })

  const injectFault = (id: string) => send({ type: 'fault', faultId: id })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* connection status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <LED on={connected} color="#4ade80" />
        <span style={{ fontSize: 10, color: connected ? '#4ade80' : '#ef4444' }}>
          {connected ? 'WS connected' : 'Disconnected — start backend'}
        </span>
      </div>

      <Section title="Operating Mode">
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn label="AUTO" onClick={() => setMode('AUTO')}
            color={!manual ? '#166534' : '#1e293b'} textColor={!manual ? '#4ade80' : '#64748b'} />
          <Btn label="MANUAL" onClick={() => setMode('MANUAL')}
            color={manual ? '#92400e' : '#1e293b'} textColor={manual ? '#fbbf24' : '#64748b'} />
        </div>
      </Section>

      <Section title="Equipment Controls">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          <Btn label={state.pump.running ? 'Pump ON' : 'Pump OFF'}
            color={state.pump.running ? '#1e3a5f' : '#1e293b'} disabled={!manual}
            onClick={() => setVal('pump.running', !state.pump.running)} />
          <Btn label={state.steam_valve.open ? 'Valve OPEN' : 'Valve SHUT'}
            color={state.steam_valve.open ? '#1e3a5f' : '#1e293b'} disabled={!manual}
            onClick={() => setVal('steam_valve.open', !state.steam_valve.open)} />
        </div>
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 2 }}>
            <span>Heater Power</span><span style={{ color: '#f97316' }}>{state.boiler.heater_power.toFixed(0)} %</span>
          </div>
          <input type="range" min={0} max={100} value={state.boiler.heater_power} disabled={!manual}
            onChange={e => setVal('boiler.heater_power', Number(e.target.value))}
            style={{ width: '100%', accentColor: '#f97316' }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 2 }}>
            <span>Electrical Load</span><span style={{ color: '#fbbf24' }}>{state.electrical_load.toFixed(0)} %</span>
          </div>
          <input type="range" min={0} max={100} value={state.electrical_load}
            onChange={e => setVal('electrical_load', Number(e.target.value))}
            style={{ width: '100%', accentColor: '#fbbf24' }} />
        </div>
      </Section>

      <Section title="Fault Injection (Week 8)">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {[
            { id: 'pump_failure', label: 'Pump Fail' },
            { id: 'heater_failure', label: 'Heater Fail' },
            { id: 'engine_jam', label: 'Engine Jam' },
            { id: 'valve_stuck_open', label: 'Valve ↑' },
            { id: 'valve_stuck_closed', label: 'Valve ↓' },
            { id: 'filter_blocked', label: 'Filter Block' },
          ].map(f => (
            <Btn key={f.id} label={f.label} color="#7f1d1d" textColor="#fca5a5"
              onClick={() => injectFault(f.id)} />
          ))}
        </div>
      </Section>

      <Section title="Recovery">
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn label="Clear Faults" color="#1e3a1e" textColor="#4ade80"
            onClick={() => send({ type: 'clearFaults' })} />
          <Btn label="Reset Plant" color="#1e1e3a" textColor="#818cf8"
            onClick={() => send({ type: 'reset' })} />
        </div>
      </Section>
    </div>
  )
}

// ---- Status Panel ----------------------------------------------------------
export function StatusPanel({ state }: { state: PlantState }) {
  const b = state.boiler
  const presColor = b.pressure > 15 ? '#ef4444' : b.pressure > 12 ? '#f59e0b' : '#38bdf8'

  return (
    <div>
      <Section title="Boiler">
        <Row label="Pressure" value={b.pressure.toFixed(2)} unit="bar" color={presColor} />
        <Row label="Temperature" value={b.temperature.toFixed(0)} unit="°C" />
        <Row label="Water Level" value={b.level_pct.toFixed(1)} unit="%" />
        <Row label="Heater" value={b.heater_power.toFixed(0)} unit="%" />
        <Row label="Relief Valve" value={b.relief_open ? 'OPEN' : 'CLOSED'} color={b.relief_open ? '#ef4444' : '#4ade80'} />
      </Section>

      <Section title="Feed & Pump">
        <Row label="Feed Tank" value={state.feed_tank.level_pct.toFixed(1)} unit="%" />
        <Row label="Feed Volume" value={state.feed_tank.volume.toFixed(0)} unit="L" />
        <Row label="Pump" value={state.pump.running ? 'RUNNING' : 'STOPPED'} color={state.pump.running ? '#4ade80' : '#64748b'} />
        <Row label="Flow Rate" value={state.pump.flow_rate.toFixed(0)} unit="L/min" />
        <Row label="Filter Health" value={state.filter.health.toFixed(1)} unit="%"
          color={state.filter.health < 20 ? '#ef4444' : state.filter.health < 40 ? '#f59e0b' : '#4ade80'} />
      </Section>

      <Section title="Steam & Power">
        <Row label="Steam Valve" value={state.steam_valve.open ? 'OPEN' : 'CLOSED'} color={state.steam_valve.open ? '#38bdf8' : '#64748b'} />
        <Row label="Engine RPM" value={state.steam_engine.rpm.toFixed(0)} unit="RPM" />
        <Row label="Power Out" value={state.steam_engine.power_output.toFixed(2)} unit="kW" />
        <Row label="Battery" value={state.battery.charge.toFixed(1)} unit="%"
          color={state.battery.depleted ? '#ef4444' : state.battery.charge < 20 ? '#f59e0b' : '#4ade80'} />
        <Row label="Elect. Load" value={state.electrical_load.toFixed(0)} unit="%" />
      </Section>
    </div>
  )
}

// ---- Event Terminal --------------------------------------------------------
export function EventTerminal({ state }: { state: PlantState }) {
  const catColor: Record<string, string> = {
    ALARM: '#ef4444', FAULT: '#f97316', OPERATOR: '#38bdf8', PROCESS: '#4ade80',
  }
  const events = [...state.events].reverse().slice(0, 40)

  return (
    <div style={{ height: '100%', overflowY: 'auto', fontFamily: 'Courier New, monospace' }}>
      {events.map((e, i) => {
        const t = new Date(e.timestamp * 1000)
        const ts = `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}:${t.getSeconds().toString().padStart(2, '0')}`
        return (
          <div key={i} style={{ display: 'flex', gap: 8, padding: '2px 0', borderBottom: '1px solid #0f172a' }}>
            <span style={{ color: '#475569', fontSize: 10, flexShrink: 0 }}>{ts}</span>
            <span style={{ color: catColor[e.category] ?? '#94a3b8', fontSize: 10, flexShrink: 0, width: 58 }}>[{e.category}]</span>
            <span style={{ color: '#cbd5e1', fontSize: 10 }}>{e.message}</span>
          </div>
        )
      })}
    </div>
  )
}
