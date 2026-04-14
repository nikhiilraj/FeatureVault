import chalk from 'chalk'

export function flagStatusColor(status: string): string {
  switch (status) {
    case 'active':   return chalk.hex('#1D9E75')(status)
    case 'killed':   return chalk.hex('#ff5f56')(status)
    case 'inactive': return chalk.gray(status)
    default:         return chalk.gray(status)
  }
}

export function experimentStatusColor(status: string): string {
  switch (status) {
    case 'running': return chalk.hex('#1D9E75')(status)
    case 'paused':  return chalk.yellow(status)
    case 'stopped': return chalk.gray(status)
    case 'draft':   return chalk.blue(status)
    default:        return chalk.gray(status)
  }
}

export function printTable(headers: string[], rows: string[][]): void {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => (r[i] ?? '').length))
  )

  const divider = widths.map(w => '─'.repeat(w + 2)).join('┼')
  const header  = headers.map((h, i) => ` ${h.padEnd(widths[i])} `).join('│')
  const sep     = `├${divider}┤`

  console.log(`┌${widths.map(w => '─'.repeat(w + 2)).join('┬')}┐`)
  console.log(`│${header}│`)
  console.log(sep)
  for (const row of rows) {
    const line = headers.map((_, i) => ` ${(row[i] ?? '').padEnd(widths[i])} `).join('│')
    console.log(`│${line}│`)
  }
  console.log(`└${widths.map(w => '─'.repeat(w + 2)).join('┴')}┘`)
}

export function printBanner(): void {
  console.log('')
  console.log(chalk.hex('#1D9E75').bold('  ╔══════════════════════════════════════╗'))
  console.log(chalk.hex('#1D9E75').bold('  ║') + chalk.white.bold('        FeatureVault CLI              ') + chalk.hex('#1D9E75').bold('║'))
  console.log(chalk.hex('#1D9E75').bold('  ╚══════════════════════════════════════╝'))
  console.log('')
}
