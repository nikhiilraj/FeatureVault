import { Resend } from 'resend'
import { env } from '../env.js'

// Lazy init — only create client if API key is present
// Falls back to console logging in development (no key needed)
let resend: Resend | null = null

function getClient(): Resend {
  if (!resend) resend = new Resend(env.RESEND_API_KEY)
  return resend
}

function getBaseUrl(): string {
  // Use the configured web URL, fall back to localhost for dev
  return (env as any).WEB_URL ?? `http://localhost:3000`
}

function getApiUrl(): string {
  return (env as any).API_URL ?? `http://localhost:${env.API_PORT}`
}

const FROM = env.EMAIL_FROM ?? 'FeatureVault <noreply@featurevault.app>'

export const emailService = {
  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const verifyUrl = `${getApiUrl()}/v1/auth/verify-email?token=${token}`

    await getClient().emails.send({
      from:    FROM,
      to,
      subject: 'Verify your FeatureVault account',
      html: emailTemplate({
        heading:    'Welcome to FeatureVault',
        body:       'Click the button below to verify your email address. This link expires in 24 hours.',
        buttonText: 'Verify email',
        buttonUrl:  verifyUrl,
        footer:     `Or paste this URL: <a href="${verifyUrl}" style="color:#1D9E75">${verifyUrl}</a>`,
      }),
    })
  },

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const resetUrl = `${getBaseUrl()}/reset-password?token=${token}`

    await getClient().emails.send({
      from:    FROM,
      to,
      subject: 'Reset your FeatureVault password',
      html: emailTemplate({
        heading:    'Reset your password',
        body:       'Click below to reset your password. This link expires in 1 hour. If you didn\'t request this, ignore this email.',
        buttonText: 'Reset password',
        buttonUrl:  resetUrl,
        footer:     'This link expires in 1 hour.',
      }),
    })
  },

  async sendWorkspaceInviteEmail(
    to: string,
    workspaceName: string,
    inviterName: string,
    token: string,
  ): Promise<void> {
    const acceptUrl = `${getBaseUrl()}/invites/accept?token=${token}`

    await getClient().emails.send({
      from:    FROM,
      to,
      subject: `${inviterName} invited you to ${workspaceName} on FeatureVault`,
      html: emailTemplate({
        heading:    'You\'ve been invited',
        body:       `<strong>${inviterName}</strong> invited you to join <strong>${workspaceName}</strong> on FeatureVault.`,
        buttonText: 'Accept invitation',
        buttonUrl:  acceptUrl,
        footer:     'This invite expires in 48 hours. If you weren\'t expecting this, ignore it.',
      }),
    })
  },
}

// ── Clean, minimal email template ────────────────────────────
function emailTemplate({
  heading,
  body,
  buttonText,
  buttonUrl,
  footer,
}: {
  heading:    string
  body:       string
  buttonText: string
  buttonUrl:  string
  footer?:    string
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">

          <!-- Header -->
          <tr>
            <td style="background:#0a0a0a;padding:24px 32px">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px">
                    <div style="width:24px;height:24px;display:inline-block">
                      <svg width="24" height="24" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="2" y="2" width="8" height="8" rx="2" fill="#1D9E75"/>
                        <rect x="12" y="2" width="8" height="8" rx="2" fill="#1D9E75" opacity="0.5"/>
                        <rect x="2" y="12" width="8" height="8" rx="2" fill="#1D9E75" opacity="0.3"/>
                        <rect x="12" y="12" width="8" height="8" rx="2" fill="#1D9E75" opacity="0.7"/>
                      </svg>
                    </div>
                  </td>
                  <td style="color:#ffffff;font-size:16px;font-weight:600;letter-spacing:-0.01em">FeatureVault</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 32px">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#0a0a0a;line-height:1.2">${heading}</h1>
              <p style="margin:0 0 28px;font-size:15px;color:#555555;line-height:1.6">${body}</p>

              <a href="${buttonUrl}"
                style="display:inline-block;background:#1D9E75;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:-0.01em">
                ${buttonText}
              </a>
            </td>
          </tr>

          <!-- Footer -->
          ${footer ? `
          <tr>
            <td style="padding:0 32px 32px">
              <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.5">${footer}</p>
            </td>
          </tr>` : ''}

          <!-- Bottom bar -->
          <tr>
            <td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eeeeee">
              <p style="margin:0;font-size:11px;color:#cccccc">
                Sent by FeatureVault · Self-hostable feature flags
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
