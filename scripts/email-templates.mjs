// Generates the Supabase Auth email templates in supabase/templates/ from one
// shared layout, so every email carries the same identity.
//
//   npm run emails        -> rewrite supabase/templates/*.html
//
// The output is what Supabase renders (Go templates: {{ .SiteURL }},
// {{ .TokenHash }}, {{ .Data.full_name }}, …). Local stacks read it through
// supabase/config.toml; the hosted project needs each file pasted into
// Authentication → Emails → Templates (README, "Auth emails").
//
// Email-client rules followed here: table layout, inline styles (Gmail keeps
// the <style> block, Outlook ignores most of it, so it only adds the mobile
// and dark-mode refinements), no image needed to understand anything, a
// "bulletproof" button that is a real link, and the same link printed as text
// for clients that block buttons. Links carry the token *hash*, never the
// 6-digit code, and only through /auth/callback, which verifies it on the
// server.
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BRAND = 'Cerquita'
const PRIMARY = '#c2410c' // --primary in app/globals.css
const TEXT = '#1c1917'
const MUTED = '#57534e'
const SUBTLE = '#78716c'
const BORDER = '#e7e5e4'
const BACKGROUND = '#f5f5f4'
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

const GREETING =
  '{{ if .Data.full_name }}Hola, {{ .Data.full_name }}:{{ else }}Hola:{{ end }}'

/** Link that lands on /auth/callback, which verifies the hash server-side. */
function callbackLink(type, next) {
  const nextParam = next ? `&amp;next=${encodeURIComponent(next)}` : ''
  return `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&amp;type=${type}${nextParam}`
}

function paragraph(html) {
  return `<p style="margin:0 0 16px 0;font-size:16px;line-height:24px;color:${MUTED};">${html}</p>`
}

