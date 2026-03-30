export function extractText(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined

  const obj = payload as Record<string, unknown>

  if (typeof obj.delta === "string") return obj.delta
  if (typeof obj.text === "string") return obj.text
  if (typeof obj.output_text === "string") return obj.output_text

  if (obj.response && typeof obj.response === "object") {
    const response = obj.response as Record<string, unknown>
    if (typeof response.output_text === "string") return response.output_text
  }

  if (obj.message && typeof obj.message === "object") {
    const message = obj.message as Record<string, unknown>
    if (typeof message.content === "string") return message.content
  }

  if (Array.isArray(obj.choices) && obj.choices.length > 0) {
    const choice = obj.choices[0] as Record<string, unknown>
    if (choice.delta && typeof choice.delta === "object") {
      const delta = choice.delta as Record<string, unknown>
      if (typeof delta.content === "string") return delta.content
    }
  }

  if (obj.delta && typeof obj.delta === "object") {
    const delta = obj.delta as Record<string, unknown>
    if (typeof delta.text === "string") return delta.text
    if (typeof delta.content === "string") return delta.content
  }

  const candidates = [
    obj.message && typeof obj.message === "object"
      ? (obj.message as Record<string, unknown>).content
      : undefined,
    obj.delta && typeof obj.delta === "object"
      ? (obj.delta as Record<string, unknown>).content
      : undefined,
    obj.content,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      let combined = ""
      for (const item of candidate) {
        if (typeof item === "string") {
          combined += item
        } else if (item && typeof item === "object") {
          const itemObj = item as Record<string, unknown>
          if (typeof itemObj.text === "string") combined += itemObj.text
          else if (typeof itemObj.content === "string") combined += itemObj.content
        }
      }
      if (combined) return combined
    }
  }

  return undefined
}

export function isCumulative(current: string, previous: string): boolean {
  if (!previous) return false
  return current.startsWith(previous)
}

export function calculateDelta(
  current: string,
  previous: string,
): { delta: string; cumulative: string } {
  if (!previous) {
    return { delta: current, cumulative: current }
  }

  if (isCumulative(current, previous)) {
    return {
      delta: current.slice(previous.length),
      cumulative: current,
    }
  }

  return {
    delta: current,
    cumulative: previous + current,
  }
}
