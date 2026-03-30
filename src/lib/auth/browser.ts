import { spawn } from "node:child_process"

import { PLATFORM_OPENERS } from "../constants.js"

export function getBrowserOpener(): string {
  const platform = process.platform
  if (platform === "darwin") return PLATFORM_OPENERS.darwin
  if (platform === "win32") return PLATFORM_OPENERS.win32
  return PLATFORM_OPENERS.linux
}

export function openBrowserUrl(url: string): void {
  try {
    const opener = getBrowserOpener()
    spawn(opener, [url], {
      stdio: "ignore",
      shell: process.platform === "win32",
    })
  } catch {
    // Let the user open the URL manually from the terminal output.
  }
}
