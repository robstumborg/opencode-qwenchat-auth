import type { ChatMessage, RequestBody } from "../types.js"
import { getQwenCodePrompt } from "../prompts/qwen-code.js"
import { isOpenCodeQwenPrompt } from "../prompts/opencode-qwen.js"
import { QWEN_OPENCODE_BRIDGE, QWEN_TOOL_REMAP_MESSAGE } from "../prompts/qwen-opencode-bridge.js"

export function normalizeModel(model: string): string {
  const modelName = model.includes("/") ? model.split("/")[1] : model

  if (
    modelName.startsWith("qwen3-coder") ||
    modelName.startsWith("qwen-coder") ||
    modelName.startsWith("qwen-turbo") ||
    modelName.startsWith("qwen-max") ||
    modelName.startsWith("qwen-plus") ||
    modelName === "coder-model"
  ) {
    return "coder-model"
  }

  if (modelName.includes("vision") || modelName.includes("vl")) {
    return "vision-model"
  }

  return "coder-model"
}

export function filterOpenCodeQwenPrompts(
  messages: ChatMessage[],
  openCodeQwenPrompt: string,
): ChatMessage[] {
  return messages.filter((msg) => {
    if (msg.role !== "system") {
      return true
    }

    return !isOpenCodeQwenPrompt(msg.content, openCodeQwenPrompt)
  })
}

export function addQwenBridgeMessage(messages: ChatMessage[]): ChatMessage[] {
  return [{ role: "system", content: QWEN_OPENCODE_BRIDGE }, ...messages]
}

export function addQwenToolRemapMessage(messages: ChatMessage[]): ChatMessage[] {
  return [{ role: "system", content: QWEN_TOOL_REMAP_MESSAGE }, ...messages]
}

export function transformRequestBody(
  body: Record<string, unknown>,
  qwenMode: boolean,
  openCodeQwenPrompt: string,
): RequestBody {
  const transformed = { ...body } as RequestBody

  if (transformed.model) {
    transformed.model = normalizeModel(transformed.model)
  }

  if (transformed.messages && Array.isArray(transformed.messages)) {
    if (qwenMode) {
      transformed.messages = filterOpenCodeQwenPrompts(transformed.messages, openCodeQwenPrompt)
      const qwenCodePrompt = getQwenCodePrompt()
      transformed.messages = [
        { role: "system", content: qwenCodePrompt },
        ...transformed.messages,
      ]
      transformed.messages = addQwenBridgeMessage(transformed.messages)
    } else {
      transformed.messages = addQwenToolRemapMessage(transformed.messages)
    }
  }

  delete transformed.instructions
  delete transformed.reasoning_effort
  delete transformed.reasoning_summary

  return transformed
}
