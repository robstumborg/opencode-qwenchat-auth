import { LOGGING_ENABLED, logError, logRequest } from "../logger.js"

export { normalizeSseToOpenAI } from "./stream-normalizer.js"

function parseSseStream(sseText: string): unknown {
  const lines = sseText.split("\n")
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      try {
        const data = JSON.parse(line.substring(6)) as Record<string, unknown>
        if (data.type === "response.done" || data.type === "response.completed") {
          return data.response
        }
      } catch {
        // Ignore malformed SSE data.
      }
    }
  }

  return null
}

export async function convertSseToJson(response: Response, headers: Headers): Promise<Response> {
  if (!response.body) {
    throw new Error("[qwenchat-auth-plugin] Response has no body")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      fullText += decoder.decode(value, { stream: true })
    }

    if (LOGGING_ENABLED) {
      logRequest("stream-full", { fullContent: fullText })
    }

    const finalResponse = parseSseStream(fullText)
    if (!finalResponse) {
      logError("Could not find final response in SSE stream")
      logRequest("stream-error", { error: "No response.done event found" })
      return new Response(fullText, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    }

    const jsonHeaders = new Headers(headers)
    jsonHeaders.set("content-type", "application/json; charset=utf-8")
    return new Response(JSON.stringify(finalResponse), {
      status: response.status,
      statusText: response.statusText,
      headers: jsonHeaders,
    })
  } catch (error) {
    logError("Error converting stream:", error)
    logRequest("stream-error", { error: String(error) })
    throw error
  }
}

export function ensureContentType(headers: Headers): Headers {
  const responseHeaders = new Headers(headers)
  if (!responseHeaders.has("content-type")) {
    responseHeaders.set("content-type", "text/event-stream; charset=utf-8")
  }
  return responseHeaders
}
