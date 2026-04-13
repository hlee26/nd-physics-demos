export default function Loading() {
  return (
    <div className="relative">
      {/* Hero skeleton */}
      <section className="relative overflow-hidden pt-14 pb-24 px-6">
        <div className="relative max-w-6xl mx-auto">
          <div className="paper-panel px-6 py-10 sm:px-10 sm:py-12">
            <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_0.8fr] gap-10 items-start">
              <div className="space-y-4">
                <div className="h-3 w-48 rounded-full shimmer" />
                <div className="h-12 w-4/5 rounded-xl shimmer" />
                <div className="h-12 w-3/5 rounded-xl shimmer" />
                <div className="space-y-2 mt-2">
                  <div className="h-4 w-full rounded shimmer" />
                  <div className="h-4 w-5/6 rounded shimmer" />
                  <div className="h-4 w-4/6 rounded shimmer" />
                </div>
                <div className="flex gap-3 mt-4">
                  <div className="h-11 w-44 rounded-full shimmer" />
                  <div className="h-11 w-36 rounded-full shimmer" />
                </div>
              </div>
              <div className="glass-card p-6 space-y-4">
                <div className="h-3 w-28 rounded-full shimmer" />
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex justify-between border-b pb-3" style={{ borderColor: 'rgba(12,26,60,0.08)' }}>
                    <div className="h-4 w-24 rounded shimmer" />
                    <div className="h-6 w-12 rounded shimmer" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use-case cards skeleton */}
      <section className="max-w-6xl mx-auto px-6 mb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card p-5 space-y-2">
              <div className="h-3 w-20 rounded-full shimmer" />
              <div className="h-4 w-full rounded shimmer" />
              <div className="h-4 w-4/5 rounded shimmer" />
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider mx-6 mb-16" />

      {/* Category grid skeleton */}
      <section className="max-w-6xl mx-auto px-6 mb-20">
        <div className="mb-10 space-y-2">
          <div className="h-3 w-32 rounded-full shimmer" />
          <div className="h-8 w-40 rounded-xl shimmer" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-card p-6 space-y-3">
              <div className="w-12 h-12 rounded-xl shimmer" />
              <div className="h-5 w-3/4 rounded shimmer" />
              <div className="h-3 w-1/2 rounded shimmer" />
              <div className="space-y-1.5 pt-1">
                <div className="h-3 w-full rounded shimmer" />
                <div className="h-3 w-5/6 rounded shimmer" />
                <div className="h-3 w-4/6 rounded shimmer" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
