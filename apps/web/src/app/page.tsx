'use client'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function LandingPage() {
  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      background: 'var(--color-surface-0)',
      color: 'var(--color-text-1)',
      minHeight: '100dvh',
      overflowX: 'hidden',
    }}>

      {/* ── Nav ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'var(--color-nav-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="2" y="2" width="8" height="8" rx="2" fill="#1D9E75"/>
              <rect x="12" y="2" width="8" height="8" rx="2" fill="#1D9E75" opacity="0.5"/>
              <rect x="2" y="12" width="8" height="8" rx="2" fill="#1D9E75" opacity="0.3"/>
              <rect x="12" y="12" width="8" height="8" rx="2" fill="#1D9E75" opacity="0.7"/>
            </svg>
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-text-1)' }}>FeatureVault</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              {[['Docs', '/docs'], ['SDK', '#sdk'], ['Self-host', '#self-host']].map(([label, href]) => (
                <a key={label} href={href} style={{ fontSize: 14, color: 'var(--color-text-2)', textDecoration: 'none', transition: 'color 200ms ease' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-1)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-2)')}>
                  {label}
                </a>
              ))}
              <div style={{ width: 1, height: 16, background: 'var(--color-border)' }} />
              <ThemeToggle />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Link href="/login" style={{
                fontSize: 13, fontWeight: 500, color: 'var(--color-text-2)', textDecoration: 'none',
                padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                transition: 'all 200ms ease',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-1)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.2)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-2)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--color-border-md)' }}>
                Sign in
              </Link>
              <Link href="/signup" style={{
                fontSize: 13, fontWeight: 600, color: 'var(--color-text-1)', textDecoration: 'none',
                padding: '7px 16px', borderRadius: 8,
                background: '#1D9E75',
                transition: 'all 200ms ease',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#0F6E56' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#1D9E75' }}>
                Get started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ paddingTop: 160, paddingBottom: 120, paddingLeft: 24, paddingRight: 24, position: 'relative', overflow: 'hidden' }}>
        {/* Radial glow behind hero */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 800, height: 600,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(29,158,117,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        {/* Horizontal line accent */}
        <div style={{
          position: 'absolute', top: 200, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(29,158,117,0.2), transparent)',
          pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
          {/* Eyebrow */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 12px', borderRadius: 100,
            border: '1px solid rgba(29,158,117,0.3)',
            background: 'rgba(29,158,117,0.08)',
            marginBottom: 32,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D9E75', boxShadow: '0 0 6px #1D9E75' }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: '#5DCAA5', letterSpacing: '0.02em' }}>
              Open source · Self-hostable
            </span>
          </div>

          {/* Main headline — left-aligned, asymmetric */}
          <div style={{ maxWidth: 720 }}>
            <h1 style={{
              fontSize: 'clamp(42px, 6vw, 80px)',
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              margin: '0 0 24px',
              color: 'var(--color-text-1)',
            }}>
              Feature flags that move at the{' '}
              <span style={{ color: '#1D9E75' }}>speed of thought</span>
            </h1>
            <p style={{
              fontSize: 'clamp(16px, 2vw, 20px)',
              color: 'var(--color-text-2)',
              lineHeight: 1.6,
              margin: '0 0 40px',
              maxWidth: 560,
              fontWeight: 400,
            }}>
              Sub-millisecond flag evaluation with zero network calls. Ship faster, roll back in seconds, run statistically rigorous A/B tests — all on your own infrastructure.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <Link href="/signup" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '12px 24px', borderRadius: 10,
                background: '#1D9E75', color: 'var(--color-text-1)',
                fontSize: 15, fontWeight: 600, textDecoration: 'none',
                transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)',
                boxShadow: '0 0 0 0 rgba(29,158,117,0)',
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLAnchorElement).style.background = '#0F6E56'
                  ;(e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLAnchorElement).style.background = '#1D9E75'
                  ;(e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)'
                }}>
                Start for free
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
              <a href="https://github.com/nikhiilraj/FeatureVault" target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '12px 20px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--color-text-2)', fontSize: 15, fontWeight: 500, textDecoration: 'none',
                transition: 'all 200ms ease',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-1)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.2)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-2)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--color-border-md)' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                View on GitHub
              </a>
            </div>
          </div>

          {/* Benchmark pills — offset right */}
          <div style={{
            position: 'absolute', right: 0, top: 20,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {[
              { label: 'evaluation latency', value: '0.0003ms' },
              { label: 'flag propagation', value: '< 100ms' },
              { label: 'network calls per check', value: '0' },
            ].map(item => (
              <div key={item.label} style={{
                padding: '10px 16px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.07)',
                background: 'var(--color-border)',
                backdropFilter: 'blur(8px)',
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text-1)', fontFamily: "'DM Mono', monospace" }}>{item.value}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Code snippet hero */}
        <div style={{ maxWidth: 1200, margin: '80px auto 0', position: 'relative' }}>
          <div style={{
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.08)',
            background: '#111',
            overflow: 'hidden',
            boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
          }}>
            {/* Window chrome */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#0f0f0f',
            }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {['#ff5f56','#ffbd2e','#27c93f'].map(c => (
                  <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.8 }} />
                ))}
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <span style={{ fontSize: 12, color: '#606060', fontFamily: 'DM Mono, monospace' }}>app.ts</span>
              </div>
            </div>
            {/* Code */}
            <pre style={{
              margin: 0, padding: '24px 28px',
              fontFamily: "'DM Mono', 'Courier New', monospace",
              fontSize: 13, lineHeight: 1.8,
              overflowX: 'auto',
              color: '#c9d1d9',
            }}><code>{`import { FeatureVault } from `}<span style={{color:'#a5d6ff'}}>{`'featurevault-node'`}</span>{`

const vault = new FeatureVault({
  apiKey: `}<span style={{color:'#a5d6ff'}}>{`'fv_live_...'`}</span>{`,
  apiUrl: `}<span style={{color:'#a5d6ff'}}>{`'https://vault.yourdomain.com'`}</span>{`,
})

await vault.connect()  `}<span style={{color:'#8b949e'}}>{`// fetches flags, opens WebSocket`}</span>{`

`}<span style={{color:'#8b949e'}}>{`// Sub-millisecond — evaluated locally, zero network`}</span>{`
if (vault.isEnabled(`}<span style={{color:'#a5d6ff'}}>{`'new-checkout'`}</span>{`, { userId, plan })) {
  return `}<span style={{color:'#7ee787'}}>{`renderNewCheckout`}</span>{`()
}

`}<span style={{color:'#8b949e'}}>{`// A/B variant — deterministic, same user always same variant`}</span>{`
const variant = vault.getVariant(`}<span style={{color:'#a5d6ff'}}>{`'checkout-cta'`}</span>{`, { userId })
vault.track(`}<span style={{color:'#a5d6ff'}}>{`'purchase'`}</span>{`, { userId, experimentKey: `}<span style={{color:'#a5d6ff'}}>{`'checkout-cta'`}</span>{` })`}</code></pre>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" style={{ padding: '100px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 64 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#1D9E75', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Architecture</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 700, letterSpacing: '-0.025em', margin: '0 0 16px', lineHeight: 1.1 }}>
              Zero network calls. Every evaluation.
            </h2>
            <p style={{ fontSize: 17, color: 'var(--color-text-2)', maxWidth: 540, lineHeight: 1.6, margin: 0 }}>
              The SDK boots once, fetches all your flags, and syncs changes in real time via WebSocket. Every <code style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, color: '#5DCAA5', background: 'rgba(29,158,117,0.1)', padding: '1px 5px', borderRadius: 4 }}>isEnabled()</code> call is a local Map lookup.
            </p>
          </div>

          {/* Steps — asymmetric layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
            {[
              {
                step: '01',
                title: 'SDK connects once',
                body: 'On boot, the SDK calls GET /sdk/v1/flags and loads the complete flag configuration into memory. One HTTP request. That\'s it.',
                accent: false,
              },
              {
                step: '02',
                title: 'Evaluate locally',
                body: 'vault.isEnabled() reads from an in-memory Map. No Redis, no Postgres, no network. Targeting rules and percentage rollouts are evaluated in 0.0003ms.',
                accent: false,
              },
              {
                step: '03',
                title: 'Real-time propagation',
                body: 'When you change a flag, the API publishes to Redis pub/sub. Every API instance fans it out to connected WebSocket clients. Your SDK gets the update in < 100ms.',
                accent: true,
              },
              {
                step: '04',
                title: 'Kill switch that works',
                body: 'Status "killed" returns false for every user, no exceptions, no targeting rules. One click in the dashboard. Live in under two seconds.',
                accent: false,
              },
            ].map(item => (
              <div key={item.step} style={{
                padding: '36px 40px',
                background: item.accent ? 'rgba(29,158,117,0.06)' : 'var(--color-surface-1)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                transition: 'background 200ms ease',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: item.accent ? '#1D9E75' : 'var(--color-text-4)', letterSpacing: '0.12em', marginBottom: 16, fontFamily: 'DM Mono, monospace' }}>
                  {item.step}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em', margin: '0 0 10px', color: 'var(--color-text-1)', lineHeight: 1.2 }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: 14, color: 'var(--color-text-3)', lineHeight: 1.65, margin: 0 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: '100px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 64 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#1D9E75', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Features</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 700, letterSpacing: '-0.025em', margin: 0, lineHeight: 1.1 }}>
              Everything a production flag system needs
            </h2>
          </div>

          {/* Feature grid — 3 cols, intentionally unequal */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 16 }}>
            {[
              {
                icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2L13 8H17L13.5 12L15 18L10 15L5 18L6.5 12L3 8H7L10 2Z" stroke="#1D9E75" strokeWidth="1.5" strokeLinejoin="round"/></svg>,
                title: 'Targeting rules',
                body: 'Segment by any user attribute. Combine conditions with AND logic. Percentage rollout with MurmurHash3 for deterministic bucketing.',
                wide: true,
              },
              {
                icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="#1D9E75" strokeWidth="1.5"/><path d="M10 6v4l3 2" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/></svg>,
                title: 'A/B testing with statistics',
                body: "Welch's t-test. Hourly significance calculation. Sample size estimator built in.",
                wide: false,
              },
              {
                icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="3" stroke="#1D9E75" strokeWidth="1.5"/><path d="M7 10h6M10 7v6" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/></svg>,
                title: 'Immutable audit log',
                body: 'Every change recorded with before/after snapshots. Before/after JSON diff on click.',
                wide: false,
              },
              {
                icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M10 4l6 6-6 6" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                title: 'RBAC',
                body: 'Owner · Admin · Editor · Viewer. Killing a flag requires admin. Viewers are read-only.',
                wide: false,
              },
              {
                icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3v14M3 10h14" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/></svg>,
                title: 'Multi-project workspaces',
                body: 'Separate projects per product or environment. SDK keys scoped to project and environment.',
                wide: false,
              },
              {
                icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M17 10A7 7 0 1 1 3 10a7 7 0 0 1 14 0z" stroke="#1D9E75" strokeWidth="1.5"/><path d="M13 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" stroke="#1D9E75" strokeWidth="1.5"/></svg>,
                title: 'Self-hostable',
                body: '`docker compose up` and you\'re live. No external dependencies. Your data never leaves your infrastructure.',
                wide: false,
              },
            ].map((feature) => (
              <div key={feature.title} style={{
                padding: '28px 28px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.07)',
                background: 'var(--color-surface-1)',
                gridColumn: feature.wide ? 'span 1' : 'span 1',
                transition: 'border-color 200ms ease, background 200ms ease',
                cursor: 'default',
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(29,158,117,0.3)'
                  ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(29,158,117,0.04)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)'
                  ;(e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface-1)'
                }}>
                <div style={{ marginBottom: 14 }}>{feature.icon}</div>
                <h3 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', margin: '0 0 8px', color: 'var(--color-text-1)' }}>{feature.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--color-text-3)', lineHeight: 1.65, margin: 0 }}>{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SDK section ── */}
      <section id="sdk" style={{ padding: '100px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#1D9E75', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>SDK</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, letterSpacing: '-0.025em', margin: '0 0 20px', lineHeight: 1.1 }}>
              Three lines to integrate
            </h2>
            <p style={{ fontSize: 16, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 32px' }}>
              Install the npm package, connect, evaluate. The SDK handles reconnection, event batching, and cache invalidation automatically.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                'Deterministic variant assignment via MurmurHash3',
                'Exponential backoff reconnection (1s → 30s cap)',
                'Event batching — 50 events per HTTP request',
                'Offline resilience — serves cached values on disconnect',
                'TypeScript-first with full inference',
              ].map(item => (
                <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginTop: 2, flexShrink: 0 }}>
                    <circle cx="8" cy="8" r="7" stroke="#1D9E75" strokeWidth="1.2"/>
                    <path d="M5 8l2 2 4-4" stroke="#1D9E75" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ fontSize: 14, color: 'var(--color-text-2)', lineHeight: 1.5 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{
              borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)',
              background: '#0f0f0f', overflow: 'hidden',
            }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0a0a0a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1D9E75', boxShadow: '0 0 6px #1D9E75' }} />
                <span style={{ fontSize: 11, color: '#606060', fontFamily: 'DM Mono, monospace' }}>terminal</span>
              </div>
              <pre style={{ margin: 0, padding: '20px 20px', fontFamily: 'DM Mono, monospace', fontSize: 12.5, lineHeight: 1.9, color: '#c9d1d9' }}>
                <code>
                  <span style={{ color: '#8b949e' }}># Install</span>{'\n'}
                  <span style={{ color: '#1D9E75' }}>$</span>{' npm install featurevault-node\n\n'}
                  <span style={{ color: '#8b949e' }}># Or use the CLI</span>{'\n'}
                  <span style={{ color: '#1D9E75' }}>$</span>{' npm install -g featurevault\n'}
                  <span style={{ color: '#1D9E75' }}>$</span>{' fv init\n\n'}
                  <span style={{ color: '#8b949e' }}># Guided setup in your terminal</span>{'\n'}
                  <span style={{ color: '#5DCAA5' }}>{'  ◆'}</span>{' Connected to FeatureVault\n'}
                  <span style={{ color: '#5DCAA5' }}>{'  ◆'}</span>{' Found 8 flags · 2 experiments\n'}
                  <span style={{ color: '#5DCAA5' }}>{'  ◆'}</span>{' Code generated · clipboard'}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ── Self-host section ── */}
      <section id="self-host" style={{ padding: '100px 24px', borderTop: '1px solid var(--color-border)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
            <div>
              <div style={{
                borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)',
                background: '#0f0f0f', overflow: 'hidden',
              }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0a0a0a' }}>
                  <span style={{ fontSize: 11, color: '#606060', fontFamily: 'DM Mono, monospace' }}>docker-compose.yml</span>
                </div>
                <pre style={{ margin: 0, padding: '20px 20px', fontFamily: 'DM Mono, monospace', fontSize: 12, lineHeight: 1.9, color: '#c9d1d9', overflowX: 'auto' }}>
                  <code>
                    <span style={{ color: '#ff7b72' }}>services</span>{':\n'}
                    {'  '}<span style={{ color: '#7ee787' }}>postgres</span>{':\n'}
                    {'    image: '}<span style={{ color: '#a5d6ff' }}>postgres:16-alpine</span>{'\n'}
                    {'  '}<span style={{ color: '#7ee787' }}>redis</span>{':\n'}
                    {'    image: '}<span style={{ color: '#a5d6ff' }}>redis:7-alpine</span>{'\n'}
                    {'  '}<span style={{ color: '#7ee787' }}>api</span>{':\n'}
                    {'    image: '}<span style={{ color: '#a5d6ff' }}>ghcr.io/featurevault/api</span>{'\n'}
                    {'  '}<span style={{ color: '#7ee787' }}>web</span>{':\n'}
                    {'    image: '}<span style={{ color: '#a5d6ff' }}>ghcr.io/featurevault/web</span>{'\n\n'}
                    <span style={{ color: '#8b949e' }}># docker compose up -d</span>{'\n'}
                    <span style={{ color: '#8b949e' }}># Done. Open localhost:3000</span>
                  </code>
                </pre>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#1D9E75', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Self-host</div>
              <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, letterSpacing: '-0.025em', margin: '0 0 20px', lineHeight: 1.1 }}>
                Your infrastructure, your rules
              </h2>
              <p style={{ fontSize: 16, color: 'var(--color-text-3)', lineHeight: 1.65, margin: '0 0 28px' }}>
                One <code style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#5DCAA5', background: 'rgba(29,158,117,0.1)', padding: '1px 5px', borderRadius: 4 }}>docker compose up -d</code> and you have a fully operational FeatureVault instance. Postgres, Redis, API, dashboard, worker — all included.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <Link href="/signup" style={{
                  padding: '10px 20px', borderRadius: 8, background: '#1D9E75',
                  color: 'var(--color-text-1)', fontSize: 14, fontWeight: 600, textDecoration: 'none',
                  transition: 'background 200ms ease',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#0F6E56' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#1D9E75' }}>
                  Use hosted version
                </Link>
                <a href="https://github.com/nikhiilraj/FeatureVault" target="_blank" rel="noopener noreferrer" style={{
                  padding: '10px 20px', borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--color-text-2)', fontSize: 14, fontWeight: 500, textDecoration: 'none',
                  transition: 'all 200ms ease',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-1)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-2)' }}>
                  Self-host guide
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '100px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            display: 'inline-block', padding: '64px 80px', borderRadius: 20,
            border: '1px solid rgba(29,158,117,0.2)',
            background: 'radial-gradient(ellipse at 50% 0%, rgba(29,158,117,0.08) 0%, transparent 70%)',
            position: 'relative', overflow: 'hidden',
          }}>
            <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 700, letterSpacing: '-0.025em', margin: '0 0 16px', lineHeight: 1.1 }}>
              Start shipping with confidence
            </h2>
            <p style={{ fontSize: 17, color: 'var(--color-text-3)', margin: '0 0 36px', lineHeight: 1.6 }}>
              Free to use. Free to self-host. No seat-based pricing.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/signup" style={{
                padding: '13px 28px', borderRadius: 10, background: '#1D9E75',
                color: 'var(--color-text-1)', fontSize: 15, fontWeight: 600, textDecoration: 'none',
                transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#0F6E56'; (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#1D9E75'; (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)' }}>
                Create free account
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
              <a href="https://github.com/nikhiilraj/FeatureVault" target="_blank" rel="noopener noreferrer" style={{
                padding: '13px 24px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--color-text-2)', fontSize: 15, fontWeight: 500, textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                transition: 'all 200ms ease',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-1)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-2)' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                Star on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ padding: '32px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
              <rect x="2" y="2" width="8" height="8" rx="2" fill="#1D9E75"/>
              <rect x="12" y="2" width="8" height="8" rx="2" fill="#1D9E75" opacity="0.5"/>
              <rect x="2" y="12" width="8" height="8" rx="2" fill="#1D9E75" opacity="0.3"/>
              <rect x="12" y="12" width="8" height="8" rx="2" fill="#1D9E75" opacity="0.7"/>
            </svg>
            <span style={{ fontSize: 13, color: 'var(--color-text-4)', fontWeight: 500 }}>FeatureVault</span>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[['GitHub', 'https://github.com/nikhiilraj/FeatureVault'], ['Privacy', '/privacy'], ['Terms', '/terms']].map(([label, href]) => (
              <a key={label} href={href} style={{ fontSize: 13, color: 'var(--color-text-4)', textDecoration: 'none', transition: 'color 150ms ease' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-3)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-4)')}>
                {label}
              </a>
            ))}
          </div>
          <span style={{ fontSize: 12, color: 'var(--color-text-4)' }}>MIT License</span>
        </div>
      </footer>
    </div>
  )
}
