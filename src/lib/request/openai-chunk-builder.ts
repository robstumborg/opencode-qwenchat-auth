interface OpenAIChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string
    }
    finish_reason: string | null
  }>
}

export class OpenAIChunkBuilder {
  private chunkId: string
  private model: string
  private sentInitialRole = false

  constructor(model = "coder-model") {
    this.chunkId = `chatcmpl_${Math.random().toString(36).slice(2, 12)}`
    this.model = model
  }

  createRoleChunk(): OpenAIChunk {
    this.sentInitialRole = true
    return {
      id: this.chunkId,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model: this.model,
      choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
    }
  }

  createContentChunk(content: string): OpenAIChunk {
    const chunk: OpenAIChunk = {
      id: this.chunkId,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model: this.model,
      choices: [{ index: 0, delta: {}, finish_reason: null }],
    }

    if (!this.sentInitialRole) {
      chunk.choices[0].delta.role = "assistant"
      this.sentInitialRole = true
    }

    chunk.choices[0].delta.content = content
    return chunk
  }

  createFinishChunk(reason = "stop"): OpenAIChunk {
    return {
      id: this.chunkId,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model: this.model,
      choices: [{ index: 0, delta: {}, finish_reason: reason }],
    }
  }

  formatAsSSE(chunk: OpenAIChunk): string {
    return `data: ${JSON.stringify(chunk)}\n\n`
  }

  createDoneMarker(): string {
    return "data: [DONE]\n\n"
  }

  hasRole(): boolean {
    return this.sentInitialRole
  }
}
