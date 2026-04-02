import { supabase, type DemoRow } from './supabase'

export type Demo = DemoRow

export const CATEGORY_LABELS: Record<string, string> = {
  mechanics: 'Mechanics',
  'e-m': 'E & M',
  modern: 'Modern Physics',
  astro: 'Astrophysics',
  fluids: 'Fluids',
  optics: 'Optics',
  'oscillations-waves': 'Oscillations & Waves',
  thermo: 'Thermodynamics',
}

export const CATEGORY_ICONS: Record<string, string> = {
  mechanics: '⚙️',
  'e-m': '⚡',
  modern: '⚛️',
  astro: '🌌',
  fluids: '💧',
  optics: '🔭',
  'oscillations-waves': '〰️',
  thermo: '🌡️',
}

export const CATEGORY_COLORS: Record<string, string> = {
  mechanics: '#3B82F6',
  'e-m': '#F59E0B',
  modern: '#8B5CF6',
  astro: '#06B6D4',
  fluids: '#10B981',
  optics: '#EC4899',
  'oscillations-waves': '#F97316',
  thermo: '#EF4444',
}

export const SUBCATEGORY_LABELS: Record<string, string> = {
  'stellar-astronomy': 'Stellar Astronomy',
  cosmology: 'Cosmology',
  'ac-circuits': 'AC Circuits',
  capacitance: 'Capacitance',
  'dc-circuits-demos': 'DC Circuits',
  'electric-fields-and-potential': 'Electric Fields & Potential',
  'electromagnetic-induction': 'Electromagnetic Induction',
  'electromagnetic-radiation': 'Electromagnetic Radiation',
  electrostatics: 'Electrostatics',
  inductance: 'Inductance',
  'magnetic-fields-and-forces': 'Magnetic Fields & Forces',
  'magnetic-materials': 'Magnetic Materials',
  resistance: 'Resistance',
  'dynamics-of-fluids': 'Dynamics of Fluids',
  'statics-of-fluids': 'Statics of Fluids',
  'applications-of-newtons-laws': "Applications of Newton's Laws",
  'gravity-1': 'Gravity',
  'linear-momentum': 'Linear Momentum & Collisions',
  measurement: 'Measurement',
  'motion-in-one-dimension': 'Motion in One Dimension',
  'motion-in-two-dimensions': 'Motion in Two Dimensions',
  'newtons-first-law': "Newton's First Law",
  'newtons-second-law': "Newton's Second Law",
  'newtons-third-law': "Newton's Third Law",
  'properties-of-matter': 'Properties of Matter',
  'rotational-dynamics': 'Rotational Dynamics',
  'statics-of-rigid-bodies': 'Statics of Rigid Bodies',
  'work-and-energy': 'Work & Energy',
  'atomic-physics': 'Atomic Physics',
  'nuclear-physics': 'Nuclear Physics',
  'quantum-effects': 'Quantum Effects',
  relativity: 'Relativity',
  color: 'Color',
  diffraction: 'Diffraction',
  'geometrical-optics': 'Geometrical Optics',
  interference: 'Interference',
  photometry: 'Photometry',
  polarization: 'Polarization',
  spectrophotometry: 'Spectrophotometry',
  'acoustics-1': 'Acoustics',
  instruments: 'Instruments',
  oscillations: 'Oscillations',
  'wave-motion': 'Wave Motion',
  'change-of-state': 'Change of State',
  'entropy-and-the-second-law': 'Entropy & Second Law',
  'gas-law': 'Gas Law',
  'heat-and-the-first-law': 'Heat & First Law',
  'thermal-properties-of-matter': 'Thermal Properties of Matter',
}

export async function getAllDemos(): Promise<Demo[]> {
  const { data, error } = await supabase.from('demos').select('*').order('title')
  if (error) throw error
  return data ?? []
}

export async function getDemosByCategory(category: string): Promise<Demo[]> {
  const { data, error } = await supabase.from('demos').select('*').eq('category', category).order('title')
  if (error) throw error
  return data ?? []
}

export async function getDemosBySubcategory(category: string, subcategory: string): Promise<Demo[]> {
  const { data, error } = await supabase.from('demos').select('*').eq('category', category).eq('subcategory', subcategory).order('title')
  if (error) throw error
  return data ?? []
}

export async function getDemo(category: string, subcategory: string, slug: string): Promise<Demo | null> {
  const { data, error } = await supabase.from('demos').select('*').eq('category', category).eq('subcategory', subcategory).eq('slug', slug).single()
  if (error) return null
  return data
}

export async function getCategories(): Promise<string[]> {
  const { data, error } = await supabase.from('demos').select('category')
  if (error) throw error
  return Array.from(new Set((data ?? []).map((d: { category: string }) => d.category))).sort()
}

export async function getSubcategories(category: string): Promise<string[]> {
  const { data, error } = await supabase.from('demos').select('subcategory').eq('category', category)
  if (error) throw error
  return Array.from(new Set((data ?? []).map((d: { subcategory: string }) => d.subcategory))).sort()
}

export async function searchDemos(query: string): Promise<Demo[]> {
  const { data, error } = await supabase
    .from('demos')
    .select('*')
    .or(`title.ilike.%${query}%,description.ilike.%${query}%,equipment.ilike.%${query}%,courses.ilike.%${query}%`)
    .order('title')
    .limit(20)
  if (error) throw error
  return data ?? []
}

export async function addDemo(demo: Omit<Demo, 'created_at' | 'updated_at'>): Promise<Demo> {
  const { data, error } = await supabase.from('demos').insert([demo]).select().single()
  if (error) throw error
  return data
}

export async function updateDemo(id: string, updates: Partial<Omit<Demo, 'id' | 'created_at' | 'updated_at'>>): Promise<Demo> {
  const { data, error } = await supabase.from('demos').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteDemo(id: string): Promise<void> {
  const { error } = await supabase.from('demos').delete().eq('id', id)
  if (error) throw error
}

export async function getDemoById(id: string): Promise<Demo | null> {
  const { data, error } = await supabase.from('demos').select('*').eq('id', id).single()
  if (error) return null
  return data
}
