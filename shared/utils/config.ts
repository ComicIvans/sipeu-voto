export class ConfigError extends Error {
  constructor(
    public readonly key: string,
    reason: string
  ) {
    super(`Invalid configuration for ${key}: ${reason}`)
    this.name = 'ConfigError'
  }
}

const normalizeConfigString = (value: unknown) => {
  if (value === undefined || value === null) {
    return null
  }

  const normalizedValue = String(value).trim()
  return normalizedValue || null
}

const throwConfigError = (key: string, reason: string): never => {
  throw new ConfigError(key, reason)
}

export function getOptionalConfigString(value: unknown) {
  return normalizeConfigString(value)
}

export function getOptionalConfigUrl(value: unknown, key: string) {
  const normalizedValue = normalizeConfigString(value)

  if (!normalizedValue) {
    return null
  }

  try {
    return new URL(normalizedValue).toString()
  } catch {
    return throwConfigError(key, 'must be a valid URL')
  }
}

export function requireConfigString(value: unknown, key: string) {
  return normalizeConfigString(value) ?? throwConfigError(key, 'is missing')
}
