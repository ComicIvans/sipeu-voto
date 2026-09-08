import nodemailer from 'nodemailer'
import { getOptionalConfigString } from '~~/shared/utils/config'
import { SITE_NAME } from '~~/shared/constants/links'
import { logError, logInfo } from './logger'

function getTransport() {
  const host = getOptionalConfigString(process.env.SMTP_HOST)
  if (!host) return null

  const port = Number(process.env.SMTP_PORT ?? 587)
  const secure = String(process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true'
  const user = getOptionalConfigString(process.env.SMTP_USER)
  const pass = getOptionalConfigString(process.env.SMTP_PASSWORD)

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  })
}

export function isMailConfigured() {
  return Boolean(getOptionalConfigString(process.env.SMTP_HOST))
}

function getMailFrom() {
  return getOptionalConfigString(process.env.MAIL_FROM) ?? `${SITE_NAME} <no-reply@localhost>`
}

function getSiteUrl() {
  return getOptionalConfigString(process.env.NUXT_SITE_URL) ?? 'http://localhost:3000'
}

export interface CredentialsEmailInput {
  to: string
  firstName: string
  password: string
  isNewAccount: boolean
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function sendCredentialsEmail(input: CredentialsEmailInput) {
  const siteUrl = getSiteUrl()
  const loginUrl = `${siteUrl.replace(/\/$/, '')}/login`
  const subject = input.isNewAccount
    ? `Tu acceso a ${SITE_NAME}`
    : `Nueva contraseña para ${SITE_NAME}`

  const intro = input.isNewAccount
    ? 'Se ha creado tu cuenta para votar en la Simulación del Parlamento Europeo en Canarias.'
    : 'La organización ha generado una nueva contraseña para tu cuenta.'

  const text = [
    `Hola, ${input.firstName}.`,
    '',
    intro,
    '',
    `Web: ${loginUrl}`,
    `Correo: ${input.to}`,
    `Contraseña: ${input.password}`,
    '',
    'Puedes cambiar la contraseña desde tu perfil una vez dentro.',
    'Si no recuerdas la contraseña más adelante, contacta con la organización.',
    '',
    `${SITE_NAME} · @sipeucan`,
  ].join('\n')

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #0f172a;">
      <div style="background:#0048a0; color:#fff; padding: 20px 24px; border-radius: 12px 12px 0 0;">
        <p style="margin:0; font-size: 18px; font-weight: 700;">${SITE_NAME}</p>
        <p style="margin:4px 0 0; font-size: 13px; opacity: .85;">Simulación del Parlamento Europeo en Canarias</p>
      </div>
      <div style="border:1px solid #e2e8f0; border-top:0; padding: 24px; border-radius: 0 0 12px 12px;">
        <p>Hola, ${escapeHtml(input.firstName)}.</p>
        <p>${intro}</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding:6px 12px 6px 0; color:#475569;">Web</td><td><a href="${loginUrl}">${loginUrl}</a></td></tr>
          <tr><td style="padding:6px 12px 6px 0; color:#475569;">Correo</td><td>${escapeHtml(input.to)}</td></tr>
          <tr><td style="padding:6px 12px 6px 0; color:#475569;">Contraseña</td><td><code style="font-size:15px; background:#f1f5f9; padding:4px 8px; border-radius:6px;">${escapeHtml(input.password)}</code></td></tr>
        </table>
        <p style="color:#475569; font-size: 13px;">Puedes cambiar la contraseña desde tu perfil una vez dentro. Si no la recuerdas más adelante, contacta con la organización.</p>
        <p style="color:#94a3b8; font-size: 12px; margin-top: 24px;">${SITE_NAME} · @sipeucan</p>
      </div>
    </div>
  `

  const transport = getTransport()

  if (!transport) {
    logInfo('mail.skipped', { to: input.to, subject, reason: 'SMTP_HOST not configured' })
    if (process.env.NODE_ENV !== 'production') {
      console.info(`\n[mail preview] To: ${input.to}\nSubject: ${subject}\n${text}\n`)
    }
    return { sent: false as const }
  }

  try {
    await transport.sendMail({ from: getMailFrom(), to: input.to, subject, text, html })
    return { sent: true as const }
  } catch (error) {
    logError('mail.send', error, { to: input.to, subject })
    throw error
  }
}
