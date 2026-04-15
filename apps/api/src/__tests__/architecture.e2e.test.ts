import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../lib/db/client.js'
import { users, workspaces } from '../lib/db/schema.js'

const API_URL = 'http://localhost:4000'

// We will use a dynamically generated unique prefix for this test run
const testId = Date.now().toString()
const testUser = {
  email: `e2e-test-${testId}@example.com`,
  password: `Secure_pass_12345!${testId}`,
  firstName: 'E2E',
  lastName: 'Tester',
}

describe('FeatureVault Core Architecture E2E', () => {
  let accessToken: string = ''
  let cookie: string = ''
  let workspaceId: string = ''
  let projectId: string = ''
  let flagId: string = ''
  let sdkKey: string = ''

  /**
   * Helper function to execute fetch with automatically injected token and cookies.
   */
  async function apiFetch(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers || {})
    if (cookie) headers.set('cookie', cookie)
    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }
    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json')
    }

    const res = await fetch(`${API_URL}${path}`, { ...options, headers })
    
    if (!res.ok) {
        let errBody = ''
        try { errBody = await res.clone().text() } catch {}
        console.error(`[API Error] ${options.method || 'GET'} ${path} -> ${res.status}:`, errBody)
    }

    // Auto-capture cookies (like fastify-cookie sets them) on auth responses
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) {
      // Very basic cookie parsing just to keep the auth token for subsequent requests
      cookie = setCookie.split(';')[0]
    }
    
    return res
  }

  it('1. should register a new test user', async () => {
    const res = await apiFetch('/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify(testUser),
    })
    
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.userId).toBeTruthy()
    expect(json.data.workspaceId).toBeTruthy()
  })

  it('2. should verify the user email via raw db to allow login', async () => {
    // We bypass the actual email sending in E2E by manually verifying the user
    await db.update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.email, testUser.email))
      
    const [user] = await db.select().from(users).where(eq(users.email, testUser.email))
    expect(user.emailVerifiedAt).toBeTruthy()
  })

  it('3. should login and acquire session cookie', async () => {
    const res = await apiFetch('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testUser.email, password: testUser.password }),
    })
    
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.user.email).toBe(testUser.email)
    
    expect(json.data.accessToken).toBeTruthy()
    accessToken = json.data.accessToken
    
    expect(cookie).toContain('refreshToken=')
  })

  it('4. should retrieve the default workspace', async () => {
    const res = await apiFetch('/v1/workspaces/me')
    expect(res.status).toBe(200)
    const json = await res.json()
    
    expect(json.data.id).toBeTruthy()
    workspaceId = json.data.id
  })

  it('5. should fetch the default project automatically created', async () => {
    const res = await apiFetch('/v1/workspaces/me/projects')
    
    expect(res.status).toBe(200)
    const json = await res.json()
    
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.length).toBeGreaterThan(0)
    
    projectId = json.data[0].id
    expect(projectId).toBeTruthy()
  })

  it('6. should create a boolean feature flag', async () => {
    const res = await apiFetch(`/v1/projects/${projectId}/flags`, {
      method: 'POST',
      body: JSON.stringify({
        key: 'e2e-test-flag',
        name: 'E2E Test Flag',
        type: 'boolean',
        defaultValue: false,
        targetingEnabled: true,
      }),
    })
    
    expect(res.status).toBe(201)
    const json = await res.json()
    flagId = json.data.id
    expect(flagId).toBeTruthy()
    expect(json.data.key).toBe('e2e-test-flag')
  })

  it('7. should attach targeting rules to the flag', async () => {
    const res = await apiFetch(`/v1/projects/${projectId}/flags/${flagId}/rules`, {
      method: 'PUT',
      body: JSON.stringify({
        rules: [
          {
            name: 'Beta Users Rule',
            conditions: [
              { attribute: 'email', operator: 'ends_with', value: '@featurevault.dev' }
            ],
            serveValue: true,
            rolloutPercentage: 100,
          }
        ]
      }),
    })
    
    expect(res.status).toBe(200)
    const json = await res.json()
    const rules = json.data
    expect(rules.length).toBe(1)
    expect(rules[0].serveValue).toBe(true)
  })

  it('8. should create a Server SDK key', async () => {
    const res = await apiFetch(`/v1/projects/${projectId}/sdk-keys`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'E2E Server Key',
        environment: 'development',
        keyType: 'server',
      }),
    })
    
    expect(res.status).toBe(201)
    const json = await res.json()
    // The raw key is only returned ONCE upon creation
    sdkKey = json.data.key
    expect(sdkKey).toContain('fv_test_')
  })

  it('9. should successfully fetch evaluation configs via the SDK api', async () => {
    // SDKs use X-API-Key header auth with the sdk key, not the web cookie
    const res = await fetch(`${API_URL}/sdk/v1/flags`, {
      headers: { 'X-API-Key': sdkKey }
    })
    
    expect(res.status).toBe(200)
    const json = await res.json()
    
    expect(json.success).toBe(true)
    expect(json.projectId).toBe(projectId)
    
    // We should see the flag we created in the cached evaluation config
    const flags = json.flags
    const testFlag = flags.find((f: any) => f.key === 'e2e-test-flag')
    
    expect(testFlag).toBeTruthy()
    expect(testFlag.status).toBe('inactive') // Newly created flags default to inactive
    expect(testFlag.targetingEnabled).toBe(false)
    expect(testFlag.targetingRules.length).toBe(1)
    expect(testFlag.targetingRules[0].conditions[0].value).toBe('@featurevault.dev')
  })

  it('10. should enable the flag and verify the status is updated', async () => {
    const patchRes = await apiFetch(`/v1/projects/${projectId}/flags/${flagId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'active' }),
    })
    expect(patchRes.status).toBe(200)

    // A small delay to ensure the Redis cache invalidation triggers across the stack
    await new Promise(r => setTimeout(r, 500))

    // Re-fetch SDK flags
    const res = await fetch(`${API_URL}/sdk/v1/flags`, {
      headers: { 'X-API-Key': sdkKey }
    })
    
    expect(res.status).toBe(200)
    const json = await res.json()
    const testFlag = json.flags.find((f: any) => f.key === 'e2e-test-flag')
    
    expect(testFlag.status).toBe('active')
  })

  afterAll(async () => {
    // Cleanup generated e2e test records via DB
    if (workspaceId) {
      // Must delete workspace FIRST so it cascades down to projects, flags, rules
      await db.delete(workspaces).where(eq(workspaces.id, workspaceId)).catch(console.error)
    }
    // Delete user LAST, since projects reference createdBy: users.id which prevents user deletion if project exists
    await db.delete(users).where(eq(users.email, testUser.email)).catch(console.error)
  })
})
