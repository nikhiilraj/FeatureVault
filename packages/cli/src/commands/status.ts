import chalk from 'chalk'
import ora from 'ora'
import axios from 'axios'
import { config, isConfigured } from '../config.js'

export async function statusCommand() {
  const apiUrl = config.get('apiUrl') || 'http://localhost:4000'
  const spinner = ora({ text: `Checking ${apiUrl}...`, color: 'green' }).start()

  try {
    const res = await axios.get(`${apiUrl}/health`, { timeout: 5000 })
    const data = res.data
    spinner.stop()

    console.log('')
    console.log(`  ${chalk.hex('#1D9E75')('◆')} ${chalk.white('API')}      ${chalk.hex('#1D9E75')('online')} ${chalk.gray(`(${apiUrl})`)}`)
    console.log(`  ${chalk.hex('#1D9E75')('◆')} ${chalk.white('Version')}  ${chalk.gray(data.version ?? 'unknown')}`)
    console.log(`  ${chalk.hex('#1D9E75')('◆')} ${chalk.white('Time')}     ${chalk.gray(data.timestamp)}`)

    if (isConfigured()) {
      console.log(`  ${chalk.hex('#1D9E75')('◆')} ${chalk.white('Config')}   ${chalk.hex('#1D9E75')('present')} ${chalk.gray(config.path)}`)
      console.log(`  ${chalk.hex('#1D9E75')('◆')} ${chalk.white('Project')} ${chalk.gray(config.get('projectId'))}`)
    } else {
      console.log(`  ${chalk.yellow('◆')} ${chalk.white('Config')}   ${chalk.yellow('not configured')} — run ${chalk.hex('#1D9E75')('fv init')}`)
    }
    console.log('')
  } catch (err: any) {
    spinner.fail(`Cannot reach ${apiUrl}`)
    console.error(`\n  ${chalk.gray('Make sure the API is running and the URL is correct.')}\n`)
    process.exit(1)
  }
}
