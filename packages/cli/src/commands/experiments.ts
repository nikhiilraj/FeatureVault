import chalk from 'chalk'
import ora from 'ora'
import { config, isConfigured } from '../config.js'
import { getExperiments } from '../api.js'
import { experimentStatusColor, printTable } from '../display.js'

function requireConfig() {
  if (!isConfigured()) {
    console.error(`\n  ${chalk.red('Not configured.')} Run ${chalk.hex('#1D9E75')('fv init')} first.\n`)
    process.exit(1)
  }
}

export async function experimentsListCommand() {
  requireConfig()
  const spinner = ora({ text: 'Loading experiments...', color: 'green' }).start()

  try {
    const apiUrl    = config.get('apiUrl')
    const projectId = config.get('projectId')
    const token     = config.get('_accessToken' as any) as string

    const { data: exps, pagination } = await getExperiments(apiUrl, token, projectId)
    spinner.stop()

    if (!exps.length) {
      console.log(`\n  ${chalk.gray('No experiments found.')}\n`)
      return
    }

    console.log('')
    printTable(
      ['Key', 'Name', 'Metric', 'Status'],
      exps.map((e: any) => [
        chalk.hex('#5DCAA5')(e.key),
        e.name,
        chalk.gray(e.primaryMetric),
        experimentStatusColor(e.status),
      ])
    )
    console.log(`\n  ${chalk.gray(`${pagination.total} experiment${pagination.total !== 1 ? 's' : ''} total`)}\n`)
  } catch (err: any) {
    spinner.fail('Failed to load experiments')
    console.error(`  ${chalk.red(err.response?.data?.error?.message ?? err.message)}\n`)
    process.exit(1)
  }
}
