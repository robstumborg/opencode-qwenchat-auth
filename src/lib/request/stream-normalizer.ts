import { STREAM_CONFIG } from "../constants.js"
import { logWarn } from "../logger.js"
import { OpenAIChunkBuilder } from "./openai-chunk-builder.js"
import { calculateDelta, extractText } from "./payload-analyzer.js"
import { isCompletionEvent, parseFrame } from "./sse-parser.js"

export async function normalizeSseToOpenAI(response: Response): Promise<Response> {
  if (!response.body) {
    throw new Error("[qwenchat-auth-plugin] Response has no body")
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const reader = response.body.getReader()
  const state = {
    buffer: "",
    cumulativeText: "",
    recognized: false,
    finished: false,
    rawSseOut: "",
  }

  const builder = new OpenAIChunkBuilder("coder-model")

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        state.buffer += decoder.decode(value, { stream: true })

        let idx: number
        while ((idx = state.buffer.indexOf("\n\n")) !== -1) {
          const frame = state.buffer.slice(0, idx)
          state.buffer = state.buffer.slice(idx + 2)
          const events = parseFrame(frame)

          for (const event of events) {
            if (isCompletionEvent(event)) {
              if (!state.recognized) {
                state.rawSseOut += `data: ${event.rawData}\n\n`
                state.rawSseOut += builder.createDoneMarker()
                controller.enqueue(encoder.encode(state.rawSseOut))
              } else {
                const finishChunk = builder.createFinishChunk("stop")
                controller.enqueue(encoder.encode(builder.formatAsSSE(finishChunk)))
                controller.enqueue(encoder.encode(builder.createDoneMarker()))
              }
              state.finished = true
              return
            }

            if (event.type === "done") {
              if (!state.recognized) {
                state.rawSseOut += builder.createDoneMarker()
                controller.enqueue(encoder.encode(state.rawSseOut))
              } else {
                controller.enqueue(encoder.encode(builder.createDoneMarker()))
              }
              state.finished = true
              return
            }

            const incomingText = extractText(event.data)
            if (incomingText != null) {
              if (!state.recognized) {
                state.recognized = true
              }

              const { delta, cumulative } = calculateDelta(incomingText, state.cumulativeText)
              state.cumulativeText = cumulative

              if (delta) {
                const chunk = builder.createContentChunk(delta)
                controller.enqueue(encoder.encode(builder.formatAsSSE(chunk)))
              }
            } else if (!state.recognized) {
              state.rawSseOut += `data: ${event.rawData}\n\n`

              if (state.rawSseOut.length > STREAM_CONFIG.MAX_BUFFER_SIZE) {
                logWarn("SSE buffer exceeded maximum size, flushing to prevent memory leak")
                controller.enqueue(encoder.encode(state.rawSseOut))
                state.rawSseOut = ""
              }
            }
          }
        }
      }

      if (!state.finished) {
        if (state.recognized) {
          const finishChunk = builder.createFinishChunk("stop")
          controller.enqueue(encoder.encode(builder.formatAsSSE(finishChunk)))
          controller.enqueue(encoder.encode(builder.createDoneMarker()))
        } else {
          controller.enqueue(encoder.encode(state.rawSseOut))
        }
      }

      controller.close()
    },
    cancel() {
      reader.cancel()
    },
  })

  const headers = new Headers(response.headers)
  headers.set("content-type", "text/event-stream; charset=utf-8")

  return new Response(stream, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
