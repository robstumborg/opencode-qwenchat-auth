export const PLUGIN_NAME = "qwenchat-auth-plugin"
export const PROVIDER_ID = "alibaba"
export const DEFAULT_QWEN_BASE_URL = "https://portal.qwen.ai/v1"

export const QWEN_OAUTH = {
  DEVICE_CODE_URL: "https://chat.qwen.ai/api/v1/oauth2/device/code",
  TOKEN_URL: "https://chat.qwen.ai/api/v1/oauth2/token",
  CLIENT_ID: "f0304373b74a44d2b584a3fb70ca9e56",
  SCOPE: "openid profile email model.completion",
  GRANT_TYPE_DEVICE: "urn:ietf:params:oauth:grant-type:device_code",
  GRANT_TYPE_REFRESH: "refresh_token",
} as const

export const DEVICE_FLOW = {
  INITIAL_POLL_INTERVAL: 2000,
  MAX_POLL_INTERVAL: 10000,
  BACKOFF_MULTIPLIER: 1.5,
} as const

export const PLATFORM_OPENERS = {
  darwin: "open",
  win32: "start",
  linux: "xdg-open",
} as const

export const AUTH_LABELS = {
  OAUTH: "Qwen Chat (OAuth)",
  INSTRUCTIONS: "Visit the URL shown in your browser to complete authentication.",
} as const

export const VERIFICATION_URI = {
  CLIENT_PARAM_KEY: "client=",
  CLIENT_PARAM_VALUE: "client=qwen-code",
} as const

export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

export const STREAM_CONFIG = {
  MAX_BUFFER_SIZE: 1024 * 1024,
} as const
