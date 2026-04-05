import nodemailer from 'nodemailer'
import { env } from '../env.js'

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
  ignoreTLS: true,
})

export const emailService = {
  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const verifyUrl = `http://localhost:${env.API_PORT}/v1/auth/verify-email?token=${token}`
    await transporter.sendMail({
      from:    env.SMTP_FROM,
      to,
      subject: 'Verify your FeatureVault account',
      html: `
        <h2>Welcome to FeatureVault</h2>
        <p>Click the link below to verify your email address. This link expires in 24 hours.</p>
        <a href="${verifyUrl}" style="background:#1D9E75;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">
          Verify email
        </a>
        <p style="color:#888;font-size:12px">Or paste this URL: ${verifyUrl}</p>
      `,
    })
  },

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const resetUrl = `http://localhost:3000/auth/reset-password?token=${token}`
    await transporter.sendMail({
      from:    env.SMTP_FROM,
      to,
      subject: 'Reset your FeatureVault password',
      html: `
        <h2>Password reset</h2>
        <p>Click below to reset your password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="background:#1D9E75;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">
          Reset password
        </a>
      `,
    })
  },

  async sendWorkspaceInviteEmail(to: string, workspaceName: string, inviterName: string, token: string): Promise<void> {
    const acceptUrl = `http://localhost:3000/invites/accept?token=${token}`
    await transporter.sendMail({
      from:    env.SMTP_FROM,
      to,
      subject: `${inviterName} invited you to ${workspaceName} on FeatureVault`,
      html: `
        <h2>You've been invited</h2>
        <p>${inviterName} invited you to join <strong>${workspaceName}</strong> on FeatureVault.</p>
        <a href="${acceptUrl}" style="background:#1D9E75;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">
          Accept invitation
        </a>
        <p style="color:#888;font-size:12px">This invite expires in 48 hours.</p>
      `,
    })
  },
}
