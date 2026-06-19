import React, { useEffect, useState } from 'react'

interface Row {
  id: number; ts: number; pressure: number; boiler_lvl: number; rpm: number
  filter_hlth: number; battery_chg: number; heater_pwr: number; pump_run: number; valve_open: number; steam_pwr: number
}

interface AlarmRow { id: number; ts: number; alarm_id: string; message: string; severity: string }

export default function HistorianView() {
  const [rows, setRows] = useState<Row[]>([])
  const [alarms, setAlarms] = useState<AlarmRow[]>([])
  const [tab, setTab] = useState<'process' | 'alarms'>('process')

  const load = async () => {
    try {
      const [d, a] = await Promise.all([
        fetch('/api/historian?limit=50').then(r => r.json()),
        fetch('/api/alarms?limit=50').then(r => r.json()),
      ])
      setRows(d); setAlarms(a)
    } catch { /* ignore if backend not ready */ }
  }

  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id) }, [])

  const fmt = (ts: number) => new Date(ts * 1000).toLocaleTimeString()
  const sev = (s: string) => s === 'CRITICAL' ? '#ef4444' : '#f59e0b'

  const thStyle: React.CSSProperties = { padding: '4px 8px', textAlign: 'left', color: '#64748b', fontSize: 10, borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { padding: '3px 8px', fontSize: 11, borderBottom: '1px solid #0f172a', whiteSpace: 'nowrap' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {(['process', 'alarms'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '4px 12px', fontSize: 11, borderRadius: 4, cursor: 'pointer', border: 'none', background: tab === t ? '#1d4ed8' : '#1e293b', color: tab === t ? 'white' : '#94a3b8' }}>
            {t === 'process' ? 'Process Data' : 'Alarm Log'}
          </button>
        ))}
        <button onClick={load} style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 10, borderRadius: 4, cursor: 'pointer', border: '1px solid #334155', background: 'transparent', color: '#64748b' }}>
          Refresh
        </button>
        <span style={{ fontSize: 10, color: '#475569' }}>{rows.length} samples in DB</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {tab === 'process' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Time', 'P (bar)', 'Lvl %', 'RPM', 'Filter %', 'Battery %', 'Heater %', 'Pump', 'Valve', 'kW'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map(r => (
                <tr key={r.id} style={{ background: r.pressure > 14 ? '#1a0f0f' : 'transparent' }}>
                  <td style={tdStyle}>{fmt(r.ts)}</td>
                  <td style={{ ...tdStyle, color: r.pressure > 14 ? '#ef4444' : '#e2e8f0' }}>{r.pressure.toFixed(2)}</td>
                  <td style={tdStyle}>{r.boiler_lvl.toFixed(1)}</td>
                  <td style={tdStyle}>{r.rpm.toFixed(0)}</td>
                  <td style={{ ...tdStyle, color: r.filter_hlth < 25 ? '#f59e0b' : '#e2e8f0' }}>{r.filter_hlth.toFixed(1)}</td>
                  <td style={{ ...tdStyle, color: r.battery_chg < 10 ? '#ef4444' : '#e2e8f0' }}>{r.battery_chg.toFixed(1)}</td>
                  <td style={tdStyle}>{r.heater_pwr.toFixed(0)}</td>
                  <td style={{ ...tdStyle, color: r.pump_run ? '#4ade80' : '#64748b' }}>{r.pump_run ? 'ON' : 'OFF'}</td>
                  <td style={{ ...tdStyle, color: r.valve_open ? '#38bdf8' : '#64748b' }}>{r.valve_open ? 'OPEN' : 'SHUT'}</td>
                  <td style={tdStyle}>{r.steam_pwr.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Time', 'Severity', 'Alarm', 'Detail'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alarms.map(a => (
                <tr key={a.id}>
                  <td style={tdStyle}>{fmt(a.ts)}</td>
                  <td style={{ ...tdStyle, color: sev(a.severity), fontWeight: 'bold' }}>{a.severity}</td>
                  <td style={tdStyle}>{a.alarm_id}</td>
                  <td style={{ ...tdStyle, color: '#94a3b8' }}>{a.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
