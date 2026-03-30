import type { Auth, Model, OAuth, Provider } from "@opencode-ai/sdk"

export type HeadersInput =
  | Headers
  | [string, string][]
  | Record<string, string>
  | Record<string, string | undefined>

export interface PluginConfig {
  qwenMode?: boolean
}

export interface PKCEPair {
  challenge: string
  verifier: string
}

export interface DeviceAuthorizationResponse {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete: string
  expires_in: number
  interval?: number
}

export interface QwenTokenResponse {
  access_token: string
  refresh_token: string
  token_type?: string
  expires_in: number
  scope?: string
  resource_url?: string
}

export interface TokenSuccess {
  type: "success"
  access: string
  refresh: string
  expires: number
  resourceUrl?: string
}

export interface TokenFailure {
  type: "failed"
}

export interface TokenPending {
  type: "pending"
}

export interface TokenSlowDown {
  type: "slow_down"
}

export interface TokenExpired {
  type: "expired"
}

export interface TokenDenied {
  type: "denied"
}

export type TokenResult =
  | TokenSuccess
  | TokenFailure
  | TokenPending
  | TokenSlowDown
  | TokenExpired
  | TokenDenied

export interface ChatMessage {
  role: string
  content: string
  [key: string]: unknown
}

export interface RequestBody {
  model?: string
  messages?: ChatMessage[]
  [key: string]: unknown
}

export interface SSEParsedEvent {
  type: string
  data: unknown
  rawData: string
}

export type { Auth, Model, OAuth, Provider }
