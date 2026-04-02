import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCategories, getSubcategories, getDemosBySubcategory, getDemosByCategory, CATEGORY_LABELS, CATEGORY_ICONS, CATEGORY_COLORS, SUBCATEGORY_LABELS } from '@/lib/demos'

export const revalidate = 60

export async function generateStaticParams() {
  const categories = await getCategories()
  return categories.map(category => ({ category }))
}

export default async function CategoryPage({ params }: { params: { category: string } }) {
  const { category } = params
  const label = CATEGORY_LABELS[category]
  if (!label) notFound()

  const [subcategories, allDemos] = await Promise.all([
    getSubcategories(category),
    getDemosByCategory(category),
  ])
  const color = CATEGORY_COLORS[category]

  const subcategoryDemos = await Promise.all(
    subcategories.map(async sub => ({ sub, demos: await getDemosBySubcategory(category, sub) }))
  )

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <nav className="text-xs mb-8" style={{ color: 'var(--nd-muted)' }}>
        <Link href="/" className="hover:text-nd-gold transition-colors">Home</Link>
        <span className="mx-2">›</span>
        <span style={{ color: 'var(--nd-text)' }}>{label}</span>
      </nav>

      <div className="paper-panel p-8 mb-12 relative overflow-hidden">
        <div className="flex items-center gap-4 mb-4 relative">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center text-4xl" style={{ background: `${color}18` }}>{CATEGORY_ICONS[category]}</div>
          <div>
            <div className="eyebrow mb-1">Subject Area</div>
            <h1 className="text-4xl font-black" style={{ fontFamily: 'var(--font-display)', color: 'var(--nd-text)' }}>{label}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--nd-muted)' }}>
              {subcategories.length} subcategories · {allDemos.length} demonstrations
            </p>
          </div>
        </div>
        <div className="h-1.5 w-28 rounded-full" style={{ background: color }} />
      </div>

      <div className="space-y-10">
        {subcategoryDemos.map(({ sub, demos }) => (
          <div key={sub}>
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--nd-text)' }}>
                {SUBCATEGORY_LABELS[sub] || sub}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${color}14`, color }}>
                {demos.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {demos.map(demo => (
                <Link key={demo.id} href={`/${demo.category}/${demo.subcategory}/${demo.slug}`} className="glass-card glass-card-hover p-4 group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm mb-1 transition-colors truncate" style={{ color: 'var(--nd-text)' }}>
                        {demo.title}
                      </h3>
                      {demo.description && (
                        <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--nd-muted)' }}>
                          {demo.description.replace(/\* Equipment seen in the video.*?setup\./g, '').trim()}
                        </p>
                      )}
                      {demo.courses && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {demo.courses.split(',').map(c => c.trim()).filter(Boolean).map(c => (
                            <span key={c} className="px-1.5 py-0.5 rounded text-xs" style={{ background: `${color}15`, color }}>{c}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 opacity-40 group-hover:opacity-80 transition-opacity mt-0.5" style={{ color }}>
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
