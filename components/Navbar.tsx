'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CATEGORY_LABELS, CATEGORY_ICONS } from '@/lib/demos'
import type { Demo } from '@/lib/demos'

export default function Navbar() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Demo[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    setMenuOpen(false)
    setSearchOpen(false)
    setQuery('')
  }, [pathname])

  useEffect(() => {
    if (query.length >= 2) {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(setResults)
        .catch(() => setResults([]))
    } else {
      setResults([])
    }
  }, [query])

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  const categories = Object.entries(CATEGORY_LABELS)

  return (
    <nav className="sticky top-0 z-50 border-b" style={{ background: 'rgba(252, 251, 247, 0.92)', backdropFilter: 'blur(18px)', borderColor: 'rgba(12, 26, 60, 0.08)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm" style={{ background: 'linear-gradient(135deg, #f1d57f 0%, var(--nd-gold) 100%)', color: 'var(--nd-navy)' }}>
              ND
            </div>
            <div className="hidden sm:block">
              <div className="font-semibold text-sm leading-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--nd-text)' }}>
                Physics Demos
              </div>
              <div className="text-[11px] uppercase tracking-[0.24em]" style={{ color: 'var(--nd-muted)' }}>
                Notre Dame
              </div>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-1 soft-pill px-2 py-1">
            {categories.map(([slug, label]) => (
              <Link
                key={slug}
                href={`/category/${slug}`}
                className="nav-chip px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ color: 'var(--nd-muted)' }}
              >
                <span className="mr-1">{CATEGORY_ICONS[slug]}</span>
                {label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2.5 rounded-full transition-colors"
              style={{ color: 'var(--nd-muted)', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(12,26,60,0.08)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </button>

            <a
              href="https://forms.gle/28hUve98KakYVJK27"
              target="_blank"
              rel="noopener"
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #f1d57f 0%, var(--nd-gold) 100%)', color: 'var(--nd-navy)', boxShadow: '0 10px 20px rgba(201, 151, 0, 0.16)' }}
            >
              Order Demo
            </a>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden p-2.5 rounded-full"
              style={{ color: 'var(--nd-muted)', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(12,26,60,0.08)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {menuOpen ? <path d="M18 6 6 18M6 6l12 12"/> : <path d="M3 12h18M3 6h18M3 18h18"/>}
              </svg>
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="pb-3 relative" style={{ animation: 'fadeUp 0.2s ease' }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search 194 demos by name, equipment, or topic..."
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(12,26,60,0.08)', color: 'var(--nd-text)', fontFamily: 'var(--font-body)', boxShadow: 'var(--shadow-card)' }}
              onKeyDown={e => {
                if (e.key === 'Escape') setSearchOpen(false)
              }}
            />
            {results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden shadow-2xl z-50" style={{ background: 'rgba(255,255,255,0.98)', border: '1px solid rgba(12,26,60,0.08)' }}>
                {results.map(d => (
                  <Link
                    key={d.id}
                    href={`/${d.category}/${d.subcategory}/${d.slug}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors"
                    style={{ borderBottom: '1px solid rgba(12,26,60,0.05)' }}
                  >
                    <span className="text-lg">{CATEGORY_ICONS[d.category]}</span>
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--nd-text)' }}>{d.title}</div>
                      <div className="text-xs" style={{ color: 'var(--nd-muted)' }}>{CATEGORY_LABELS[d.category]}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {menuOpen && (
          <div className="lg:hidden pb-4 pt-2 grid grid-cols-2 gap-2" style={{ animation: 'fadeUp 0.2s ease' }}>
            {categories.map(([slug, label]) => (
              <Link
                key={slug}
                href={`/category/${slug}`}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
                style={{ color: 'var(--nd-text)', background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(12,26,60,0.06)' }}
              >
                <span>{CATEGORY_ICONS[slug]}</span>
                {label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
