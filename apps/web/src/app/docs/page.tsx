'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'

const NAV = [
  { id: 'installation',   label: 'Installation' },
  { id: 'quickstart',     label: 'Quick start' },
  { id: 'configuration',  label: 'Configuration' },
  { id: 'flags',          label: 'Feature flags' },
  { id: 'targeting',      label: 'Targeting rules' },
  { id: 'experiments',    label: 'A/B experiments' },
  { id: 'realtime',       label: 'Real-time updates' },
  { id: 'typescript',     label: 'TypeScript' },
  { id: 'selfhosting',    label: 'Self-hosting' },
  { id: 'cli',            label: 'CLI reference' },
]

function Code({ children, lang = '' }: { children: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div style={{
      position: 'relative', borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.07)',
      background: '#0d0d0d', overflow: 'hidden',
      marginBottom: 20,
    }}>
      {lang && (
        <div style={{
          padding: '7px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#0a0a0a',
        }}>
          <span style={{ fontSize: 11, color: '#606060', fontFamily: 'DM Mono, monospace', letterSpacing: '0.04em' }}>{lang}</span>
          <button onClick={copy} style={{
            fontSize: 11, color: copied ? '#1D9E75' : '#606060',
            background: 'none', border: 'none', cursor: 'pointer',
            transition: 'color 150ms ease', fontFamily: 'DM Sans, sans-serif',
          }}>
            {copied ? '✓ copied' : 'copy'}
          </button>
        </div>
      )}
      <pre style={{
        margin: 0, padding: '16px 18px',
        fontFamily: 'DM Mono, monospace', fontSize: 13,
        lineHeight: 1.75, color: '#c9d1d9',
        overflowX: 'auto', whiteSpace: 'pre',
      }}>
        <code>{children}</code>
      </pre>
    </div>
  )
}

function InlineCode({ children }: { children: string }) {
  return (
    <code style={{
      fontFamily: 'DM Mono, monospace', fontSize: '0.875em',
      color: '#5DCAA5', background: 'rgba(29,158,117,0.1)',
      padding: '1px 5px', borderRadius: 4,
    }}>{children}</code>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ paddingBottom: 64, borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 64 }}>
      <h2 style={{
        fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
        margin: '0 0 20px', color: 'var(--color-text-1)', lineHeight: 1.2,
      }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Param({ name, type, required, def, children }: {
  name: string; type: string; required?: boolean; def?: string; children: React.ReactNode
}) {
  return (
    <div style={{
      padding: '14px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <code style={{ fontSize: 14, fontFamily: 'DM Mono, monospace', color: 'var(--color-text-1)', fontWeight: 500 }}>{name}</code>
        <code style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: '#5DCAA5' }}>{type}</code>
        {required && (
          <span style={{ fontSize: 10, fontWeight: 600, color: '#ff8a84', background: 'rgba(255,95,86,0.1)', padding: '1px 6px', borderRadius: 4, letterSpacing: '0.06em' }}>required</span>
        )}
        {def && (
          <span style={{ fontSize: 11, color: 'var(--color-text-4)' }}>default: <code style={{ fontFamily: 'DM Mono, monospace', color: 'var(--color-text-3)' }}>{def}</code></span>
        )}
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--color-text-3)', margin: 0, lineHeight: 1.6 }}>{children}</p>
    </div>
  )
}

function Method({ signature, children }: { signature: string; children: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)',
      overflow: 'hidden', marginBottom: 24,
    }}>
      <div style={{
        padding: '10px 16px',
        background: '#111', borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <code style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#c9d1d9' }}>{signature}</code>
      </div>
      <div style={{ padding: '14px 16px' }}>
        {children}
      </div>
    </div>
  )
}

function Badge({ children, color = '#1D9E75' }: { children: string; color?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 6,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
      background: `${color}18`, color, border: `1px solid ${color}30`,
    }}>{children}</span>
  )
}

