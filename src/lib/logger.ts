import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export const LOGGING_ENABLED = process.env.ENABLE_PLUGIN_REQUEST_LOGGING === "1"
export const DEBUG_ENABLED = process.env.DEBUG_QWEN_PLUGIN === "1" || LOGGING_ENABLED

const LOG_DIR = join(homedir(), ".opencode", "logs", "qwenchat-auth-plugin")

if (LOGGING_ENABLED) {
  console.log("[qwenchat-auth-plugin] Request logging ENABLED - logs will be saved to:", LOG_DIR)
}

if (DEBUG_ENABLED && !LOGGING_ENABLED) {
  console.log("[qwenchat-auth-plugin] Debug logging ENABLED")
}

let requestCounter = 0

export function logRequest(stage: string, data: Record<string, unknown>): void {
  if (!LOGGING_ENABLED) return

  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true })
  }

  const timestamp = new Date().toISOString()
  const requestId = ++requestCounter
  const filename = join(LOG_DIR, `request-${requestId}-${stage}.json`)

  try {
    writeFileSync(
      filename,
      JSON.stringify(
        {
          timestamp,
          requestId,
          stage,
          ...data,
        },
        null,
        2,
      ),
      "utf8",
    )
    console.log(`[qwenchat-auth-plugin] Logged ${stage} to ${filename}`)
  } catch (error) {
    const fileError = error as Error
    console.error("[qwenchat-auth-plugin] Failed to write log:", fileError.message)
  }
}

export function logDebug(message: string, data?: unknown): void {
  if (!DEBUG_ENABLED) return

  if (data !== undefined) {
    console.log(`[qwenchat-auth-plugin] ${message}`, data)
  } else {
    console.log(`[qwenchat-auth-plugin] ${message}`)
  }
}

export function logError(message: string, data?: unknown): void {
  if (data !== undefined) {
    console.error(`[qwenchat-auth-plugin] ${message}`, data)
  } else {
    console.error(`[qwenchat-auth-plugin] ${message}`)
  }
}

export function logWarn(message: string, data?: unknown): void {
  if (data !== undefined) {
    console.warn(`[qwenchat-auth-plugin] ${message}`, data)
  } else {
    console.warn(`[qwenchat-auth-plugin] ${message}`)
  }
}

export function logInfo(message: string, data?: unknown): void {
  if (data !== undefined) {
    console.log(`[qwenchat-auth-plugin] ${message}`, data)
  } else {
    console.log(`[qwenchat-auth-plugin] ${message}`)
  }
}
