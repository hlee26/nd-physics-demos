import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { addDemo, updateDemo, deleteDemo, getDemoById, searchDemos, CATEGORY_LABELS, SUBCATEGORY_LABELS } from '@/lib/demos'
import { buildSimulationForStorage } from '@/lib/simulations'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? 'gpt-5.2'
const OPENAI_REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT ?? 'medium'

const SYSTEM_PROMPT = `You are a helpful assistant for the University of Notre Dame Physics Demonstrations website. You manage a catalog of 194 physics demos used in teaching.

You can help users:
1. Find and search for demos by topic, equipment, physics concept, or course number
2. Get setup instructions and equipment lists for specific demos
3. Add brand new demos to the catalog
4. Update existing demos (fix descriptions, add equipment, update courses, etc.)
5. Delete demos that are broken or retired
6. Ensure new or updated demos include simulation metadata when possible

CATEGORIES: mechanics, e-m, modern, astro, fluids, optics, oscillations-waves, thermo

SUBCATEGORIES:
- mechanics: measurement, motion-in-one-dimension, motion-in-two-dimensions, newtons-first-law, newtons-second-law, newtons-third-law, statics-of-rigid-bodies, applications-of-newtons-laws, gravity-1, work-and-energy, linear-momentum, rotational-dynamics, properties-of-matter
- e-m: electrostatics, electric-fields-and-potential, capacitance, resistance, dc-circuits-demos, magnetic-materials, magnetic-fields-and-forces, inductance, electromagnetic-induction, ac-circuits, electromagnetic-radiation
- modern: relativity, quantum-effects, atomic-physics, nuclear-physics
- astro: stellar-astronomy, cosmology
- fluids: statics-of-fluids, dynamics-of-fluids
- optics: geometrical-optics, photometry, diffraction, interference, color, polarization, spectrophotometry
- oscillations-waves: oscillations, wave-motion, acoustics-1, instruments
- thermo: thermal-properties-of-matter, heat-and-the-first-law, change-of-state, gas-law, entropy-and-the-second-law

COURSES: PHY 10320 (intro), PHY 20435 (E&M), PHY 30220 (advanced)

When adding a demo, generate a slug from the title (lowercase, hyphens) and an id as category_subcategory_slug.
Every new demo should have a simulation. If the user does not specify one, the system will infer one from the demo record.
Always confirm with the user before deleting. Be enthusiastic and concise!`

const tools = [
  {
    type: 'function',
    function: {
      name: 'search_demos',
      description: 'Search the demo catalog by keyword — topic, equipment, title, or course number.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search term' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_demo',
      description: 'Add a new physics demonstration to the catalog.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique ID: category_subcategory_slug' },
          title: { type: 'string' },
          category: { type: 'string' },
          subcategory: { type: 'string' },
          slug: { type: 'string', description: 'URL-safe slug (lowercase, hyphens)' },
          description: { type: 'string' },
          setup: { type: 'string' },
          notes: { type: 'string' },
          courses: { type: 'string', description: 'Comma-separated course numbers' },
          equipment: { type: 'string', description: 'Comma-separated equipment list' },
          original_url: { type: 'string' },
          simulation_type: { type: 'string', description: 'Optional simulation type to store with the demo' },
          simulation_config: { type: 'object', description: 'Optional simulation configuration object' },
        },
        required: ['id', 'title', 'category', 'subcategory', 'slug']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_demo',
      description: 'Update fields on an existing demo. Search first to find the ID.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Demo ID to update' },
          title: { type: 'string' },
          description: { type: 'string' },
          setup: { type: 'string' },
          notes: { type: 'string' },
          courses: { type: 'string' },
          equipment: { type: 'string' },
          category: { type: 'string' },
          subcategory: { type: 'string' },
          slug: { type: 'string' },
          simulation_type: { type: 'string' },
          simulation_config: { type: 'object' },
        },
        required: ['id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_demo',
      description: 'Permanently delete a demo. Confirm with user first.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Demo ID to delete' }
        },
        required: ['id']
      }
    }
  }
]

type ToolArgs = Record<string, unknown>
type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

