import Link from 'next/link'
import { getAllDemos, getCategories, getDemosByCategory, CATEGORY_LABELS, CATEGORY_ICONS, CATEGORY_COLORS } from '@/lib/demos'
import AiChat from '@/components/AiChat'

export const revalidate = 60 // Re-fetch data every 60 seconds

export default async function HomePage() {
  const [allDemos, categories] = await Promise.all([getAllDemos(), getCategories()])
  const totalDemos = allDemos.length

  const categoryDemos = await Promise.all(
    categories.map(async cat => ({ cat, demos: await getDemosByCategory(cat) }))
  )

  return (
    <div className="relative">
      <section className="relative overflow-hidden pt-14 pb-24 px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="hero-spot -top-16 -left-10 w-44 h-44" style={{ background: 'radial-gradient(circle, rgba(201,151,0,0.38) 0%, transparent 70%)' }} />
          <div className="hero-spot top-20 right-[12%] w-56 h-56" style={{ background: 'radial-gradient(circle, rgba(53,83,142,0.16) 0%, transparent 72%)' }} />
        </div>
        <div className="relative max-w-6xl mx-auto">
          <div className="paper-panel px-6 py-10 sm:px-10 sm:py-12">
            <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_0.8fr] gap-10 items-start">
              <div>
                <div className="eyebrow mb-4">Department of Physics and Astronomy</div>
                <div className="catalog-stripe mb-6">
                  <h1 className="text-5xl sm:text-6xl font-black leading-[0.98]" style={{ fontFamily: 'var(--font-display)' }}>
                    Notre Dame
                    <br />
                    Physics Demonstrations
                  </h1>
                </div>
                <p className="text-lg sm:text-xl max-w-2xl mb-8 leading-relaxed" style={{ color: 'var(--nd-muted)' }}>
                  A catalog of classroom and outreach demonstrations for physics instruction. Browse by subject area, search by equipment or concept, and request demonstrations for lectures and events.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <a href="https://forms.gle/28hUve98KakYVJK27" target="_blank" rel="noopener"
                    className="px-6 py-3 rounded-full font-semibold text-sm transition-all hover:opacity-90 hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg, #f2d37d 0%, var(--nd-gold) 100%)', color: 'var(--nd-navy)', boxShadow: '0 14px 24px rgba(201, 151, 0, 0.18)' }}>
                    Request a Demonstration
                  </a>
                  <Link href="/category/mechanics"
                    className="px-6 py-3 rounded-full font-semibold text-sm border transition-all"
                    style={{ borderColor: 'rgba(12,26,60,0.12)', color: 'var(--nd-text)', background: 'rgba(255,255,255,0.82)' }}>
                    Browse the Catalog
                  </Link>
                </div>
              </div>
              <div className="glass-card p-6">
                <div className="eyebrow mb-3">Catalog Snapshot</div>
                <div className="space-y-4">
                  {[
                    { label: 'Demonstrations', value: totalDemos },
                    { label: 'Subject areas', value: 8 },
                    { label: 'Subcategories', value: 38 },
                  ].map(item => (
                    <div key={item.label} className="flex items-end justify-between border-b pb-3" style={{ borderColor: 'rgba(12,26,60,0.08)' }}>
                      <span className="text-sm" style={{ color: 'var(--nd-muted)' }}>{item.label}</span>
                      <span className="text-2xl font-bold" style={{ color: 'var(--nd-text)', fontFamily: 'var(--font-display)' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
                <p className="text-sm mt-5 leading-relaxed" style={{ color: 'var(--nd-muted)' }}>
                  For lecture support, departmental outreach, and demonstration planning.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 text-left">
              {[
                { title: 'Category-first browsing', body: 'Organized around standard subject areas used in university demo collections.' },
                { title: 'Course-aligned discovery', body: 'Find demos by lecture theme, equipment, and class level.' },
                { title: 'Ordering access', body: 'Ordering information and catalog access are available from the homepage.' },
              ].map(item => (
                <div key={item.title} className="rounded-[18px] p-4" style={{ background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(12,26,60,0.06)' }}>
                  <div className="text-sm font-semibold mb-1" style={{ color: 'var(--nd-text)' }}>{item.title}</div>
                  <div className="text-sm leading-relaxed" style={{ color: 'var(--nd-muted)' }}>{item.body}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium mt-6 soft-pill" style={{ color: 'var(--nd-navy)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {totalDemos} demonstrations currently available
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 mb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: 'For lectures', body: 'Support core topics in mechanics, electricity and magnetism, waves, optics, and thermodynamics.' },
            { title: 'For outreach', body: 'Identify demonstrations for visitors, student groups, and events.' },
            { title: 'For staff planning', body: 'Keep ordering details, equipment context, and demo notes in one place.' },
          ].map((item) => (
            <div key={item.title} className="glass-card p-5">
              <div className="eyebrow mb-2">{item.title}</div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--nd-muted)' }}>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider mx-6 mb-16" />

      <section className="max-w-3xl mx-auto px-6 mb-20">
        <div className="text-center mb-8">
          <div className="eyebrow mb-2">Search Assistance</div>
          <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--nd-text)' }}>
            Ask the Demo Assistant
          </h2>
          <p className="text-sm" style={{ color: 'var(--nd-muted)' }}>
            Search for demonstrations, equipment, and course-relevant topics
          </p>
        </div>
        <AiChat />
      </section>

      <div className="section-divider mx-6 mb-16" />

      <section className="max-w-6xl mx-auto px-6 mb-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="eyebrow mb-2">Browse the Collection</div>
            <h2 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--nd-text)' }}>
              Subject Areas
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--nd-muted)' }}>
              8 subject areas · 38 subcategories · {totalDemos} demonstrations
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
          {categoryDemos.map(({ cat, demos }) => {
            const color = CATEGORY_COLORS[cat]
            return (
              <Link key={cat} href={`/category/${cat}`} className="glass-card glass-card-hover p-6 group relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: color }} />
                <div className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center text-2xl" style={{ background: `${color}14` }}>{CATEGORY_ICONS[cat]}</div>
                <h3 className="font-bold text-base mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--nd-text)' }}>
                  {CATEGORY_LABELS[cat]}
                </h3>
                <p className="text-xs mb-4" style={{ color: 'var(--nd-muted)' }}>
                  {demos.length} demonstration{demos.length !== 1 ? 's' : ''}
                </p>
                <div className="space-y-1">
                  {demos.slice(0, 3).map(d => (
                    <div key={d.id} className="text-xs truncate" style={{ color: 'var(--nd-muted)' }}>• {d.title}</div>
                  ))}
                  {demos.length > 3 && <div className="text-xs font-medium" style={{ color }}>View category</div>}
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 mb-20">
        <div className="paper-panel p-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { label: 'Total Demos', value: totalDemos },
            { label: 'Subject Areas', value: 8 },
            { label: 'Subcategories', value: 38 },
            { label: 'Physics Courses', value: '3+' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-3xl font-black gold-text mb-1" style={{ fontFamily: 'var(--font-display)' }}>{value}</div>
              <div className="text-xs" style={{ color: 'var(--nd-muted)' }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 mb-20">
        <div className="paper-panel p-8 flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
          <div className="flex-1">
            <div className="eyebrow mb-2">Scheduling and Requests</div>
            <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--nd-text)' }}>
              Need to order a demonstration?
            </h3>
            <p className="text-sm" style={{ color: 'var(--nd-muted)' }}>
              Submit requests at least <strong style={{ color: 'var(--nd-gold)' }}>3 business days</strong> in advance.
              Contact Tom Loughran at <a href="mailto:tloughr1@nd.edu" style={{ color: 'var(--nd-navy)' }}>tloughr1@nd.edu</a> or 574-631-7057.
            </p>
          </div>
          <a href="https://forms.gle/28hUve98KakYVJK27" target="_blank" rel="noopener"
            className="flex-shrink-0 px-6 py-3 rounded-full font-semibold text-sm transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #f2d37d 0%, var(--nd-gold) 100%)', color: 'var(--nd-navy)' }}>
            Demo Order Form
          </a>
        </div>
      </section>
    </div>
  )
}
