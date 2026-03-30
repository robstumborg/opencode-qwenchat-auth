import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { getCacheDir } from "../config.js"
import { logDebug } from "../logger.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function loadBundledFallback(): string {
  const fallbackPath = join(__dirname, "fallback", "opencode-qwen-prompt.txt")
  return readFileSync(fallbackPath, "utf-8")
}

const OPENCODE_QWEN_URL =
  "https://raw.githubusercontent.com/sst/opencode/dev/packages/opencode/src/session/prompt/qwen.txt"
const CACHE_FILE = "opencode-qwen.txt"
const META_FILE = "opencode-qwen-meta.json"

export async function getOpenCodeQwenPrompt(): Promise<string> {
  const cacheDir = getCacheDir()
  const cachePath = join(cacheDir, CACHE_FILE)
  const metaPath = join(cacheDir, META_FILE)

  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true, mode: 0o700 })
  }

  let metadata: { etag?: string; lastChecked?: number; url?: string } | null = null
  if (existsSync(metaPath)) {
    try {
      metadata = JSON.parse(readFileSync(metaPath, "utf-8")) as {
        etag?: string
        lastChecked?: number
        url?: string
      }
    } catch {
      metadata = null
    }
  }

  const headers: Record<string, string> = {}
  if (metadata?.etag) {
    headers["If-None-Match"] = metadata.etag
  }

  try {
    const res = await fetch(OPENCODE_QWEN_URL, { headers })

    if (res.status === 304 && existsSync(cachePath)) {
      const cached = readFileSync(cachePath, "utf-8")
      if (metadata) {
        metadata.lastChecked = Date.now()
        writeFileSync(metaPath, JSON.stringify(metadata, null, 2), "utf-8")
      }
      return cached
    }

    if (res.ok) {
      const content = await res.text()
      const etag = res.headers.get("etag")
      writeFileSync(cachePath, content, "utf-8")
      writeFileSync(
        metaPath,
        JSON.stringify({ etag, lastChecked: Date.now(), url: OPENCODE_QWEN_URL }, null, 2),
        "utf-8",
      )
      return content
    }

    if (existsSync(cachePath)) {
      logDebug(`Failed to fetch OpenCode qwen.txt (status: ${res.status}), using cache`)
      return readFileSync(cachePath, "utf-8")
    }

    logDebug("No cache available, using bundled fallback for OpenCode qwen.txt")
    return loadBundledFallback()
  } catch {
    if (existsSync(cachePath)) {
      logDebug("Network error fetching OpenCode qwen.txt, using cache")
      return readFileSync(cachePath, "utf-8")
    }

    logDebug("Network error and no cache, using bundled fallback for OpenCode qwen.txt")
    return loadBundledFallback()
  }
}

export function isOpenCodeQwenPrompt(content: string, qwenPrompt: string): boolean {
  if (content === qwenPrompt) {
    return true
  }

  const signatures = [
    "You are opencode, an interactive CLI tool",
    "When the user directly asks about opencode",
  ]

  return signatures.every((signature) => content.includes(signature))
}
