/**
 * Seed script — imports all demos from demos-data.json into Supabase
 * Run with: npm run seed
 */
import { createClient } from '@supabase/supabase-js'
import demosData from '../lib/demos-data.json'
import { buildSimulationForStorage } from '../lib/simulations'

const supabaseUrl = 'https://jkmzjqczaflyoyrjintn.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprbXpqcWN6YWZseW95cmppbnRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NzA0MDcsImV4cCI6MjA4ODI0NjQwN30.hqnKJt9U0A3euvxcsPkC_q9MdXnESKsTMLKguQMP1cg'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function seed() {
  console.log(`🌱 Seeding ${demosData.length} demos into Supabase...`)

  // Insert in batches of 50 to avoid request limits
  const batchSize = 50
  let inserted = 0
  let errors = 0

  for (let i = 0; i < demosData.length; i += batchSize) {
    const batch = demosData.slice(i, i + batchSize).map(d => ({
      ...buildSimulationForStorage(d),
      id: d.id,
      title: d.title || '',
      category: d.category || '',
      subcategory: d.subcategory || '',
      slug: d.slug || '',
      description: d.description || null,
      setup: d.setup || null,
      notes: d.notes || null,
      courses: d.courses || null,
      discussion_questions: d.discussion_questions || null,
      equipment: d.equipment || null,
      original_url: d.original_url || null,
    }))

    const { error } = await supabase
      .from('demos')
      .upsert(batch, { onConflict: 'id' })

    if (error) {
      console.error(`❌ Batch ${i / batchSize + 1} error:`, error.message)
      errors += batch.length
    } else {
      inserted += batch.length
      console.log(`✅ Batch ${i / batchSize + 1}: inserted ${batch.length} demos (${inserted} total)`)
    }
  }

  console.log(`\n📊 Done! ${inserted} inserted, ${errors} errors`)

  if (errors > 0) {
    console.log('⚠️  Some demos failed. Check the errors above.')
    console.log('   Make sure you ran the SQL schema first in Supabase!')
  } else {
    console.log('🎉 All demos successfully seeded!')
  }
}

seed().catch(console.error)