async function executeTool(name: string, args: ToolArgs) {
  try {
    switch (name) {
      case 'search_demos': {
        const results = await searchDemos(String(args.query ?? ''))
        if (results.length === 0) return 'No demos found matching that query.'
        return JSON.stringify(results.map(d => ({
          id: d.id,
          title: d.title,
          category: CATEGORY_LABELS[d.category] ?? d.category,
          subcategory: SUBCATEGORY_LABELS[d.subcategory] ?? d.subcategory,
          courses: d.courses,
          equipment: d.equipment,
          description: d.description?.substring(0, 200),
        })))
      }
      case 'add_demo': {
        const simulation = buildSimulationForStorage({
          title: String(args.title),
          category: String(args.category),
          subcategory: String(args.subcategory),
          description: typeof args.description === 'string' ? args.description : null,
          setup: typeof args.setup === 'string' ? args.setup : null,
          notes: typeof args.notes === 'string' ? args.notes : null,
          equipment: typeof args.equipment === 'string' ? args.equipment : null,
          simulation_type: typeof args.simulation_type === 'string' ? args.simulation_type : null,
          simulation_config: typeof args.simulation_config === 'object' && args.simulation_config !== null ? args.simulation_config as any : null,
        })
        const demo = await addDemo({
          id: String(args.id),
          title: String(args.title),
          category: String(args.category),
          subcategory: String(args.subcategory),
          slug: String(args.slug),
          description: typeof args.description === 'string' ? args.description : null,
          setup: typeof args.setup === 'string' ? args.setup : null,
          notes: typeof args.notes === 'string' ? args.notes : null,
          courses: typeof args.courses === 'string' ? args.courses : null,
          discussion_questions: null,
          equipment: typeof args.equipment === 'string' ? args.equipment : null,
          original_url: typeof args.original_url === 'string' ? args.original_url : null,
          simulation_type: simulation.simulation_type,
          simulation_config: simulation.simulation_config,
        })
        return `Successfully added "${demo.title}" (ID: ${demo.id}). Simulation created and live at /${demo.category}/${demo.subcategory}/${demo.slug}`
      }
      case 'update_demo': {
        const { id, ...updates } = args
        const demoId = String(id)
        const existing = await getDemoById(demoId)
        if (!existing) return `Demo with ID "${demoId}" not found. Try searching first.`
        const simulation = buildSimulationForStorage({
          title: typeof updates.title === 'string' ? updates.title : existing.title,
          category: typeof updates.category === 'string' ? updates.category : existing.category,
          subcategory: typeof updates.subcategory === 'string' ? updates.subcategory : existing.subcategory,
          description: typeof updates.description === 'string' ? updates.description : existing.description,
          setup: typeof updates.setup === 'string' ? updates.setup : existing.setup,
          notes: typeof updates.notes === 'string' ? updates.notes : existing.notes,
          equipment: typeof updates.equipment === 'string' ? updates.equipment : existing.equipment,
          simulation_type: typeof updates.simulation_type === 'string' ? updates.simulation_type : existing.simulation_type,
          simulation_config: typeof updates.simulation_config === 'object' && updates.simulation_config !== null ? updates.simulation_config as any : existing.simulation_config,
        })
        const updated = await updateDemo(demoId, { ...updates, ...simulation })
        return `Successfully updated "${updated.title}".`
      }
      case 'delete_demo': {
        const demoId = String(args.id)
        const existing = await getDemoById(demoId)
        if (!existing) return `Demo with ID "${demoId}" not found.`
        await deleteDemo(demoId)
        return `Successfully deleted "${existing.title}" from the catalog.`
      }
      default:
        return 'Unknown tool.'
    }
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`
  }
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json() as { messages: ChatMessage[] }

    const openaiMessages: any[] = [
      { role: 'developer', content: SYSTEM_PROMPT },
      ...messages.map((m: ChatMessage) => ({ role: m.role, content: m.content }))
    ]

    let response = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      reasoning_effort: OPENAI_REASONING_EFFORT as any,
      messages: openaiMessages as any,
      tools: tools as any,
      tool_choice: 'auto',
    })

    let iterations = 0
    while (response.choices[0].finish_reason === 'tool_calls' && iterations < 5) {
      iterations++
      const assistantMessage = response.choices[0].message
      openaiMessages.push(assistantMessage)

      const toolResults = await Promise.all(
        (assistantMessage.tool_calls ?? []).map(async tc => {
          const args = JSON.parse(tc.function.arguments)
          const result = await executeTool(tc.function.name, args)
          return { role: 'tool', tool_call_id: tc.id, content: result }
        })
      )

      openaiMessages.push(...toolResults)

      response = await openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        reasoning_effort: OPENAI_REASONING_EFFORT as any,
        messages: openaiMessages as any,
        tools: tools as any,
        tool_choice: 'auto',
      })
    }

    const text = response.choices[0].message.content ?? 'Sorry, I could not generate a response.'
    return NextResponse.json({ response: text })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { response: 'Sorry, I encountered an error. Please check your API key and try again.' },
      { status: 500 }
    )
  }
}
