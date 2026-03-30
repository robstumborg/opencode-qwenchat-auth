import type { SSEParsedEvent } from "../types.js"

export function parseFrame(frame: string): SSEParsedEvent[] {
  const events: SSEParsedEvent[] = []
  const lines = frame.split("\n")

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || !trimmed.startsWith("data:")) continue

    const dataStr = trimmed.slice(5).trim()
    if (dataStr === "[DONE]") {
      events.push({ type: "done", data: null, rawData: dataStr })
      continue
    }

    try {
      const payload = JSON.parse(dataStr) as Record<string, unknown>
      events.push({
        type: typeof payload.type === "string" ? payload.type : "message",
        data: payload,
        rawData: dataStr,
      })
    } catch {
      events.push({ type: "raw", data: dataStr, rawData: dataStr })
    }
  }

  return events
}

export function isCompletionEvent(event: SSEParsedEvent): boolean {
  return (
    event.type === "done" ||
    event.type === "response.done" ||
    event.type === "response.completed"
  )
}

export function hasContent(event: SSEParsedEvent): boolean {
  if (!event.data || typeof event.data !== "object") {
    return false
  }

  const payload = event.data as Record<string, unknown>
  return !!(
    payload.delta ||
    payload.text ||
    payload.output_text ||
    (payload.message &&
      typeof payload.message === "object" &&
      (payload.message as Record<string, unknown>).content) ||
    (Array.isArray(payload.choices) &&
      payload.choices.length > 0 &&
      typeof payload.choices[0] === "object" &&
      (payload.choices[0] as Record<string, unknown>).delta &&
      typeof (payload.choices[0] as Record<string, unknown>).delta === "object" &&
      ((payload.choices[0] as Record<string, unknown>).delta as Record<string, unknown>).content)
  )
}
