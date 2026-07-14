// Supabase Edge Function: bulk-import-users
// Uses admin API to bypass auth rate limits
// Secrets required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const { users } = await req.json()
    if (!Array.isArray(users) || !users.length) {
      return new Response(JSON.stringify({ error: 'No users provided' }), { status: 400, headers: CORS })
    }

    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const success: string[] = []
    const failed: { email: string; reason: string }[] = []

    // Fetch all existing users once to avoid 130 separate list calls
    const { data: existingData } = await sbAdmin.auth.admin.listUsers({ perPage: 1000 })
    const existingMap = new Map((existingData?.users ?? []).map(u => [u.email!, u.id]))

    for (const user of users) {
      const email = user.email?.toLowerCase()?.trim()
      if (!email) continue
      try {
        const alreadyExists = existingMap.has(email)

        let userId: string

        if (alreadyExists) {
          userId = existingMap.get(email)!
        } else {
          const { data, error } = await sbAdmin.auth.admin.createUser({
            email,
            password: 'HonorVet@2024!',
            email_confirm: true,
            user_metadata: {
              name: user.name,
              role: user.role || 'employee',
              department: user.department || '',
            },
          })
          if (error) throw error
          userId = data.user.id
        }

        // Upsert profile in public.users
        const { error: upsertErr } = await sbAdmin.from('users').upsert({
          id: userId,
          email,
          name: user.name,
          role: user.role || 'employee',
          department: user.department || null,
        }, { onConflict: 'email' })

        if (upsertErr) throw upsertErr
        success.push(email)
      } catch (e: any) {
        failed.push({ email, reason: e.message })
      }
    }

    return new Response(
      JSON.stringify({ success: success.length, failed }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(String(err), { status: 500, headers: CORS })
  }
})
