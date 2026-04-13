import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAllDemos, getDemo, getDemosBySubcategory, CATEGORY_LABELS, CATEGORY_COLORS, SUBCATEGORY_LABELS } from '@/lib/demos'
import { inferSimulationSpec } from '@/lib/simulations'
import DemoSimulation from '@/components/DemoSimulation'

export const revalidate = 60

export async function generateStaticParams() {
  const demos = await getAllDemos()
  return demos.map(d => ({ category: d.category, subcategory: d.subcategory, demo: d.slug }))
}

function InfoSection({ title, content, icon }: { title: string; content: string; icon: string }) {
  if (!content?.trim()) return null
  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{icon}</span>
        <h3 className="font-bold text-sm" style={{ fontFamily: 'var(--font-display)', color: 'var(--nd-text)' }}>{title}</h3>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--nd-muted)', whiteSpace: 'pre-wrap' }}>
        {content.replace(/\* Equipment seen in the video[\s\S]*?setup\./g, '').trim()}
      </p>
    </div>
  )
}

function EquipmentList({ equipment }: { equipment: string }) {
  if (!equipment?.trim()) return null
  const items = Array.from(new Set(equipment.split(/,|\n/).map(s => s.trim()).filter(s => s.length > 1)))
  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🔧</span>
        <h3 className="font-bold text-sm" style={{ fontFamily: 'var(--font-display)', color: 'var(--nd-text)' }}>Equipment Required</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--nd-muted)' }}>
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--nd-gold)' }} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default async function DemoPage({ params }: { params: { category: string; subcategory: string; demo: string } }) {
  const { category, subcategory, demo: demoSlug } = params
  const [demo, relatedAll] = await Promise.all([
    getDemo(category, subcategory, demoSlug),
    getDemosBySubcategory(category, subcategory),
  ])
  if (!demo) notFound()

  const color = CATEGORY_COLORS[category]
  const relatedDemos = relatedAll.filter(d => d.slug !== demoSlug).slice(0, 4)
  const courses = demo.courses ? demo.courses.split(',').map(c => c.trim()).filter(Boolean) : []
  const simulationSpec = inferSimulationSpec(demo)

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <nav aria-label="Breadcrumb" className="text-xs mb-8 flex flex-wrap gap-1" style={{ color: 'var(--nd-muted)' }}>
        <Link href="/" className="breadcrumb-link">Home</Link>
        <span>›</span>
        <Link href={`/category/${category}`} className="breadcrumb-link">{CATEGORY_LABELS[category]}</Link>
        <span>›</span>
        <Link href={`/category/${category}`} className="breadcrumb-link">{SUBCATEGORY_LABELS[subcategory] || subcategory}</Link>
        <span>›</span>
        <span aria-current="page" style={{ color: 'var(--nd-text)' }}>{demo.title}</span>
      </nav>

      <div className="paper-panel p-8 mb-10 relative overflow-hidden" style={{ animation: 'fadeUp 0.4s ease forwards' }}>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="px-3 py-1 rounded-full text-xs font-medium border" style={{ borderColor: `${color}40`, color, background: `${color}10` }}>
            {CATEGORY_LABELS[category]}
          </span>
          <span className="px-3 py-1 rounded-full text-xs border" style={{ borderColor: 'var(--nd-border)', color: 'var(--nd-muted)' }}>
            {SUBCATEGORY_LABELS[subcategory] || subcategory}
          </span>
          {courses.map(c => (
            <span key={c} className="px-3 py-1 rounded-full text-xs border" style={{ borderColor: 'var(--nd-border)', color: 'var(--nd-muted)' }}>{c}</span>
          ))}
        </div>
        <div className="eyebrow mb-2">Demonstration Record</div>
        <h1 className="text-4xl sm:text-5xl font-black mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--nd-text)' }}>
          {demo.title}
        </h1>
        {demo.description && (
          <p className="text-base leading-relaxed max-w-3xl relative" style={{ color: 'var(--nd-muted)' }}>
            {demo.description.replace(/\* Equipment seen in the video[\s\S]*?setup\./g, '').trim()}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        <div className="lg:col-span-2 space-y-6">
          <DemoSimulation spec={simulationSpec} />
          <InfoSection title="Setup Instructions" content={demo.setup ?? ''} icon="📋" />
          {demo.notes && <InfoSection title="Notes & Safety" content={demo.notes} icon="⚠️" />}
          {demo.discussion_questions && <InfoSection title="Discussion Questions" content={demo.discussion_questions} icon="💬" />}
        </div>
        <div className="space-y-6">
          <EquipmentList equipment={demo.equipment ?? ''} />
          <div className="glass-card p-5" style={{ borderColor: `${color}30` }}>
            <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--nd-text)' }}>Request This Demo</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--nd-muted)' }}>Submit at least 3 days before needed.</p>
            <a href="https://forms.gle/28hUve98KakYVJK27" target="_blank" rel="noopener"
              className="block text-center px-4 py-2.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`, color: 'white' }}>
              Order Demo Form
            </a>
            <a href="mailto:tloughr1@nd.edu"
              className="block text-center mt-2 px-4 py-2 rounded-lg text-xs border transition-all hover:border-white/20"
              style={{ borderColor: 'rgba(12,26,60,0.08)', color: 'var(--nd-muted)', background: 'rgba(255,255,255,0.8)' }}>
              Email Tom Loughran
            </a>
          </div>
        </div>
      </div>

      {relatedDemos.length > 0 && (
        <div className="border-t pt-10" style={{ borderColor: 'var(--nd-border)' }}>
          <h2 className="text-xl font-bold mb-6" style={{ fontFamily: 'var(--font-display)', color: 'var(--nd-text)' }}>
            More in {SUBCATEGORY_LABELS[subcategory] || subcategory}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {relatedDemos.map(d => (
              <Link key={d.id} href={`/${d.category}/${d.subcategory}/${d.slug}`} className="glass-card glass-card-hover p-4 group">
                <h3 className="font-semibold text-sm group-hover:text-nd-gold-light transition-colors" style={{ color: 'var(--nd-text)' }}>{d.title}</h3>
                {d.description && <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--nd-muted)' }}>{d.description.substring(0, 80)}...</p>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
