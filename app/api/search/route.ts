import { NextResponse } from 'next/server'
import { searchDemos } from '@/lib/demos'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q') ?? ''
  if (query.length < 2) return NextResponse.json([])
  const results = await searchDemos(query)
  return NextResponse.json(results.slice(0, 8))
}
