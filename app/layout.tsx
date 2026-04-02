import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'ND Physics Demos',
  description: 'University of Notre Dame Physics Demonstrations — Browse 194 demos across Mechanics, E&M, Optics, and more.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ fontFamily: 'var(--font-body)' }}>
        <Navbar />
        <main className="relative z-10">
          {children}
        </main>
        <footer className="relative z-10 border-t mt-24 py-10 text-center text-sm" style={{ color: 'var(--nd-muted)', borderColor: 'rgba(12, 26, 60, 0.08)', background: 'rgba(255,255,255,0.45)' }}>
          <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <div style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-semibold gold-text">
                ND Physics Demonstrations
              </div>
              <div className="text-xs uppercase tracking-[0.22em] mt-1">Department Catalog</div>
            </div>
            <p>University of Notre Dame · Department of Physics & Astronomy</p>
            <a href="https://forms.gle/28hUve98KakYVJK27" target="_blank" rel="noopener" className="px-4 py-2 rounded-full border text-sm transition-colors hover:border-nd-gold/60" style={{ borderColor: 'rgba(12,26,60,0.08)', color: 'var(--nd-navy)', background: 'rgba(255,255,255,0.8)' }}>
              Order a Demo →
            </a>
          </div>
        </footer>
      </body>
    </html>
  )
}
