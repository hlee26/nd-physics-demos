import { createClient } from '@supabase/supabase-js'
import type { SimulationSpec } from './simulations'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type DemoRow = {
  id: string
  title: string
  category: string
  subcategory: string
  slug: string
  description: string | null
  setup: string | null
  notes: string | null
  courses: string | null
  discussion_questions: string | null
  equipment: string | null
  original_url: string | null
  simulation_type: string | null
  simulation_config: SimulationSpec | null
  created_at: string
  updated_at: string
}
