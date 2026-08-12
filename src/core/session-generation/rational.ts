export type Rational = Readonly<{
  numerator: bigint
  denominator: bigint
}>

export function rational(numerator: bigint, denominator = 1n): Rational {
  if (denominator <= 0n) throw new Error('invalid_rational_denominator')
  const divisor = gcd(numerator < 0n ? -numerator : numerator, denominator)
  return {
    numerator: numerator / divisor,
    denominator: denominator / divisor
  }
}

export function decimal(value: string): Rational {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(value)
  if (!match) throw new Error('invalid_decimal')
  const sign = match[1] === '-' ? -1n : 1n
  const fractional = match[3] ?? ''
  const digits = BigInt(`${match[2]}${fractional}`)
  const power = Number(match[4] ?? '0') - fractional.length
  return power >= 0
    ? rational(sign * digits * 10n ** BigInt(power))
    : rational(sign * digits, 10n ** BigInt(-power))
}

export function canonicalDecimal(value: string): string {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value)
  if (!match) throw new Error('invalid_fraction')
  const whole = match[1]!.replace(/^0+(?=\d)/, '')
  const fractional = (match[2] ?? '').replace(/0+$/, '')
  return fractional.length === 0 ? whole : `${whole}.${fractional}`
}

export function add(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator
  )
}

export function subtract(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator
  )
}

export function multiply(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.numerator,
    left.denominator * right.denominator
  )
}

export function divide(left: Rational, right: Rational): Rational {
  if (right.numerator === 0n) throw new Error('invalid_rational_division')
  return rational(
    left.numerator * right.denominator,
    left.denominator * right.numerator
  )
}

export function roundHalfUp(value: Rational): number {
  const sign = value.numerator < 0n ? -1n : 1n
  const absolute = value.numerator < 0n ? -value.numerator : value.numerator
  const rounded =
    sign * ((absolute * 2n + value.denominator) / (2n * value.denominator))
  const result = Number(rounded)
  if (!Number.isSafeInteger(result)) throw new Error('derived_integer_overflow')
  return result
}

export function floor(value: Rational): number {
  const quotient = value.numerator / value.denominator
  const adjusted =
    value.numerator < 0n && value.numerator % value.denominator !== 0n
      ? quotient - 1n
      : quotient
  const result = Number(adjusted)
  if (!Number.isSafeInteger(result)) throw new Error('derived_integer_overflow')
  return result
}

export function compare(left: Rational, right: Rational): number {
  const delta =
    left.numerator * right.denominator - right.numerator * left.denominator
  return delta < 0n ? -1 : delta > 0n ? 1 : 0
}

export function absolute(value: Rational): Rational {
  return rational(
    value.numerator < 0n ? -value.numerator : value.numerator,
    value.denominator
  )
}

export function toNumber(value: Rational): number {
  const result = Number(value.numerator) / Number(value.denominator)
  if (!Number.isFinite(result)) throw new Error('derived_number_overflow')
  return result
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left
  let b = right
  while (b !== 0n) {
    const remainder = a % b
    a = b
    b = remainder
  }
  return a === 0n ? 1n : a
}
