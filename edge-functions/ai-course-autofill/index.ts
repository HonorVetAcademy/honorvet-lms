// Supabase Edge Function: ai-course-autofill
// Admin-only helper: given just a course title, suggests a description,
// tags, and whether it's likely mandatory/compliance training.
// Environment secrets required:
//   ANTHROPIC_API_KEY — from console.anthropic.com

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const MODEL = 'claude-haiku-4-5-20251001'

// Known tracks/topics this LMS already has curated cover photos for — nudging
// the model toward these keeps the auto-picked cover image relevant.
const KNOWN_TOPICS = [
  'US Healthcare Fresher', 'US Healthcare Physicians & Locums', 'US Healthcare VMSs',
  'US Healthcare Refresher', 'US IT Fresher', 'US IT Refresher',
  'Nursing', 'Cybersecurity', 'Safety/OSHA', 'Leadership', 'Cloud/Data',
  'Staffing/VMS/Hiring', 'Software/IT', 'Facilities', 'Contracts/Legal', 'Onboarding',
]

const TOOL = {
  name: 'suggest_course_details',
  description: 'Suggest metadata for a new training course based only on its title.',
  input_schema: {
    type: 'object',
    properties: {
      description: { type: 'string', description: 'A 1-2 sentence course description written for learners, explaining what they will learn.' },
      tags: {
        type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5,
        description: '2-5 short topical tags for this course. Include one of the known topic names if it clearly applies, plus a couple of specific keywords from the title itself.',
      },
      is_mandatory: { type: 'boolean', description: 'True only if the title strongly implies required/compliance training (e.g. safety, HIPAA, harassment, legal).' },
      duration_minutes: { type: 'number', description: 'A reasonable estimated duration in minutes for a course like this (typically 15-120).' },
    },
    required: ['description', 'tags', 'is_mandatory', 'duration_minutes'],
  },
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  try {
    const { title } = await req.json()
    const t = (title || '').toString().trim().slice(0, 200)
    if (!t) {
      return new Response(JSON.stringify({ error: 'No title provided' }), { status: 400, headers: CORS })
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: `You help an admin at a US staffing agency (HonorVet Technologies) quickly fill in details for a new training course, given only its title. Known topic areas already used on this platform: ${KNOWN_TOPICS.join(', ')}. Always call the suggest_course_details tool with your answer.`,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: 'suggest_course_details' },
        messages: [{ role: 'user', content: `Course title: "${t}"` }],
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('Anthropic error:', JSON.stringify(data))
      return new Response(JSON.stringify({ error: data.error?.message || 'AI request failed' }), { status: 502, headers: CORS })
    }

    const toolUse = (data.content || []).find((c: any) => c.type === 'tool_use')
    if (!toolUse) {
      return new Response(JSON.stringify({ error: 'No suggestion returned' }), { status: 502, headers: CORS })
    }

    return new Response(JSON.stringify(toolUse.input), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS })
  }
})
