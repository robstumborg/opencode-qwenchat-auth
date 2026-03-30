import type { HeadersInput } from "../types.js"

export function normalizeHeaders(headers?: HeadersInput): Record<string, string> {
  if (!headers) return {}

  if (headers instanceof Headers) {
    const result: Record<string, string> = {}
    headers.forEach((value, key) => {
      result[key] = value
    })
    return result
  }

  if (Array.isArray(headers)) {
    const result: Record<string, string> = {}
    for (const [key, value] of headers) {
      result[key] = value
    }
    return result
  }

  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      result[key] = value
    }
  }
  return result
}

export function removeHeaders(
  headers: Record<string, string>,
  toRemove: string[],
): Record<string, string> {
  const result = { ...headers }
  const lowerToRemove = toRemove.map((header) => header.toLowerCase())

  for (const key of Object.keys(result)) {
    if (lowerToRemove.includes(key.toLowerCase())) {
      delete result[key]
    }
  }

  return result
}

export function mergeHeaders(
  existing: HeadersInput | undefined,
  additional: Record<string, string>,
  overwrite: string[] = [],
): Record<string, string> {
  const normalized = normalizeHeaders(existing)
  const cleaned = removeHeaders(normalized, overwrite)
  return { ...cleaned, ...additional }
}
