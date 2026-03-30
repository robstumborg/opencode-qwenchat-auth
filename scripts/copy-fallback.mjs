import { cpSync, existsSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"

const source = resolve("src/lib/prompts/fallback/opencode-qwen-prompt.txt")
const target = resolve("dist/lib/prompts/fallback/opencode-qwen-prompt.txt")

if (!existsSync(source)) {
  throw new Error(`Missing fallback prompt: ${source}`)
}

mkdirSync(dirname(target), { recursive: true })
cpSync(source, target)
