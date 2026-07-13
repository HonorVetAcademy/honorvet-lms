// Supabase Edge Function: send-notification-email
// Triggered by a Database Webhook on notifications INSERT
// Environment secrets required:
//   RESEND_API_KEY          — from resend.com
//   SUPABASE_URL            — auto-injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — from Project Settings > API

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FROM_ADDRESS = 'HonorVet LMS <onboarding@resend.dev>'
// When honorvet.com is verified in Resend DNS, change to:
// const FROM_ADDRESS = 'HonorVet LMS <noreply@honorvet.com>'

serve(async (req: Request) => {
  try {
    const payload = await req.json()
    const notif = payload.record
    if (!notif) return new Response('no record', { status: 200 })

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: user } = await sb
      .from('users')
      .select('email, name')
      .eq('id', notif.user_id)
      .single()

    if (!user?.email) return new Response('no user email', { status: 200 })

    const firstName = (user.name || user.email).split(' ')[0]

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: user.email,
        subject: notif.title,
        html: buildEmailHtml(notif, firstName),
      }),
    })

    const result = await res.json()
    console.log('Resend response:', JSON.stringify(result))
    return new Response(JSON.stringify(result), { status: res.ok ? 200 : 400 })

  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(String(err), { status: 500 })
  }
})

function buildEmailHtml(notif: any, firstName: string): string {
  const icons: Record<string, string> = {
    course_assigned:    '📚',
    certificate_issued: '🏆',
    path_assigned:      '🗂',
  }
  const ctaLabels: Record<string, string> = {
    course_assigned:    'Start Learning →',
    certificate_issued: 'View My Certificates →',
    path_assigned:      'View My Learning Path →',
  }
  const ctaLinks: Record<string, string> = {
    course_assigned:    'https://honorvetacademy.github.io/honorvet-lms/catalog.html',
    certificate_issued: 'https://honorvetacademy.github.io/honorvet-lms/dashboard.html',
    path_assigned:      'https://honorvetacademy.github.io/honorvet-lms/paths.html',
  }

  const icon    = icons[notif.type]    || '🔔'
  const cta     = ctaLabels[notif.type] || 'Go to Learning Platform →'
  const ctaLink = ctaLinks[notif.type]  || 'https://honorvetacademy.github.io/honorvet-lms/dashboard.html'

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#f5f6fa;margin:0;padding:32px 16px">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#1a56db,#3b82f6);padding:28px 32px">
      <div style="font-size:38px;margin-bottom:10px">${icon}</div>
      <div style="color:#ffffff;font-size:20px;font-weight:700;line-height:1.3">${notif.title}</div>
    </div>
    <div style="padding:28px 32px">
      <p style="color:#374151;font-size:15px;margin:0 0 14px">Hi ${firstName},</p>
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 28px">${notif.body || ''}</p>
      <a href="${ctaLink}"
         style="display:inline-block;background:#1a56db;color:#ffffff;padding:12px 28px;
                border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        ${cta}
      </a>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #e5e7eb">
      <p style="margin:0;font-size:12px;color:#9ca3af">
        HonorVet Technologies — Learning Platform<br>
        You are receiving this because a course or path was assigned to your account.
      </p>
    </div>
  </div>
</body>
</html>`
}
