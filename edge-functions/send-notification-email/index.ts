// Supabase Edge Function: send-notification-email
// Triggered by a Database Webhook on notifications INSERT
// Environment secrets required:
//   RESEND_API_KEY            — from resend.com
//   SUPABASE_URL              — auto-injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — from Project Settings > API

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FROM_ADDRESS = 'HonorVet LMS <onboarding@resend.dev>'
// Once honorvettech.com is verified in Resend DNS:
// const FROM_ADDRESS = 'HonorVet Learning <noreply@honorvettech.com>'

const BASE_URL = 'https://honorvetacademy.github.io/honorvet-lms'

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

    const firstName    = (user.name || user.email).split(' ')[0]
    const courseTitle  = notif.data?.course_title || ''
    const courseId     = notif.data?.course_id    || ''

    const { subject, html } = buildEmail(notif.type, firstName, courseTitle, courseId, notif.body)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to: user.email, subject, html }),
    })

    const result = await res.json()
    console.log('Resend response:', JSON.stringify(result))
    return new Response(JSON.stringify(result), { status: res.ok ? 200 : 400 })

  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(String(err), { status: 500 })
  }
})

// ── Template builder ────────────────────────────────────────────
function buildEmail(type: string, firstName: string, courseTitle: string, courseId: string, body: string) {
  const courseUrl = courseId
    ? `${BASE_URL}/course.html?id=${courseId}`
    : `${BASE_URL}/catalog.html`

  switch (type) {
    case 'course_assigned':
      return {
        subject: courseTitle
          ? `📚 New Course Assigned: ${courseTitle}`
          : '📚 You have a new course assigned',
        html: template({
          headerColor: '#1d4ed8',
          accentColor: '#dc2626',
          icon: '📚',
          heading: 'New Course Assigned',
          greeting: `Hi ${firstName},`,
          paragraphs: [
            `You have been assigned a new course${courseTitle ? `: <strong>${courseTitle}</strong>` : ''}.`,
            `Log in to the HonorVet Learning Platform to get started. Complete the course at your own pace and earn your certificate upon completion.`,
          ],
          ctaText: 'Start Learning →',
          ctaHref: courseUrl,
          footerNote: 'This course was assigned to you by your HonorVet administrator.',
        }),
      }

    case 'course_completed':
      return {
        subject: courseTitle
          ? `🎉 Congratulations! You completed "${courseTitle}"`
          : '🎉 Congratulations on completing your course!',
        html: template({
          headerColor: '#15803d',
          accentColor: '#dc2626',
          icon: '🎉',
          heading: 'Course Completed!',
          greeting: `Well done, ${firstName}!`,
          paragraphs: [
            `You have successfully completed${courseTitle ? ` <strong>${courseTitle}</strong>` : ' your course'}. Your progress has been recorded.`,
            `Keep up the great work — explore more courses in the catalog to continue growing your skills.`,
          ],
          ctaText: 'View My Progress →',
          ctaHref: `${BASE_URL}/dashboard.html`,
          footerNote: 'Your completion record is stored in the HonorVet Learning Platform.',
        }),
      }

    case 'certificate_issued':
      return {
        subject: courseTitle
          ? `🏆 Your Certificate is Ready — ${courseTitle}`
          : '🏆 Your Certificate of Completion is Ready',
        html: template({
          headerColor: '#92400e',
          accentColor: '#dc2626',
          icon: '🏆',
          heading: 'Certificate of Completion',
          greeting: `Congratulations, ${firstName}!`,
          paragraphs: [
            `Your <strong>Certificate of Completion</strong>${courseTitle ? ` for <strong>${courseTitle}</strong>` : ''} has been issued and is ready for download.`,
            `You can download or print your certificate anytime from your course page. Share it with your team or add it to your professional profile.`,
          ],
          ctaText: 'Download Certificate →',
          ctaHref: courseUrl,
          footerNote: 'Issued by HonorVet Technologies — honorvettech.com',
          badge: courseTitle ? `🎖 ${courseTitle}` : null,
        }),
      }

    default:
      return {
        subject: body || 'Notification from HonorVet LMS',
        html: template({
          headerColor: '#374151',
          accentColor: '#dc2626',
          icon: '🔔',
          heading: body || 'New Notification',
          greeting: `Hi ${firstName},`,
          paragraphs: [body || 'You have a new notification on the HonorVet Learning Platform.'],
          ctaText: 'Go to Platform →',
          ctaHref: `${BASE_URL}/dashboard.html`,
          footerNote: 'HonorVet Technologies — Learning Platform',
        }),
      }
  }
}

// ── Shared HTML template ────────────────────────────────────────
interface TemplateOpts {
  headerColor: string
  accentColor: string
  icon: string
  heading: string
  greeting: string
  paragraphs: string[]
  ctaText: string
  ctaHref: string
  footerNote: string
  badge?: string | null
}

function template(o: TemplateOpts): string {
  const badgeHtml = o.badge
    ? `<div style="margin:0 0 24px;padding:12px 20px;background:#fef3c7;border:1.5px solid #fbbf24;border-radius:8px;font-family:sans-serif;font-size:13px;color:#78350f;text-align:center;font-weight:600">${o.badge}</div>`
    : ''

  const parasHtml = o.paragraphs
    .map(p => `<p style="margin:0 0 14px;color:#374151;font-size:15px;line-height:1.65;font-family:sans-serif">${p}</p>`)
    .join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#f3f4f6;margin:0;padding:32px 16px;font-family:sans-serif">
  <div style="max-width:540px;margin:0 auto">

    <!-- Card -->
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.09)">

      <!-- Header -->
      <div style="background:${o.headerColor};padding:28px 32px 24px;border-bottom:4px solid ${o.accentColor}">
        <div style="font-size:36px;margin-bottom:8px">${o.icon}</div>
        <div style="color:#fff;font-size:21px;font-weight:800;letter-spacing:-.01em">${o.heading}</div>
        <div style="color:rgba(255,255,255,.65);font-size:12px;margin-top:4px;letter-spacing:.04em;text-transform:uppercase">HonorVet Technologies — Learning Platform</div>
      </div>

      <!-- Body -->
      <div style="padding:28px 32px 20px">
        <p style="margin:0 0 16px;color:#111827;font-size:15px;font-weight:600">${o.greeting}</p>
        ${parasHtml}
        ${badgeHtml}
        <a href="${o.ctaHref}"
           style="display:inline-block;background:${o.accentColor};color:#fff;padding:13px 30px;
                  border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;
                  letter-spacing:.02em;margin-top:4px">
          ${o.ctaText}
        </a>
      </div>

      <!-- Footer -->
      <div style="padding:14px 32px 18px;border-top:1px solid #e5e7eb">
        <p style="margin:0;font-size:11.5px;color:#9ca3af;line-height:1.5">${o.footerNote}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#d1d5db">
          You are receiving this because you are registered on the HonorVet Learning Platform.
        </p>
      </div>

    </div>

    <!-- Bottom brand bar -->
    <div style="text-align:center;margin-top:20px">
      <span style="font-size:13px;font-weight:800;color:#dc2626;letter-spacing:.02em">HonorVet</span>
      <span style="font-size:13px;color:#6b7280"> Technologies — </span>
      <a href="https://honorvettech.com" style="font-size:13px;color:#9ca3af;text-decoration:none">honorvettech.com</a>
    </div>

  </div>
</body>
</html>`
}
