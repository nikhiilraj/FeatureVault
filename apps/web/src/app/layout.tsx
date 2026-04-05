import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FeatureVault',
  description: 'Self-hostable feature flags and A/B testing',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
