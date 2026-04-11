/**
 * Welch's two-sample t-test implementation.
 *
 * Used instead of Student's t-test because:
 * - Variant sample sizes are rarely equal
 * - Variant variances cannot be assumed equal
 * - Welch's test is robust to both violations
 *
 * Returns the two-tailed p-value.
 * If p < (1 - confidenceLevel), the result is statistically significant.
 */

/**
 * Regularised incomplete beta function approximation.
 * Used to compute the p-value from the t-statistic and degrees of freedom.
 * Implementation via continued fraction expansion (Lentz's method).
 */
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200
  const EPS   = 3e-7
  const FPMIN = 1e-30

  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c  = 1.0
  let d  = 1.0 - qab * x / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1.0 / d
  let h = d

  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2))
    d = 1.0 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1.0 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1.0 / d
    h *= d * c
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
    d = 1.0 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1.0 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1.0 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1.0) < EPS) break
  }
  return h
}

function lnGamma(x: number): number {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.001208650973866179, -0.000005395239384953
  ]
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (const c of cof) { ser += c / ++y }
  return -tmp + Math.log(2.5066282746310005 * ser / x)
}

function betai(a: number, b: number, x: number): number {
  if (x < 0 || x > 1) throw new Error(`betai: x=${x} out of range`)
  if (x === 0 || x === 1) return x
  const lbeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b)
  const bt = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta)
  if (x < (a + 1) / (a + b + 2)) {
    return bt * betacf(a, b, x) / a
  } else {
    return 1.0 - bt * betacf(b, a, 1 - x) / b
  }
}

export interface VariantStats {
  n:            number   // sample size
  conversions:  number   // number of successes
}

export interface WelchResult {
  controlRate:    number   // conversion rate of control
  treatmentRate:  number   // conversion rate of treatment
  uplift:         number   // relative uplift: (treatment - control) / control
  tStatistic:     number
  degreesOfFreedom: number
  pValue:         number
  isSignificant:  boolean
  confidenceLevel: number  // e.g. 0.95
}

/**
 * Run Welch's two-sample t-test on two conversion rate samples.
 *
 * @param control    { n: total_users, conversions: converting_users }
 * @param treatment  { n: total_users, conversions: converting_users }
 * @param confidenceLevel  e.g. 0.95 for 95% confidence
 */
export function welchTTest(
  control:    VariantStats,
  treatment:  VariantStats,
  confidenceLevel = 0.95,
): WelchResult {
  if (control.n < 2 || treatment.n < 2) {
    return {
      controlRate:       control.conversions / Math.max(control.n, 1),
      treatmentRate:     treatment.conversions / Math.max(treatment.n, 1),
      uplift:            0,
      tStatistic:        0,
      degreesOfFreedom:  0,
      pValue:            1,
      isSignificant:     false,
      confidenceLevel,
    }
  }

  const p1 = control.conversions   / control.n
  const p2 = treatment.conversions / treatment.n

  // Sample variances for Bernoulli distributions: p(1-p)/n
  const var1 = (p1 * (1 - p1)) / control.n
  const var2 = (p2 * (1 - p2)) / treatment.n
  const pooledVariance = var1 + var2

  if (pooledVariance === 0) {
    return {
      controlRate:      p1, treatmentRate: p2,
      uplift:           p1 === 0 ? 0 : (p2 - p1) / p1,
      tStatistic:       0, degreesOfFreedom: 0,
      pValue:           p1 === p2 ? 1 : 0,
      isSignificant:    p1 !== p2,
      confidenceLevel,
    }
  }

  // Welch's t-statistic
  const tStat = (p2 - p1) / Math.sqrt(pooledVariance)

  // Welch-Satterthwaite degrees of freedom
  const df = (pooledVariance ** 2) /
    ((var1 ** 2) / (control.n - 1) + (var2 ** 2) / (treatment.n - 1))

  // Two-tailed p-value via regularised incomplete beta function
  const x = df / (df + tStat * tStat)
  const pValue = betai(df / 2, 0.5, x)

  const uplift = p1 === 0 ? 0 : (p2 - p1) / p1

  return {
    controlRate:       p1,
    treatmentRate:     p2,
    uplift,
    tStatistic:        tStat,
    degreesOfFreedom:  df,
    pValue,
    isSignificant:     pValue < (1 - confidenceLevel),
    confidenceLevel,
  }
}

/**
 * Calculate the minimum sample size needed per variant for
 * a given effect size, confidence level, and statistical power.
 * Uses the standard power analysis formula.
 *
 * @param baselineRate   Current conversion rate (e.g. 0.05 for 5%)
 * @param minimumEffect  Minimum detectable effect (e.g. 0.20 for 20% relative uplift)
 * @param confidenceLevel  e.g. 0.95
 * @param power          Statistical power, e.g. 0.80
 */
export function sampleSizeEstimate(
  baselineRate:   number,
  minimumEffect:  number,
  confidenceLevel = 0.95,
  power = 0.80,
): number {
  // Z-scores for common values
  const zAlpha = confidenceLevel >= 0.99 ? 2.576
               : confidenceLevel >= 0.95 ? 1.960
               : confidenceLevel >= 0.90 ? 1.645
               : 1.282

  const zBeta = power >= 0.90 ? 1.282
              : power >= 0.80 ? 0.842
              : 0.524

  const p1 = baselineRate
  const p2 = baselineRate * (1 + minimumEffect)
  const pBar = (p1 + p2) / 2

  const numerator   = (zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) +
                       zBeta  * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2
  const denominator = (p2 - p1) ** 2

  return Math.ceil(numerator / denominator)
}