function button(href, label) {
  return `
            <tr>
              <td class="px" align="center" style="padding:8px 40px 8px 40px;">
                <table role="presentation" class="btn" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" bgcolor="${PRIMARY}" style="background-color:${PRIMARY};border-radius:999px;">
                      <a href="${href}" target="_blank" style="display:inline-block;padding:15px 36px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${label}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
}

function fallbackLink(href) {
  return `
            <tr>
              <td class="px" style="padding:20px 40px 0 40px;">
                <p style="margin:0 0 6px 0;font-size:13px;line-height:20px;color:${SUBTLE};">¿El botón no funciona? Copia y pega este enlace en tu navegador:</p>
                <p style="margin:0;font-size:13px;line-height:20px;word-break:break-all;"><a href="${href}" target="_blank" style="color:${PRIMARY};text-decoration:underline;">${href}</a></p>
              </td>
            </tr>`
}

function notice(html) {
  return `
            <tr>
              <td class="px" style="padding:24px 40px 0 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td class="notice" style="padding:14px 16px;background-color:#fafaf9;border:1px solid ${BORDER};border-radius:12px;font-size:13px;line-height:20px;color:${MUTED};">${html}</td>
                  </tr>
                </table>
              </td>
            </tr>`
}

function code(token) {
  return `
            <tr>
              <td class="px" align="center" style="padding:8px 40px 8px 40px;">
                <p class="code" style="margin:0;display:inline-block;padding:14px 24px;background-color:#fff7ed;border:1px solid #fed7aa;border-radius:12px;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:30px;line-height:36px;font-weight:700;letter-spacing:8px;color:${TEXT};">${token}</p>
              </td>
            </tr>`
}

function layout({ title, preheader, heading, intro, rows }) {
  return `<!doctype html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${title}</title>
    <style>
      @media only screen and (max-width: 600px) {
        .outer { padding: 16px 8px !important; }
        .px { padding-left: 20px !important; padding-right: 20px !important; }
        .btn, .btn td, .btn a { display: block !important; width: 100% !important; box-sizing: border-box; }
        h1 { font-size: 22px !important; line-height: 28px !important; }
      }
      @media (prefers-color-scheme: dark) {
        .bg { background-color: #0c0a09 !important; }
        .card { background-color: #1c1917 !important; border-color: #292524 !important; }
        .card h1, .card .brand, .code { color: #fafaf9 !important; }
        .card p, .notice { color: #d6d3d1 !important; }
        .notice { background-color: #292524 !important; border-color: #44403c !important; }
        .code { background-color: #292524 !important; border-color: #9a3412 !important; }
      }
    </style>
  </head>
  <body class="bg" style="margin:0;padding:0;background-color:${BACKGROUND};font-family:${FONT};-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;">${preheader}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
    <table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BACKGROUND};">
      <tr>
        <td class="outer" align="center" style="padding:40px 16px;">
          <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid ${BORDER};border-radius:20px;">
            <tr>
              <td class="px" style="padding:32px 40px 0 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="width:12px;height:12px;background-color:${PRIMARY};border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>
                    <td class="brand" style="padding-left:10px;font-size:20px;line-height:24px;font-weight:800;letter-spacing:-0.02em;color:${TEXT};">${BRAND}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="px" style="padding:28px 40px 8px 40px;">
                <h1 style="margin:0 0 16px 0;font-size:26px;line-height:32px;font-weight:700;letter-spacing:-0.01em;color:${TEXT};">${heading}</h1>
                <p style="margin:0 0 16px 0;font-size:16px;line-height:24px;font-weight:600;color:${TEXT};">${GREETING}</p>
                ${intro.map(paragraph).join('\n                ')}
              </td>
            </tr>${rows.join('')}
            <tr>
              <td class="px" style="padding:32px 40px 32px 40px;">
                <p style="margin:0;padding-top:20px;border-top:1px solid ${BORDER};font-size:12px;line-height:18px;color:${SUBTLE};">
                  ${BRAND} · Pedidos a los restaurantes de tu barrio.<br />
                  Recibes este correo porque esta dirección se usó en ${BRAND}. Es un mensaje automático: no lo respondas.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`
}

const SECURITY_NOT_YOU =
  '<strong>¿No fuiste tú?</strong> Ignora este correo: sin abrir el enlace no pasa nada. Nunca te pediremos tu contraseña por correo.'

const templates = {
  'confirmation.html': layout({
    title: `Confirma tu cuenta en ${BRAND}`,
    preheader: `Un toque y tu cuenta de ${BRAND} queda lista.`,
    heading: 'Bienvenido a Cerquita',
    intro: [
      'Gracias por crear tu cuenta. Solo falta confirmar que este correo es tuyo; al hacerlo entrarás directamente a la plataforma, sin volver a escribir tu contraseña.',
    ],
    rows: [
      button(callbackLink('signup'), 'Confirmar mi cuenta'),
      notice(
        `El enlace vence en <strong>24 horas</strong> y solo funciona una vez. Si vence, inicia sesión y te enviaremos uno nuevo.<br /><br />${SECURITY_NOT_YOU}`,
      ),
      fallbackLink(callbackLink('signup')),
    ],
  }),
  'recovery.html': layout({
    title: `Restablece tu contraseña de ${BRAND}`,
    preheader: 'Crea una contraseña nueva para tu cuenta.',
    heading: 'Restablece tu contraseña',
    intro: [
      'Recibimos una solicitud para cambiar la contraseña de tu cuenta. Toca el botón para elegir una nueva.',
    ],
    rows: [
      button(
        callbackLink('recovery', '/account/reset-password'),
        'Restablecer contraseña',
      ),
      notice(
        `El enlace vence en <strong>24 horas</strong> y solo se puede usar una vez. Al cambiar la contraseña se cerrarán tus sesiones en otros dispositivos.<br /><br /><strong>¿No lo solicitaste?</strong> Ignora este correo: tu contraseña actual sigue funcionando. Si recibes muchos de estos sin pedirlos, escríbenos.`,
      ),
      fallbackLink(callbackLink('recovery', '/account/reset-password')),
    ],
  }),
  'magic_link.html': layout({
    title: `Tu enlace de acceso a ${BRAND}`,
    preheader: `Entra a ${BRAND} sin contraseña.`,
    heading: 'Tu enlace para entrar',
    intro: ['Toca el botón para iniciar sesión en tu cuenta.'],
    rows: [
      button(callbackLink('magiclink'), `Entrar a ${BRAND}`),
      notice(
        `El enlace vence en <strong>24 horas</strong> y solo funciona una vez.<br /><br />${SECURITY_NOT_YOU}`,
      ),
      fallbackLink(callbackLink('magiclink')),
    ],
  }),
  'email_change.html': layout({
    title: `Confirma tu nuevo correo en ${BRAND}`,
    preheader: 'Confirma el cambio de correo de tu cuenta.',
    heading: 'Confirma tu nuevo correo',
    intro: [
      'Pediste cambiar el correo de tu cuenta de <strong>{{ .Email }}</strong> a <strong>{{ .NewEmail }}</strong>. Toca el botón para confirmarlo.',
    ],
    rows: [
      button(
        callbackLink('email_change', '/account'),
        'Confirmar cambio de correo',
      ),
      notice(
        `El enlace vence en <strong>24 horas</strong> y solo funciona una vez.<br /><br /><strong>¿No lo pediste?</strong> No abras el enlace y cambia tu contraseña: alguien podría tener acceso a tu cuenta.`,
      ),
      fallbackLink(callbackLink('email_change', '/account')),
    ],
  }),
  'invite.html': layout({
    title: `Te invitaron a ${BRAND}`,
    preheader: `Activa tu cuenta de ${BRAND}.`,
    heading: `Te invitaron a ${BRAND}`,
    intro: [
      'Se creó una cuenta para <strong>{{ .Email }}</strong>. Toca el botón para activarla y elegir tu contraseña.',
    ],
    rows: [
      button(
        callbackLink('invite', '/account/reset-password'),
        'Activar mi cuenta',
      ),
      notice(
        `El enlace vence en <strong>24 horas</strong> y solo funciona una vez.<br /><br />${SECURITY_NOT_YOU}`,
      ),
      fallbackLink(callbackLink('invite', '/account/reset-password')),
    ],
  }),
  'reauthentication.html': layout({
    title: `Tu código de verificación de ${BRAND}`,
    preheader: 'Tu código para confirmar que eres tú.',
    heading: 'Tu código de verificación',
    intro: ['Escribe este código en la aplicación para confirmar que eres tú:'],
    rows: [
      code('{{ .Token }}'),
      notice(`El código vence en unos minutos. ${SECURITY_NOT_YOU}`),
    ],
  }),
}

const outDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'supabase',
  'templates',
)
for (const [name, html] of Object.entries(templates)) {
  writeFileSync(resolve(outDir, name), html)
  console.log(`Wrote supabase/templates/${name}`)
}
