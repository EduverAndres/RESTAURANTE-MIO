import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// The auth emails are what turns a sign-up or a "forgot password" into a
// working account, so their links are checked like code: right callback,
// right type, the token *hash* only, and the copy a person needs.

const dir = resolve(__dirname, '../supabase/templates')
const read = (name: string) => readFileSync(resolve(dir, name), 'utf8')
const config = readFileSync(
  resolve(__dirname, '../supabase/config.toml'),
  'utf8',
)

function links(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
}

const LINKED = [
  { file: 'confirmation.html', type: 'signup', button: 'Confirmar mi cuenta' },
  {
    file: 'recovery.html',
    type: 'recovery',
    button: 'Restablecer contraseña',
    next: '%2Faccount%2Freset-password',
  },
  { file: 'magic_link.html', type: 'magiclink', button: 'Entrar a Cerquita' },
  {
    file: 'email_change.html',
    type: 'email_change',
    button: 'Confirmar cambio de correo',
    next: '%2Faccount',
  },
  {
    file: 'invite.html',
    type: 'invite',
    button: 'Activar mi cuenta',
    next: '%2Faccount%2Freset-password',
  },
] as const

describe.each(LINKED)('$file', ({ file, type, button, ...rest }) => {
  const html = read(file)
  const next = 'next' in rest ? rest.next : null

  it('links only to /auth/callback on the site URL, with the token hash', () => {
    const all = links(html)
    // Button and the copy-paste fallback.
    expect(all).toHaveLength(2)
    for (const href of all) {
      expect(href.startsWith('{{ .SiteURL }}/auth/callback?')).toBe(true)
      expect(href).toContain('token_hash={{ .TokenHash }}')
      expect(href).toContain(`&amp;type=${type}`)
      if (next) expect(href).toContain(`&amp;next=${next}`)
    }
  })

  it('never puts the one-time code or a redirect target in a link', () => {
    expect(html).not.toContain('{{ .Token }}')
    expect(html).not.toContain('{{ .ConfirmationURL }}')
    expect(html).not.toContain('{{ .RedirectTo }}')
  })

  it('has the button, a personal greeting, the expiry and a security note', () => {
    expect(html).toContain(`>${button}</a>`)
    expect(html).toContain(
      '{{ if .Data.full_name }}Hola, {{ .Data.full_name }}',
    )
    expect(html).toMatch(/vence en <strong>24 horas<\/strong>/)
    expect(html).toMatch(/¿No (fuiste tú|lo solicitaste|lo pediste)\?/)
    expect(html).toContain('Copia y pega este enlace')
  })

  it('is a mobile-friendly email without images it depends on', () => {
    expect(html).toContain('name="viewport"')
    expect(html).toContain('@media only screen and (max-width: 600px)')
    expect(html).not.toMatch(/<img\b/)
  })
})

describe('reauthentication.html', () => {
  it('shows the code and links nowhere', () => {
    const html = read('reauthentication.html')
    expect(html).toContain('{{ .Token }}')
    expect(links(html)).toHaveLength(0)
  })
})

describe('config.toml subjects', () => {
  it('names the brand in every auth email subject', () => {
    const subjects = [...config.matchAll(/^subject = "([^"]+)"/gm)].map(
      (m) => m[1],
    )
    expect(subjects.length).toBeGreaterThanOrEqual(6)
    for (const subject of subjects) expect(subject).toContain('Cerquita')
  })

  it('keeps the email links valid for 24 hours, as the copy says', () => {
    expect(config).toMatch(/^otp_expiry = 86400$/m)
  })
})
