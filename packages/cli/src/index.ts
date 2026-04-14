import chalk from 'chalk'
import { printBanner } from './display.js'
import { initCommand } from './commands/init.js'
import { flagsListCommand, flagsEnableCommand, flagsDisableCommand, flagsKillCommand, flagsCreateCommand } from './commands/flags.js'
import { experimentsListCommand } from './commands/experiments.js'
import { statusCommand } from './commands/status.js'

const args = process.argv.slice(2)
const cmd  = args[0]
const sub  = args[1]
const arg  = args[2]

function showHelp() {
  printBanner()
  console.log(`  ${chalk.white('Usage:')} fv <command> [options]\n`)
  console.log(`  ${chalk.hex('#1D9E75')('Setup')}`)
  console.log(`    ${chalk.white('fv init')}                    Connect to a FeatureVault instance`)
  console.log(`    ${chalk.white('fv status')}                  Check API health and config\n`)
  console.log(`  ${chalk.hex('#1D9E75')('Flags')}`)
  console.log(`    ${chalk.white('fv flags list')}              List all flags`)
  console.log(`    ${chalk.white('fv flags create')}            Create a new flag`)
  console.log(`    ${chalk.white('fv flags enable <key>')}      Enable a flag`)
  console.log(`    ${chalk.white('fv flags disable <key>')}     Disable a flag`)
  console.log(`    ${chalk.white('fv flags kill <key>')}        Kill a flag (emergency off)\n`)
  console.log(`  ${chalk.hex('#1D9E75')('Experiments')}`)
  console.log(`    ${chalk.white('fv experiments list')}        List all experiments\n`)
  console.log(`  ${chalk.gray('Examples:')}`)
  console.log(`    ${chalk.gray('fv init')}`)
  console.log(`    ${chalk.gray('fv flags kill payment-v2')}`)
  console.log(`    ${chalk.gray('fv flags enable dark-mode')}\n`)
}

async function main() {
  switch (cmd) {
    case 'init':    return initCommand()
    case 'status':  return statusCommand()

    case 'flags':
    case 'flag':
      switch (sub) {
        case 'list':    case 'ls':   return flagsListCommand()
        case 'create':  case 'new':  return flagsCreateCommand()
        case 'enable':               return flagsEnableCommand(arg)
        case 'disable': case 'off':  return flagsDisableCommand(arg)
        case 'kill':                 return flagsKillCommand(arg)
        default:
          if (!sub) return flagsListCommand()
          console.error(`\n  ${chalk.red('Unknown flags command:')} ${sub}\n`)
          process.exit(1)
      }
      break

    case 'experiments':
    case 'experiment':
    case 'exp':
      switch (sub) {
        case 'list': case 'ls': return experimentsListCommand()
        default:
          if (!sub) return experimentsListCommand()
          console.error(`\n  ${chalk.red('Unknown experiments command:')} ${sub}\n`)
          process.exit(1)
      }
      break

    case '--help':
    case '-h':
    case 'help':
    case undefined:
      showHelp()
      break

    default:
      console.error(`\n  ${chalk.red('Unknown command:')} ${cmd}\n`)
      showHelp()
      process.exit(1)
  }
}

main().catch(err => {
  console.error(`\n  ${chalk.red('Unexpected error:')} ${err.message}\n`)
  process.exit(1)
})
