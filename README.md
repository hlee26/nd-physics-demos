# ND Physics Demos — Modern Website

A redesigned, AI-powered website for the ND Physics Demonstrations catalog with Supabase database and OpenAI chatbot.

## Features

- **194 demos** from Supabase — live updates without redeploying
- **AI Demo Assistant** — powered by GPT-4o with tool use (search, add, update, delete demos)
- **Full-text search** from the navbar
- **Dynamic routing** — every demo at `/{category}/{subcategory}/{slug}`
- **Responsive dark design** — ND navy + gold theme

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Supabase** (Postgres database)
- **OpenAI GPT-4o** (AI chatbot with tool use)
- **Tailwind CSS**
- **Vercel** (recommended hosting)

## Setup (5 steps)

### 1. Install dependencies
```bash
npm install
```

### 2. Create the database table in Supabase
Go to [supabase.com](https://supabase.com) → your project → **SQL Editor**, paste and run the contents of `scripts/schema.sql`.

### 3. Set up environment variables
```bash
cp .env.example .env.local
```
Edit `.env.local` — it already has your Supabase URL and anon key filled in. Just add your OpenAI key:
```
OPENAI_API_KEY=sk-...your-key-here...
```
Get your key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys).

### 4. Seed the database
```bash
npm run seed
```
This imports all 194 demos from the JSON file into Supabase. Takes ~10 seconds.

### 5. Run the dev server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) 🎉

## What the AI chatbot can do

The chatbot uses GPT-4o with **tool use** — it can actually modify the database:

- **Search**: "Find all demos using a Van de Graaff generator"
- **Add**: "Add a new demo called Magnetic Levitation under E&M > Magnetic Materials with equipment: neodymium magnet, bismuth plate"
- **Update**: "Update the Newton's Cradle demo to add PHY 30220 to the courses"
- **Delete**: "Delete the broken Double Induction Coils demo" (always confirms first)

## Deploying to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import repo
3. Add environment variables:
   - `OPENAI_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy!

## Project Structure

```
app/
  page.tsx                              → Home page
  layout.tsx                            → Root layout
  globals.css                           → Styles + design tokens
  api/chat/route.ts                     → OpenAI chatbot with tools
  api/search/route.ts                   → Search API
  category/[category]/page.tsx          → Category overview
  [category]/[subcategory]/[demo]/      → Demo detail pages
components/
  Navbar.tsx                            → Nav with search
  AiChat.tsx                            → AI chatbox UI
lib/
  demos.ts                              → Supabase query functions
  supabase.ts                           → Supabase client
  demos-data.json                       → Source data (used for seeding)
scripts/
  schema.sql                            → Run in Supabase SQL Editor first
  seed-supabase.ts                      → Imports JSON into Supabase
```