function OperatorTable() {
  const ops = [
    ['eq',           'Equals',               'plan eq "pro"',            'Exact string match'],
    ['neq',          'Not equals',            'env neq "prod"',           'Exclude exact match'],
    ['gt',           'Greater than',          'age gt 18',                'Numeric comparison'],
    ['gte',          'Greater or equal',      'score gte 90',             'Numeric comparison'],
    ['lt',           'Less than',             'retries lt 3',             'Numeric comparison'],
    ['lte',          'Less or equal',         'tier lte 2',               'Numeric comparison'],
    ['contains',     'Contains substring',    'email contains "@acme"',   'Case-sensitive substring'],
    ['not_contains', 'Not contains',          'role not_contains "guest"','Excludes substring'],
    ['starts_with',  'Starts with',           'userId starts_with "usr_"','Prefix match'],
    ['ends_with',    'Ends with',             'email ends_with ".edu"',   'Suffix match'],
    ['in',           'In list',               'plan in ["pro","ent"]',    'Array membership'],
    ['not_in',       'Not in list',           'country not_in ["CN","RU"]','Array exclusion'],
    ['regex',        'Regex match',           'email regex ".*@acme\\.com"','Full regex support'],
  ]
  return (
    <div style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--color-surface-1)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['Operator', 'Description', 'Example', 'Notes'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, color: 'var(--color-text-3)', fontSize: 12, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ops.map(([op, desc, ex, note], i) => (
              <tr key={op} style={{ borderBottom: i < ops.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                <td style={{ padding: '10px 14px' }}>
                  <code style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#5DCAA5' }}>{op}</code>
                </td>
                <td style={{ padding: '10px 14px', color: 'var(--color-text-2)' }}>{desc}</td>
                <td style={{ padding: '10px 14px' }}>
                  <code style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--color-text-3)' }}>{ex}</code>
                </td>
                <td style={{ padding: '10px 14px', color: 'var(--color-text-4)', fontSize: 12 }}>{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function DocsPage() {
  const [active, setActive] = useState('installation')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActive(entry.target.id)
        })
      },
      { rootMargin: '-20% 0px -70% 0px' }
    )
    NAV.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif', background: 'var(--color-surface-0)', color: 'var(--color-text-1)', minHeight: '100dvh' }}>

      {/* Top nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        height: 52, borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'var(--color-nav-bg)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', padding: '0 24px',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none' }}>
            <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
              <rect x="2" y="2" width="8" height="8" rx="2" fill="#1D9E75"/>
              <rect x="12" y="2" width="8" height="8" rx="2" fill="#1D9E75" opacity="0.5"/>
              <rect x="2" y="12" width="8" height="8" rx="2" fill="#1D9E75" opacity="0.3"/>
              <rect x="12" y="12" width="8" height="8" rx="2" fill="#1D9E75" opacity="0.7"/>
            </svg>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-1)' }}>FeatureVault</span>
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 16 }}>/</span>
          <span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>SDK Docs</span>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{
            fontSize: 11, fontFamily: 'DM Mono, monospace',
            color: '#1D9E75', background: 'rgba(29,158,117,0.1)',
            padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(29,158,117,0.2)',
          }}>v0.1.0</span>
          <ThemeToggle />
          <div style={{ width: 1, height: 16, background: 'var(--color-border)' }} />
          <Link href="/dashboard/flags" style={{
            fontSize: 13, color: 'var(--color-text-3)', textDecoration: 'none',
            transition: 'color 150ms ease',
          }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-2)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-3)'}>
            Dashboard →
          </Link>
        </div>
      </nav>

      <div style={{ display: 'flex', paddingTop: 52, maxWidth: 1200, margin: '0 auto' }}>

        {/* Sidebar */}
        <aside style={{
          width: 220, flexShrink: 0,
          position: 'sticky', top: 52, height: 'calc(100dvh - 52px)',
          overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,0.05)',
          padding: '32px 0',
        }}>
          <div style={{ padding: '0 20px 12px', fontSize: 10, fontWeight: 600, color: 'var(--color-text-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            SDK Reference
          </div>
          {NAV.map(item => (
            <a key={item.id} href={`#${item.id}`} style={{
              display: 'block', padding: '7px 20px',
              fontSize: 13.5, textDecoration: 'none',
              color: active === item.id ? 'var(--color-text-1)' : 'var(--color-text-4)',
              background: active === item.id ? 'rgba(29,158,117,0.08)' : 'transparent',
              borderRight: active === item.id ? '2px solid #1D9E75' : '2px solid transparent',
              transition: 'all 150ms ease',
              fontWeight: active === item.id ? 500 : 400,
            }}
              onMouseEnter={e => { if (active !== item.id) (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-2)' }}
              onMouseLeave={e => { if (active !== item.id) (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-4)' }}>
              {item.label}
            </a>
          ))}
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, padding: '48px 56px 80px', minWidth: 0 }}>

          {/* Page header */}
          <div style={{ marginBottom: 56 }}>
            <div style={{ fontSize: 12, color: '#1D9E75', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              featurevault-node
            </div>
            <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.025em', margin: '0 0 14px', lineHeight: 1.1, color: 'var(--color-text-1)' }}>
              SDK Documentation
            </h1>
            <p style={{ fontSize: 16, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 20px', maxWidth: 580 }}>
              The Node.js SDK for FeatureVault. Evaluate feature flags locally with zero network calls per check, sync changes in real time via WebSocket, and run A/B experiments with deterministic variant assignment.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Badge>TypeScript</Badge>
              <Badge color="#a0a0a0">Node.js ≥18</Badge>
              <Badge color="#a0a0a0">ESM + CJS</Badge>
              <Badge color="#a0a0a0">MIT License</Badge>
            </div>
          </div>

          {/* ── Installation ── */}
          <Section id="installation" title="Installation">
            <p style={{ fontSize: 14, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 16px' }}>
              Install from npm. The package ships both ESM and CommonJS builds with TypeScript declarations included.
            </p>
            <Code lang="npm">{`npm install featurevault-node`}</Code>
            <Code lang="pnpm">{`pnpm add featurevault-node`}</Code>
            <Code lang="yarn">{`yarn add featurevault-node`}</Code>
          </Section>

          {/* ── Quick start ── */}
          <Section id="quickstart" title="Quick start">
            <p style={{ fontSize: 14, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 16px' }}>
              Three steps: initialize with your SDK key, call <InlineCode>connect()</InlineCode> once on startup, then evaluate flags synchronously everywhere.
            </p>
            <Code lang="typescript">{`import { FeatureVault } from 'featurevault-node'

// 1. Initialize (no network call yet)
const vault = new FeatureVault({
  apiKey: process.env.FEATUREVAULT_API_KEY!,
  apiUrl: 'https://your-featurevault-instance.com',
})

// 2. Connect — fetches all flags, opens WebSocket
// Call once at application startup
await vault.connect()

// 3. Evaluate flags — zero network calls, < 0.001ms
const user = { userId: 'usr_123', plan: 'pro', country: 'IN' }

if (vault.isEnabled('new-checkout', user)) {
  return renderNewCheckout()
}

// String flags
const color = vault.getStringFlag('button-color', user, 'blue')

// A/B experiment
const variant = vault.getVariant('checkout-experiment', user)
if (variant === 'treatment') {
  showGreenButton()
}

// Track a conversion event
vault.track('purchase_completed', {
  userId: user.userId,
  experimentKey: 'checkout-experiment',
})

// Graceful shutdown
await vault.close()`}</Code>
          </Section>

          {/* ── Configuration ── */}
          <Section id="configuration" title="Configuration">
            <p style={{ fontSize: 14, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 20px' }}>
              Pass a config object to the <InlineCode>FeatureVault</InlineCode> constructor.
            </p>
            <Code lang="typescript">{`const vault = new FeatureVault({
  apiKey:          'fv_live_...',       // required
  apiUrl:          'https://...',       // required
  wsUrl:           'wss://...',         // optional, derived from apiUrl
  connectTimeout:  10_000,             // ms, default 10000
  flushInterval:   2_000,              // ms, default 2000
  flushBatchSize:  50,                 // events, default 50
  debug:           false,              // verbose logging
})`}</Code>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 4 }}>
              <Param name="apiKey" type="string" required>
                Your SDK key from the FeatureVault dashboard. Server-side keys start with <InlineCode>fv_live_</InlineCode>, development keys with <InlineCode>fv_test_</InlineCode>. Never expose server-side keys in client bundles.
              </Param>
              <Param name="apiUrl" type="string" required>
                Base URL of your FeatureVault API. No trailing slash. For the hosted version: <InlineCode>https://vault.yourdomain.com</InlineCode>.
              </Param>
              <Param name="wsUrl" type="string" def="derived from apiUrl">
                WebSocket URL for real-time flag updates. Automatically derived by replacing <InlineCode>http</InlineCode> with <InlineCode>ws</InlineCode> in the <InlineCode>apiUrl</InlineCode>. Override if your WebSocket endpoint differs.
              </Param>
              <Param name="connectTimeout" type="number" def="10000">
                Milliseconds to wait for the initial connection (REST fetch + WebSocket handshake) before throwing. Increase for slow networks.
              </Param>
              <Param name="flushInterval" type="number" def="2000">
                Milliseconds between automatic event flushes. The batcher flushes when either this interval elapses or <InlineCode>flushBatchSize</InlineCode> events accumulate, whichever comes first.
              </Param>
              <Param name="flushBatchSize" type="number" def="50">
                Maximum events per flush. When the queue reaches this size, a flush is triggered immediately regardless of <InlineCode>flushInterval</InlineCode>.
              </Param>
              <Param name="debug" type="boolean" def="false">
                Enables verbose console logging: connection events, flag updates, event flushes. Useful during development, disable in production.
              </Param>
            </div>
          </Section>

          {/* ── Feature flags ── */}
          <Section id="flags" title="Feature flags">
            <p style={{ fontSize: 14, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 24px' }}>
              All evaluation methods are synchronous and run entirely in memory. They never make network calls after <InlineCode>connect()</InlineCode> completes.
            </p>

            <Method signature="vault.isEnabled(key: string, context?: UserContext): boolean">
              <p style={{ fontSize: 13.5, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 12px' }}>
                Evaluates a boolean flag. Returns <InlineCode>true</InlineCode> if the flag is active and the user matches the targeting rules and rollout percentage. Returns <InlineCode>false</InlineCode> for killed flags regardless of context.
              </p>
              <Code lang="typescript">{`// Basic — no context
vault.isEnabled('maintenance-mode')

// With user context for targeting
vault.isEnabled('new-checkout', {
  userId:  'usr_123',
  plan:    'enterprise',
  country: 'US',
})`}</Code>
            </Method>

            <Method signature="vault.getStringFlag(key: string, context?: UserContext, defaultValue?: string): string">
              <p style={{ fontSize: 13.5, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 12px' }}>
                Evaluates a string flag. Returns the flag&apos;s evaluated value, or <InlineCode>defaultValue</InlineCode> if the flag doesn&apos;t exist, is inactive, or the user doesn&apos;t match any targeting rules.
              </p>
              <Code lang="typescript">{`const color = vault.getStringFlag('button-color', { userId }, 'blue')
const theme = vault.getStringFlag('ui-theme', { userId, plan }, 'default')`}</Code>
            </Method>

            <Method signature="vault.getNumberFlag(key: string, context?: UserContext, defaultValue?: number): number">
              <p style={{ fontSize: 13.5, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 12px' }}>
                Evaluates a number flag. Useful for rate limits, timeouts, and numeric thresholds you want to control without redeploying.
              </p>
              <Code lang="typescript">{`const rateLimit  = vault.getNumberFlag('api-rate-limit', { userId }, 100)
const cacheTime  = vault.getNumberFlag('cache-ttl-seconds', {}, 300)`}</Code>
            </Method>

            <Method signature="vault.getJSONFlag<T>(key: string, context?: UserContext, defaultValue: T): T">
              <p style={{ fontSize: 13.5, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 12px' }}>
                Evaluates a JSON flag and returns it as the specified type. Use for complex feature configuration that would be unwieldy as multiple boolean flags.
              </p>
              <Code lang="typescript">{`interface FeatureConfig {
  enabled:    boolean
  maxItems:   number
  showBadge:  boolean
}

const config = vault.getJSONFlag<FeatureConfig>(
  'checkout-config',
  { userId, plan },
  { enabled: false, maxItems: 10, showBadge: false }
)

if (config.enabled) {
  renderCheckout({ maxItems: config.maxItems })
}`}</Code>
            </Method>

            <Method signature="vault.getAllFlags(): FlagConfig[]">
              <p style={{ fontSize: 13.5, color: 'var(--color-text-3)', lineHeight: 1.65, margin: 0 }}>
                Returns all flags currently in the local store. Useful for debugging or building a custom flag UI.
              </p>
            </Method>

            <Method signature="vault.getFlagCount(): number">
              <p style={{ fontSize: 13.5, color: 'var(--color-text-3)', lineHeight: 1.65, margin: 0 }}>
                Returns the number of flags loaded. Zero before <InlineCode>connect()</InlineCode> is called.
              </p>
            </Method>

            <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: '28px 0 12px', color: '#d0d0d0' }}>
              Flag lifecycle
            </h3>
            <p style={{ fontSize: 14, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 16px' }}>
              Flags have three statuses that affect evaluation:
            </p>
            <div style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 20 }}>
              {[
                { status: 'active',   color: '#1D9E75', desc: 'Normal evaluation — targeting rules and rollout apply' },
                { status: 'inactive', color: 'var(--color-text-3)', desc: 'Returns defaultValue for all users, targeting rules ignored' },
                { status: 'killed',   color: '#ff5f56', desc: 'Returns false for all users, all rules bypassed. Emergency kill switch.' },
              ].map((row, i) => (
                <div key={row.status} style={{
                  display: 'flex', gap: 16, padding: '12px 16px', alignItems: 'flex-start',
                  borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}>
                  <div style={{
                    flexShrink: 0, marginTop: 1,
                    padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: `${row.color}18`, color: row.color, border: `1px solid ${row.color}30`,
                  }}>{row.status}</div>
                  <p style={{ fontSize: 13.5, color: 'var(--color-text-3)', margin: 0, lineHeight: 1.6 }}>{row.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Targeting rules ── */}
          <Section id="targeting" title="Targeting rules">
            <p style={{ fontSize: 14, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 16px' }}>
              Targeting rules let you serve a flag to specific user segments. Rules are evaluated top-down — the first matching rule wins. All conditions within a rule use AND logic.
            </p>

            <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: '0 0 12px', color: '#d0d0d0' }}>
              Operators
            </h3>
            <OperatorTable />

            <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: '24px 0 12px', color: '#d0d0d0' }}>
              Percentage rollout
            </h3>
            <p style={{ fontSize: 14, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 16px' }}>
              Each rule has a <InlineCode>rolloutPercentage</InlineCode> (0–100). Even if a user matches all conditions, they only receive the flag if their deterministic bucket falls within the percentage. The bucketing uses MurmurHash3 on <InlineCode>userId + flagKey</InlineCode> — the same user always gets the same result.
            </p>
            <Code lang="typescript">{`// In the dashboard, configure:
// Rule: plan eq "pro" → serve: true → rollout: 10%
//
// Internally the SDK evaluates:
//   hash = MurmurHash3('usr_123' + 'dark-mode')
//   bucket = (hash / 0xFFFFFFFF) * 100  → e.g. 23.4
//   23.4 < 10? → false (user NOT in the 10%)
//
// The same user always gets the same bucket for a given flag.
// Gradual rollout: start at 1%, watch metrics, increase to 100%.`}</Code>

            <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: '24px 0 12px', color: '#d0d0d0' }}>
              User context
            </h3>
            <p style={{ fontSize: 14, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 16px' }}>
              Pass any string, number, or boolean attributes as user context. The attribute names must match what you configured in the dashboard rule conditions.
            </p>
            <Code lang="typescript">{`type UserContext = Record<string, string | number | boolean | string[]>

// Any attributes you want to target on
const context: UserContext = {
  userId:      'usr_123',        // recommended — used for rollout bucketing
  plan:        'enterprise',
  country:     'IN',
  accountAge:  365,
  beta:        true,
  tags:        ['early-adopter', 'power-user'],
}`}</Code>

            <p style={{ fontSize: 13, color: 'var(--color-text-4)', lineHeight: 1.6, margin: '12px 0 0', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
              <strong style={{ color: 'var(--color-text-3)' }}>Privacy note:</strong> User context is evaluated entirely within your application process. It is never sent to the FeatureVault server during flag evaluation. Only conversion events sent via <InlineCode>vault.track()</InlineCode> reach the server.
            </p>
          </Section>

          {/* ── Experiments ── */}
          <Section id="experiments" title="A/B experiments">
            <p style={{ fontSize: 14, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 16px' }}>
              Experiments assign users deterministically to variants and collect conversion events for statistical analysis. The dashboard runs Welch&apos;s t-test hourly to determine significance.
            </p>

            <Method signature="vault.getVariant(experimentKey: string, context: UserContext): string | null">
              <p style={{ fontSize: 13.5, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 12px' }}>
                Returns the variant key for this user in the given experiment. Returns <InlineCode>null</InlineCode> if the experiment doesn&apos;t exist, is not running, or the user has no <InlineCode>userId</InlineCode>. The same user always gets the same variant for a given experiment.
              </p>
              <Code lang="typescript">{`const variant = vault.getVariant('checkout-cta', { userId: user.id })

if (variant === 'control') {
  return <Button color="blue">Complete purchase</Button>
}
if (variant === 'treatment') {
  return <Button color="green">Buy now — free shipping</Button>
}
// variant === null: experiment not running, show default`}</Code>
            </Method>

            <Method signature="vault.track(eventName: string, properties: TrackEventProperties): void">
              <p style={{ fontSize: 13.5, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 12px' }}>
                Queues a conversion event for the given experiment. Events are batched and flushed automatically — this method never blocks. Requires <InlineCode>userId</InlineCode> and optionally <InlineCode>experimentKey</InlineCode> to associate with an experiment.
              </p>
              <Code lang="typescript">{`// Track a conversion tied to an experiment
vault.track('purchase_completed', {
  userId:        user.id,
  experimentKey: 'checkout-cta',
})

// Track with a numeric value
vault.track('revenue', {
  userId:        user.id,
  experimentKey: 'pricing-page',
  value:         order.total,
})

// Track a non-experiment event (still stored, not counted in experiments)
vault.track('page_viewed', {
  userId: user.id,
  page:   '/checkout',
})`}</Code>
            </Method>

            <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: '24px 0 12px', color: '#d0d0d0' }}>
              Full experiment example
            </h3>
            <Code lang="typescript">{`// 1. Create experiment in dashboard:
//    key: "checkout-button", variants: control (50%) + treatment (50%)
//    primaryMetric: "purchase_completed"

// 2. In your application
const vault = new FeatureVault({ apiKey, apiUrl })
await vault.connect()

app.get('/checkout', (req, res) => {
  const { userId } = req.session

  // Same user always gets same variant — no DB lookup needed
  const variant = vault.getVariant('checkout-button', { userId })

  res.render('checkout', {
    buttonColor: variant === 'treatment' ? 'green' : 'blue',
    buttonText:  variant === 'treatment' ? 'Buy now' : 'Complete purchase',
  })
})

app.post('/purchase', async (req, res) => {
  const { userId } = req.session
  await processOrder(req.body)

  // Track the conversion — batched, non-blocking
  vault.track('purchase_completed', {
    userId,
    experimentKey: 'checkout-button',
  })

  res.json({ success: true })
})`}</Code>
          </Section>

          {/* ── Real-time ── */}
          <Section id="realtime" title="Real-time updates">
            <p style={{ fontSize: 14, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 16px' }}>
              When you change a flag in the dashboard, every connected SDK receives the update within 100ms via WebSocket. No polling, no cache expiry. The update path:
            </p>
            <Code lang="text">{`Dashboard change
    → API writes to Postgres
    → Publishes to Redis pub/sub channel (fv:pubsub:flags:{projectId})
    → All API instances receive the message
    → Each instance fans out to its connected WebSocket clients
    → SDK updates its in-memory FlagStore
    → Next vault.isEnabled() call returns the new value

Total latency: < 100ms p95`}</Code>

            <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: '24px 0 12px', color: '#d0d0d0' }}>
              Reconnection behavior
            </h3>
            <p style={{ fontSize: 14, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 16px' }}>
              If the WebSocket connection drops, the SDK reconnects automatically with exponential backoff. On reconnect, it re-fetches the full flag configuration to catch any updates missed during the outage.
            </p>
            <div style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-1)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    {['Attempt', 'Delay', 'Total wait'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, color: 'var(--color-text-3)', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['1st', '1s', '1s'],
                    ['2nd', '2s', '3s'],
                    ['3rd', '4s', '7s'],
                    ['4th', '8s', '15s'],
                    ['5th', '16s', '31s'],
                    ['6th+', '30s', 'cap'],
                  ].map(([attempt, delay, total], i) => (
                    <tr key={i} style={{ borderBottom: i < 5 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <td style={{ padding: '10px 14px', color: 'var(--color-text-3)' }}>{attempt}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <code style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#5DCAA5' }}>{delay}</code>
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--color-text-4)', fontSize: 12 }}>{total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: '24px 0 12px', color: '#d0d0d0' }}>
              Heartbeat
            </h3>
            <p style={{ fontSize: 14, color: 'var(--color-text-3)', lineHeight: 1.65, margin: 0 }}>
              The SDK sends a <InlineCode>{`{"type":"ping"}`}</InlineCode> every 30 seconds. The server responds with <InlineCode>{`{"type":"pong"}`}</InlineCode>. If no pong arrives within 60 seconds, the connection is considered dead and reconnection begins.
            </p>
          </Section>

          {/* ── TypeScript ── */}
          <Section id="typescript" title="TypeScript">
            <p style={{ fontSize: 14, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 16px' }}>
              The SDK ships TypeScript declarations. No <InlineCode>@types</InlineCode> package needed.
            </p>
            <Code lang="typescript">{`import type {
  FeatureVaultConfig,  // Constructor options
  FlagConfig,          // Full flag object from the store
  UserContext,         // Context passed to evaluation methods
  TrackEvent,          // Event sent to the server
} from 'featurevault-node'`}</Code>

            <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: '24px 0 12px', color: '#d0d0d0' }}>
              Type-safe flag evaluation
            </h3>
            <Code lang="typescript">{`// Type the user context for your application
interface AppUser {
  userId:    string
  plan:      'free' | 'pro' | 'enterprise'
  country:   string
  createdAt: number  // unix timestamp
}

function evaluate(flag: string, user: AppUser) {
  // AppUser satisfies UserContext because all values are
  // string | number | boolean | string[]
  return vault.isEnabled(flag, user)
}

// JSON flags with generics
interface PricingConfig {
  showAnnualDiscount: boolean
  discountPercent:    number
}

const pricing = vault.getJSONFlag<PricingConfig>(
  'pricing-config',
  { userId },
  { showAnnualDiscount: false, discountPercent: 0 }
)
// pricing is typed as PricingConfig`}</Code>
          </Section>

          {/* ── Self-hosting ── */}
          <Section id="selfhosting" title="Self-hosting">
            <p style={{ fontSize: 14, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 16px' }}>
              FeatureVault is fully self-hostable. One Docker Compose command starts the entire stack.
            </p>
            <Code lang="bash">{`# Clone the repository
git clone https://github.com/nikhiilraj/FeatureVault
cd featurevault

# Generate JWT keys
mkdir -p apps/api/keys
openssl genrsa -out apps/api/keys/private.pem 2048
openssl rsa -in apps/api/keys/private.pem -pubout -out apps/api/keys/public.pem

# Start everything
docker compose up -d

# Open the dashboard
open http://localhost:3000`}</Code>

            <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: '24px 0 12px', color: '#d0d0d0' }}>
              Services started
            </h3>
            <div style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 20 }}>
              {[
                { service: 'Dashboard',  port: '3000', desc: 'Next.js 15 management UI' },
                { service: 'API',        port: '4000', desc: 'Fastify REST + WebSocket' },
                { service: 'Worker',     port: '—',    desc: 'BullMQ event processor + hourly aggregation' },
                { service: 'Postgres',   port: '5433', desc: 'PostgreSQL 16 (mapped from 5432)' },
                { service: 'Redis',      port: '6379', desc: 'Cache + pub/sub + job queue' },
                { service: 'Mailpit',    port: '8025', desc: 'Email capture (dev only)' },
              ].map((row, i) => (
                <div key={row.service} style={{
                  display: 'flex', gap: 16, padding: '11px 16px', alignItems: 'center',
                  borderBottom: i < 5 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}>
                  <code style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--color-text-1)', width: 90, flexShrink: 0 }}>{row.service}</code>
                  <code style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#5DCAA5', width: 50, flexShrink: 0 }}>{row.port}</code>
                  <span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>{row.desc}</span>
                </div>
              ))}
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: '24px 0 12px', color: '#d0d0d0' }}>
              Pointing the SDK at your instance
            </h3>
            <Code lang="typescript">{`const vault = new FeatureVault({
  apiKey: process.env.FEATUREVAULT_API_KEY!,
  apiUrl: 'http://localhost:4000',  // your self-hosted instance
})

await vault.connect()`}</Code>
          </Section>

          {/* ── CLI ── */}
          <Section id="cli" title="CLI reference">
            <p style={{ fontSize: 14, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 16px' }}>
              The <InlineCode>featurevault</InlineCode> CLI lets you manage flags from your terminal. Install globally:
            </p>
            <Code lang="bash">{`npm install -g featurevault`}</Code>

            <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: '24px 0 12px', color: '#d0d0d0' }}>Commands</h3>
            <div style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 20 }}>
              {[
                { cmd: 'fv init',                    desc: 'Interactive setup wizard — connect to an instance, select project, generate integration code' },
                { cmd: 'fv status',                  desc: 'Check API health and current configuration' },
                { cmd: 'fv flags list',              desc: 'List all flags with status and version' },
                { cmd: 'fv flags create',            desc: 'Create a new flag interactively' },
                { cmd: 'fv flags enable <key>',      desc: 'Set flag status → active' },
                { cmd: 'fv flags disable <key>',     desc: 'Set flag status → inactive' },
                { cmd: 'fv flags kill <key>',        desc: 'Set flag status → killed (emergency off, requires confirmation)' },
                { cmd: 'fv experiments list',        desc: 'List all experiments with status' },
              ].map((row, i, arr) => (
                <div key={row.cmd} style={{
                  display: 'flex', gap: 16, padding: '11px 16px', alignItems: 'flex-start',
                  borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  flexWrap: 'wrap',
                }}>
                  <code style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#5DCAA5', flexShrink: 0, minWidth: 200 }}>{row.cmd}</code>
                  <span style={{ fontSize: 13, color: 'var(--color-text-3)', lineHeight: 1.5 }}>{row.desc}</span>
                </div>
              ))}
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: '24px 0 12px', color: '#d0d0d0' }}>
              Example session
            </h3>
            <Code lang="terminal">{`$ fv init
◆  FeatureVault Setup
│
◆  API URL: https://vault.yourdomain.com
◆  Email: nikhil@example.com
◆  Password: ••••••••••••
│
✓  Authenticated
✓  Found 2 projects
◆  Select project: › My App (production)
│
✓  Configuration saved
◆  Generate integration code for: › Node.js / TypeScript

  │ import { FeatureVault } from 'featurevault-node'
  │ const vault = new FeatureVault({ ... })
  │ await vault.connect()

  Run fv flags list to see your flags.

$ fv flags list
┌────────────────────┬─────────────────────┬─────────┬──────────┬────────┐
│ Key                │ Name                │ Type    │ Status   │Version │
├────────────────────┼─────────────────────┼─────────┼──────────┼────────┤
│ new-checkout       │ New checkout flow   │ boolean │ active   │ v3     │
│ dark-mode          │ Dark mode           │ boolean │ inactive │ v1     │
│ button-color       │ Button color        │ string  │ active   │ v2     │
└────────────────────┴─────────────────────┴─────────┴──────────┴────────┘

$ fv flags kill new-checkout
◆  Kill flag "new-checkout"? This immediately turns it off for ALL users.
   Yes / No: Yes
✓  new-checkout → killed
   Flag is now returning false for all users.`}</Code>
          </Section>

        </main>
      </div>
    </div>
  )
}
