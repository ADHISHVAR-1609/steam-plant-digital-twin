import React, { useEffect, useRef, useState, useCallback } from 'react'
import { PlantState, DEFAULT_STATE } from './types'
import PlantDiagram from './components/PlantDiagram'
import { AlarmStrip, ControlPanel, StatusPanel, EventTerminal } from './components/Panels'
import TrendChart from './components/TrendChart'
import AIChat from './components/AIChat'
import HistorianView from './components/HistorianView'

const WS_URL = 'ws://localhost:8000/ws'

type Tab = 'hmi' | 'historian' | 'ai' | 'erp'

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 16px', fontSize: 12, cursor: 'pointer', border: 'none',
  background: active ? '#1d4ed8' : '#1e293b', color: active ? 'white' : '#64748b',
  borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
})

export default function App() {
  const [state, setState] = useState<PlantState>(DEFAULT_STATE)
  const [connected, setConnected] = useState(false)
  const [tab, setTab] = useState<Tab>('hmi')
  const [erp, setErp] = useState<Record<string, unknown>>({})
  const wsRef = useRef<WebSocket | null>(null)
  const reconnRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      if (reconnRef.current) clearTimeout(reconnRef.current)
    }
    ws.onclose = () => {
      setConnected(false)
      reconnRef.current = setTimeout(connect, 3000)
    }
    ws.onerror = () => ws.close()
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        if (msg.type === 'state') setState(msg.data as PlantState)
      } catch { /* ignore malformed */ }
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
      if (reconnRef.current) clearTimeout(reconnRef.current)
    }
  }, [connect])

  // Poll ERP when on that tab
  useEffect(() => {
    if (tab !== 'erp') return
    const load = () => fetch('/api/erp/production').then(r => r.json()).then(setErp).catch(() => {})
    load()
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [tab])

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  const { trends, boiler, steam_engine, filter, battery } = state

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'Courier New, monospace' }}>

      {/* ── Header ── */}
      <div style={{ background: '#020617', borderBottom: '1px solid #1e293b', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 'bold', color: '#38bdf8', letterSpacing: '0.05em' }}>
          STEAM PLANT HMI v2
        </div>
        <div style={{ fontSize: 10, color: '#475569' }}>Digital Twin · UMA206 Group XX</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {(['hmi', 'historian', 'ai', 'erp'] as Tab[]).map(t => (
            <button key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>
              {t === 'hmi' ? '⚙ HMI' : t === 'historian' ? '📊 Historian' : t === 'ai' ? '🤖 AI Agent' : '🏭 ERP'}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#334155' }}>tick {state.tick}</div>
      </div>

      {/* ── Alarm strip ── */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid #1e293b' }}>
        <AlarmStrip state={state} />
      </div>

      {/* ── HMI tab ── */}
      {tab === 'hmi' && (
        <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr 200px', gap: 8, padding: 8, height: 'calc(100vh - 100px)' }}>

          {/* Left: Control Panel */}
          <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 6, padding: 10, overflowY: 'auto' }}>
            <ControlPanel state={state} send={send} connected={connected} />
          </div>

          {/* Centre: Diagram + trends + terminal */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <PlantDiagram state={state} />

            {/* Sparklines */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <TrendChart data={trends.pressure} label="Pressure" unit="bar" color="#38bdf8" min={0} max={20} />
              <TrendChart data={trends.level} label="Boiler Level" unit="%" color="#3b82f6" min={0} max={100} />
              <TrendChart data={trends.rpm} label="RPM" unit="" color="#4ade80" min={0} max={3000} />
              <TrendChart data={trends.filter_health} label="Filter" unit="%" color="#f59e0b" min={0} max={100} />
            </div>

            {/* Event terminal */}
            <div style={{ flex: 1, background: '#020617', border: '1px solid #1e293b', borderRadius: 6, padding: 8, minHeight: 100, maxHeight: 160, overflow: 'hidden' }}>
              <div style={{ fontSize: 10, color: '#334155', marginBottom: 4 }}>EVENT LOG</div>
              <EventTerminal state={state} />
            </div>
          </div>

          {/* Right: Status Panel */}
          <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 6, padding: 10, overflowY: 'auto' }}>
            <StatusPanel state={state} />
          </div>
        </div>
      )}

      {/* ── Historian tab ── */}
      {tab === 'historian' && (
        <div style={{ padding: 12, height: 'calc(100vh - 100px)' }}>
          <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 6, padding: 10, height: '100%' }}>
            <HistorianView />
          </div>
        </div>
      )}

      {/* ── AI Agent tab ── */}
      {tab === 'ai' && (
        <div style={{ padding: 12, height: 'calc(100vh - 100px)' }}>
          <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 6, padding: 12, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>
              AI Operator Assistant (Claude) — Week 7 Layer · Context includes live plant state
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <AIChat state={state} />
            </div>
          </div>
        </div>
      )}

      {/* ── ERP/Edge tab ── */}
      {tab === 'erp' && (
        <div style={{ padding: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

            {/* ERP summary */}
            <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 6, padding: 14 }}>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>ERP STUB — SAP S/4HANA (Week 6)</div>
              <pre style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(erp, null, 2)}
              </pre>
            </div>

            {/* MQTT status */}
            <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 6, padding: 14 }}>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>MQTT BROKER STATUS (Week 3)</div>
              <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 2 }}>
                <div>Broker: localhost:1883 (Mosquitto)</div>
                <div>Base topic: <span style={{ color: '#38bdf8' }}>steam_boiler/#</span></div>
                <div>Published tags: pressure, level, rpm, filter, battery, pump, valve…</div>
                <div style={{ marginTop: 8, color: '#475569' }}>
                  Start broker: <code style={{ color: '#4ade80' }}>mosquitto -v</code><br />
                  Subscribe: <code style={{ color: '#4ade80' }}>mosquitto_sub -t "steam_boiler/#" -v</code>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>LIVE TAG SNAPSHOT</div>
                {[
                  ['Pressure', `${state.boiler.pressure.toFixed(2)} bar`],
                  ['Boiler Level', `${state.boiler.level_pct.toFixed(1)} %`],
                  ['RPM', `${state.steam_engine.rpm.toFixed(0)}`],
                  ['Filter Health', `${state.filter.health.toFixed(1)} %`],
                  ['Battery', `${state.battery.charge.toFixed(1)} %`],
                  ['Power Out', `${state.steam_engine.power_output.toFixed(2)} kW`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: '1px solid #1e293b', padding: '3px 0' }}>
                    <span style={{ color: '#64748b' }}>steam_boiler/{k?.toLowerCase().replace(' ', '_')}</span>
                    <span style={{ color: '#38bdf8' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
