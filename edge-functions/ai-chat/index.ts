// Supabase Edge Function: ai-chat
// Powers the "Ask AI" assistant widget on the dashboard and course pages.
// Environment secrets required:
//   ANTHROPIC_API_KEY — from console.anthropic.com

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_HISTORY_MESSAGES = 10 // caller-supplied prior turns, trimmed defensively

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  try {
    const { question, history, context } = await req.json()
    const q = (question || '').toString().trim().slice(0, 2000)
    if (!q) {
      return new Response(JSON.stringify({ error: 'No question provided' }), { status: 400, headers: CORS })
    }

    const contextLines: string[] = []
    if (context?.userName)   contextLines.push(`The learner's name is ${context.userName}.`)
    if (context?.userRole)   contextLines.push(`Their role is ${context.userRole}.`)
    if (context?.courseTitle) {
      contextLines.push(`They are currently viewing the course "${context.courseTitle}".`)
      if (context.courseDescription) contextLines.push(`Course description: ${context.courseDescription}`)
    }

    const systemPrompt = `You are the HonorVet Academy Assistant, a helpful guide embedded in HonorVet Technologies' internal learning platform for US staffing recruiters (healthcare and IT staffing tracks).

Answer questions about: how to use the platform (courses, learning paths, certificates, progress tracking), and general questions about the currently-viewed course's subject matter.

Rules:
- Be concise — 2-4 sentences unless the question genuinely needs more.
- If you don't know something specific to this company's internal process, say so plainly rather than guessing.
- Never invent policies, URLs, or course content that wasn't given to you.
- Friendly, professional tone.
${contextLines.length ? '\nContext:\n' + contextLines.join('\n') : ''}`

    const priorMessages = Array.isArray(history)
      ? history.slice(-MAX_HISTORY_MESSAGES).map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: (m.content || '').toString().slice(0, 2000),
        }))
      : []

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system: systemPrompt,
        messages: [...priorMessages, { role: 'user', content: q }],
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('Anthropic error:', JSON.stringify(data))
      return new Response(JSON.stringify({ error: data.error?.message || 'AI request failed' }), { status: 502, headers: CORS })
    }

    const answer = data.content?.[0]?.text || "Sorry, I couldn't come up with an answer to that.";
    return new Response(JSON.stringify({ answer }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS })
  }
})
