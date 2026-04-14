import * as p from '@clack/prompts'
import chalk from 'chalk'
import ora from 'ora'
import { config } from '../config.js'
import { login, getProjects } from '../api.js'

export async function initCommand() {
  console.log('')
  p.intro(chalk.hex('#1D9E75').bold(' FeatureVault Setup '))

  const apiUrl = await p.text({
    message: 'API URL',
    placeholder: 'http://localhost:4000',
    initialValue: config.get('apiUrl') || 'http://localhost:4000',
    validate: (v) => { if (!v.startsWith('http')) return 'Must start with http:// or https://' },
  })
  if (p.isCancel(apiUrl)) { p.cancel('Setup cancelled'); process.exit(0) }

  const email = await p.text({
    message: 'Email address',
    placeholder: 'you@example.com',
    initialValue: config.get('email') || '',
    validate: (v) => { if (!v.includes('@')) return 'Enter a valid email' },
  })
  if (p.isCancel(email)) { p.cancel('Setup cancelled'); process.exit(0) }

  const password = await p.password({
    message: 'Password',
    validate: (v) => { if (v.length < 4) return 'Password required' },
  })
  if (p.isCancel(password)) { p.cancel('Setup cancelled'); process.exit(0) }

  const spinner = ora({ text: 'Authenticating...', color: 'green' }).start()

  try {
    const auth = await login(apiUrl as string, email as string, password as string)
    spinner.succeed('Authenticated')

    // Store token temporarily
    config.set('_accessToken' as any, auth.accessToken)
    config.set('email', email as string)
    config.set('apiUrl', apiUrl as string)

    const projSpinner = ora({ text: 'Loading projects...', color: 'green' }).start()
    const projects = await getProjects(apiUrl as string, auth.accessToken)
    projSpinner.succeed(`Found ${projects.length} project${projects.length !== 1 ? 's' : ''}`)

    let projectId: string
    if (projects.length === 1) {
      projectId = projects[0].id
      console.log(`  ${chalk.hex('#1D9E75')('◆')} Using project: ${chalk.white(projects[0].name)}`)
    } else {
      const choice = await p.select({
        message: 'Select project',
        options: projects.map((p: any) => ({ value: p.id, label: p.name, hint: p.slug })),
      })
      if (p.isCancel(choice)) { p.cancel('Setup cancelled'); process.exit(0) }
      projectId = choice as string
    }

    config.set('projectId', projectId)

    // Get SDK key count for feedback
    console.log('')
    p.outro(chalk.hex('#1D9E75')('Configuration saved'))
    console.log('')
    console.log(`  ${chalk.hex('#1D9E75')('◆')} ${chalk.white('API URL:')}    ${chalk.gray(apiUrl)}`)
    console.log(`  ${chalk.hex('#1D9E75')('◆')} ${chalk.white('Project ID:')} ${chalk.gray(projectId)}`)
    console.log(`  ${chalk.hex('#1D9E75')('◆')} ${chalk.white('Config at:')} ${chalk.gray(config.path)}`)
    console.log('')

    // Framework selection + code generation
    const framework = await p.select({
      message: 'Generate integration code for',
      options: [
        { value: 'node',    label: 'Node.js / TypeScript' },
        { value: 'express', label: 'Express.js' },
        { value: 'fastify', label: 'Fastify' },
        { value: 'next',    label: 'Next.js' },
        { value: 'skip',    label: 'Skip — I\'ll do this manually' },
      ],
    })
    if (!p.isCancel(framework) && framework !== 'skip') {
      console.log('')
      printIntegrationCode(framework as string, apiUrl as string)
    }

    console.log(`\n  Run ${chalk.hex('#1D9E75')('fv flags list')} to see your flags.\n`)

  } catch (err: any) {
    spinner.fail('Authentication failed')
    const msg = err.response?.data?.error?.message ?? err.message
    console.error(`  ${chalk.red('Error:')} ${msg}`)
    process.exit(1)
  }
}

function printIntegrationCode(framework: string, apiUrl: string) {
  const projectId = config.get('projectId')

  const snippets: Record<string, string> = {
    node: `import { FeatureVault } from 'featurevault-node'

const vault = new FeatureVault({
  apiKey: process.env.FEATUREVAULT_API_KEY!,
  apiUrl: '${apiUrl}',
})

await vault.connect()

// In your request handler
if (vault.isEnabled('your-flag', { userId: user.id })) {
  // new behavior
}`,
    express: `import { FeatureVault } from 'featurevault-node'

const vault = new FeatureVault({
  apiKey: process.env.FEATUREVAULT_API_KEY!,
  apiUrl: '${apiUrl}',
})

app.listen(3000, async () => {
  await vault.connect()
  console.log('Vault connected')
})`,
    next: `// lib/vault.ts
import { FeatureVault } from 'featurevault-node'

const vault = new FeatureVault({
  apiKey: process.env.FEATUREVAULT_API_KEY!,
  apiUrl: '${apiUrl}',
})

let connected = false
export async function getVault() {
  if (!connected) { await vault.connect(); connected = true }
  return vault
}`,
    fastify: `import { FeatureVault } from 'featurevault-node'

const vault = new FeatureVault({
  apiKey: process.env.FEATUREVAULT_API_KEY!,
  apiUrl: '${apiUrl}',
})

app.addHook('onReady', async () => { await vault.connect() })`,
  }

  const snippet = snippets[framework] ?? snippets['node']
  console.log('')
  console.log(chalk.hex('#1D9E75')('  Integration code:'))
  console.log('')
  const lines = snippet.split('\n')
  for (const line of lines) {
    console.log(`  ${chalk.gray('│')} ${chalk.white(line)}`)
  }
  console.log('')
}
