import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

import type { PluginConfig } from "./types.js"

export function getConfigDir(): string {
  return join(homedir(), ".opencode", "qwen")
}

export function getConfigPath(): string {
  return join(getConfigDir(), "auth-config.json")
}

export function loadPluginConfig(): PluginConfig {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) {
    return { qwenMode: true }
  }

  try {
    return JSON.parse(readFileSync(configPath, "utf-8")) as PluginConfig
  } catch (error) {
    console.warn(`[qwenchat-auth-plugin] Failed to load config from ${configPath}:`, error)
    return { qwenMode: true }
  }
}

export function getQwenMode(config: PluginConfig): boolean {
  const envValue = process.env.QWEN_MODE
  if (envValue !== undefined) {
    return envValue === "1" || envValue.toLowerCase() === "true"
  }

  return config.qwenMode ?? true
}

export function getCacheDir(): string {
  return join(homedir(), ".opencode", "cache")
}
