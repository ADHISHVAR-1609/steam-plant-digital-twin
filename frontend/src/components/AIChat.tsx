import React, { useState, useRef, useEffect } from 'react'
import { PlantState } from '../types'

interface Message { role: 'user' | 'assistant'; text: string; ts: number }

interface Props { state: PlantState }

export default function AIChat({ state }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: 'AI operator assistant online. Ask me about plant status, alarms, or recommended actions.', ts: Date.now() },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    const msg = input.trim()
    if (!msg || loading) return
    setInput('')
    const userMsg: Message = { role: 'user', text: msg, ts: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply, ts: Date.now() }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Error: could not reach AI endpoint.', ts: Date.now() }])
    } finally {
      setLoading(false)
    }
  }

  const alarmCount = state.alarms.filter(a => a.active).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
      {/* quick-fire buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {[
          'What is the plant status?',
          'Any active alarms?',
          'Should I open the steam valve?',
          'What caused the overpressure?',
        ].map(q => (
          <button key={q} onClick={() => { setInput(q); }}
            style={{ fontSize: 10, padding: '2px 6px', background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: 3, cursor: 'pointer' }}>
            {q}
          </button>
        ))}
      </div>

      {alarmCount > 0 && (
        <div style={{ background: '#7f1d1d', border: '1px solid #dc2626', borderRadius: 4, padding: '4px 8px', fontSize: 11, color: '#fca5a5' }}>
          {alarmCount} active alarm{alarmCount > 1 ? 's' : ''} — ask the AI for diagnosis
        </div>
      )}

      {/* message area */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            background: m.role === 'user' ? '#1d4ed8' : '#1e293b',
            border: `1px solid ${m.role === 'user' ? '#3b82f6' : '#334155'}`,
            borderRadius: 6, padding: '6px 10px', fontSize: 12, lineHeight: 1.5,
          }}>
            <div style={{ color: m.role === 'user' ? '#bfdbfe' : '#94a3b8', fontSize: 10, marginBottom: 2 }}>
              {m.role === 'user' ? 'Operator' : '🤖 AI Assistant'}
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#64748b' }}>
            AI thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask the AI operator assistant…"
          style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', padding: '6px 10px', fontSize: 12, outline: 'none' }}
        />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{ padding: '6px 14px', background: '#2563eb', border: 'none', borderRadius: 4, color: 'white', fontSize: 12, cursor: 'pointer', opacity: loading || !input.trim() ? 0.5 : 1 }}>
          Send
        </button>
      </div>
    </div>
  )
}
