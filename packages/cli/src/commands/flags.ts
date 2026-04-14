import * as p from '@clack/prompts'
import chalk from 'chalk'
import ora from 'ora'
import { config, isConfigured } from '../config.js'
import { getFlags, updateFlagStatus, createFlag } from '../api.js'
import { flagStatusColor, printTable } from '../display.js'

function requireConfig() {
  if (!isConfigured()) {
    console.error(`\n  ${chalk.red('Not configured.')} Run ${chalk.hex('#1D9E75')('fv init')} first.\n`)
    process.exit(1)
  }
}

export async function flagsListCommand() {
  requireConfig()
  const spinner = ora({ text: 'Loading flags...', color: 'green' }).start()

  try {
    const apiUrl    = config.get('apiUrl')
    const projectId = config.get('projectId')
    const token     = config.get('_accessToken' as any) as string

    const { data: flags, pagination } = await getFlags(apiUrl, token, projectId)
    spinner.stop()

    if (!flags.length) {
      console.log(`\n  ${chalk.gray('No flags found.')} Create one with ${chalk.hex('#1D9E75')('fv flags create')}\n`)
      return
    }

    console.log('')
    printTable(
      ['Key', 'Name', 'Type', 'Status', 'Version'],
      flags.map((f: any) => [
        chalk.hex('#5DCAA5')(f.key),
        f.name,
        chalk.gray(f.type),
        flagStatusColor(f.status),
        chalk.gray(`v${f.version}`),
      ])
    )
    console.log(`\n  ${chalk.gray(`${pagination.total} flag${pagination.total !== 1 ? 's' : ''} total`)}\n`)
  } catch (err: any) {
    spinner.fail('Failed to load flags')
    console.error(`  ${chalk.red(err.response?.data?.error?.message ?? err.message)}\n`)
    process.exit(1)
  }
}

export async function flagsEnableCommand(key: string) {
  requireConfig()
  await setFlagStatus(key, 'active')
}

export async function flagsDisableCommand(key: string) {
  requireConfig()
  await setFlagStatus(key, 'inactive')
}

export async function flagsKillCommand(key: string) {
  requireConfig()
  const confirm = await p.confirm({
    message: `${chalk.red('Kill')} flag "${chalk.white(key)}"? This immediately turns it off for ALL users.`,
    initialValue: false,
  })
  if (!confirm || p.isCancel(confirm)) {
    console.log(`\n  ${chalk.gray('Cancelled.')}\n`)
    return
  }
  await setFlagStatus(key, 'killed')
}

async function setFlagStatus(key: string, status: string) {
  const spinner = ora({ text: `Setting ${key} → ${status}...`, color: 'green' }).start()

  try {
    const apiUrl    = config.get('apiUrl')
    const projectId = config.get('projectId')
    const token     = config.get('_accessToken' as any) as string

    // Find flag by key
    const { data: flags } = await getFlags(apiUrl, token, projectId)
    const flag = flags.find((f: any) => f.key === key)

    if (!flag) {
      spinner.fail(`Flag "${key}" not found`)
      process.exit(1)
    }

    await updateFlagStatus(apiUrl, token, projectId, flag.id, status)
    spinner.succeed(`${chalk.hex('#5DCAA5')(key)} → ${flagStatusColor(status)}`)

    if (status === 'killed') {
      console.log(`  ${chalk.gray('Flag is now returning false for all users.')}`)
    }
    console.log('')
  } catch (err: any) {
    spinner.fail('Failed')
    console.error(`  ${chalk.red(err.response?.data?.error?.message ?? err.message)}\n`)
    process.exit(1)
  }
}

export async function flagsCreateCommand() {
  requireConfig()
  console.log('')
  p.intro(chalk.hex('#1D9E75').bold(' Create flag '))

  const name = await p.text({
    message: 'Flag name',
    placeholder: 'New checkout flow',
    validate: (v) => { if (!v.trim()) return 'Name is required' },
  })
  if (p.isCancel(name)) { p.cancel('Cancelled'); return }

  const key = await p.text({
    message: 'Flag key',
    placeholder: 'new-checkout-flow',
    initialValue: (name as string).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    validate: (v) => {
      if (!v.trim()) return 'Key is required'
      if (!/^[a-z0-9][a-z0-9-_]*$/.test(v)) return 'Lowercase letters, numbers, hyphens only'
    },
  })
  if (p.isCancel(key)) { p.cancel('Cancelled'); return }

  const type = await p.select({
    message: 'Flag type',
    options: [
      { value: 'boolean', label: 'Boolean', hint: 'true / false' },
      { value: 'string',  label: 'String',  hint: '"value"' },
      { value: 'number',  label: 'Number',  hint: '42' },
      { value: 'json',    label: 'JSON',    hint: '{"key":"value"}' },
    ],
  })
  if (p.isCancel(type)) { p.cancel('Cancelled'); return }

  const defaultValueStr = await p.text({
    message: 'Default value',
    placeholder: type === 'boolean' ? 'false' : type === 'string' ? '"value"' : '0',
    initialValue: type === 'boolean' ? 'false' : '',
  })
  if (p.isCancel(defaultValueStr)) { p.cancel('Cancelled'); return }

  let defaultValue: unknown = defaultValueStr
  try { defaultValue = JSON.parse(defaultValueStr as string) } catch {}

  const spinner = ora({ text: 'Creating flag...', color: 'green' }).start()

  try {
    const apiUrl    = config.get('apiUrl')
    const projectId = config.get('projectId')
    const token     = config.get('_accessToken' as any) as string

    const flag = await createFlag(apiUrl, token, projectId, {
      key, name, type, defaultValue,
    })

    spinner.succeed(`Flag created`)
    p.outro(`${chalk.hex('#5DCAA5')(flag.key)} · ${chalk.gray(`status: ${flag.status}`)}`)
    console.log('')
  } catch (err: any) {
    spinner.fail('Failed to create flag')
    console.error(`  ${chalk.red(err.response?.data?.error?.message ?? err.message)}\n`)
    process.exit(1)
  }
}
