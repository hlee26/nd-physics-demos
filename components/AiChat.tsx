'use client'
import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'What demos involve a Van de Graaff generator?',
  'Show me all optics demos with lasers',
  'Which demos are good for teaching Newton\'s Laws?',
  'What equipment is needed for the Eddy Current demo?',
  'Find demos about conservation of momentum',
  'What courses use the RLC Circuit demo?',
]

export default function AiChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your ND Physics Demos assistant. I can help you find demos, explain what equipment you'll need, suggest demos for specific topics or courses, or help add new demos to the catalog. What would you like to know?"
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    setExpanded(true)

    const newMessages: Message[] = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()
      setMessages([...newMessages, { role: 'assistant', content: data.response }])
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Sorry, I had trouble connecting. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const canSend = !loading && input.trim().length > 0

  return (
    <div className="glass-card overflow-hidden transition-all duration-500" style={{ minHeight: expanded ? '480px' : '220px', background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(247,244,234,0.94) 100%)' }}>
      <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(12, 26, 60, 0.08)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm float-gentle" style={{ background: 'linear-gradient(135deg, #f8e4ab 0%, var(--nd-gold) 100%)', color: 'var(--nd-navy)' }}>
            ✦
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--nd-text)' }}>Demo Assistant</div>
            <div className="text-xs" style={{ color: 'var(--nd-muted)' }}>Search assistance for the demo catalog</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {expanded && (
            <button
              onClick={() => setExpanded(false)}
              className="p-1.5 rounded-full transition-colors"
              aria-label="Collapse chat"
              title="Collapse chat"
              style={{ color: 'var(--nd-muted)', background: 'rgba(12,26,60,0.04)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 15l-6-6-6 6"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="px-6 py-4 space-y-4 overflow-y-auto" style={{ maxHeight: expanded ? '320px' : '0px', transition: 'max-height 0.4s ease', overflow: expanded ? 'auto' : 'hidden' }}>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed ${m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}`}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {m.content.split('\n').map((line, j) => (
                <span key={j}>{line}{j < m.content.split('\n').length - 1 && <br />}</span>
              ))}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="chat-bubble-ai px-4 py-3">
              <div className="flex gap-1.5 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-nd-gold animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-nd-gold animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-nd-gold animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Show suggestions whenever no conversation has started yet */}
      {messages.length === 1 && (
        <div className="px-6 py-3 flex gap-2 overflow-x-auto scrollbar-none">
          {SUGGESTIONS.slice(0, 4).map((s, i) => (
            <button
              key={i}
              onClick={() => sendMessage(s)}
              className="flex-shrink-0 px-3 py-2 rounded-full text-xs border transition-colors hover:-translate-y-0.5"
              style={{ borderColor: 'rgba(12,26,60,0.08)', color: 'var(--nd-muted)', background: 'rgba(255,255,255,0.82)' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="px-6 py-4 border-t" style={{ borderColor: 'rgba(12, 26, 60, 0.08)' }}>
        <div className="flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Ask about demos, equipment, courses, or request changes..."
            rows={1}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(12,26,60,0.08)', color: 'var(--nd-text)', fontFamily: 'var(--font-body)', minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!canSend}
            title={canSend ? 'Send message' : 'Type a message first'}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #f7dfa0 0%, var(--nd-gold) 100%)', color: 'var(--nd-navy)', minHeight: '44px', boxShadow: '0 12px 24px rgba(201, 151, 0, 0.18)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m22 2-7 20-4-9-9-4 20-7z"/><path d="M22 2 11 13"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
