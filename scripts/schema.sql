-- Run this in the Supabase SQL Editor (supabase.com > your project > SQL Editor)
-- This creates the demos table with the correct schema

CREATE TABLE IF NOT EXISTS demos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  setup TEXT,
  notes TEXT,
  courses TEXT,
  discussion_questions TEXT,
  equipment TEXT,
  original_url TEXT,
  simulation_type TEXT,
  simulation_config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast category/subcategory lookups
CREATE INDEX IF NOT EXISTS demos_category_idx ON demos(category);
CREATE INDEX IF NOT EXISTS demos_subcategory_idx ON demos(subcategory);
CREATE INDEX IF NOT EXISTS demos_category_subcategory_idx ON demos(category, subcategory);
CREATE INDEX IF NOT EXISTS demos_slug_idx ON demos(slug);

-- Full text search index
CREATE INDEX IF NOT EXISTS demos_title_search_idx ON demos USING gin(to_tsvector('english', title));

-- Enable Row Level Security (RLS) but allow all reads and writes for anon key
ALTER TABLE demos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON demos
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON demos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update" ON demos
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete" ON demos
  FOR DELETE USING (true);
