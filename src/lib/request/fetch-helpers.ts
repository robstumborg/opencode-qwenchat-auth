export function buildHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-DashScope-AuthType": "qwen_oauth",
  }
}

export function rewriteUrl(url: string, baseUrl: string): string {
  const path = new URL(url).pathname
  const base = baseUrl.replace(/\/+$/, "")
  let normalizedPath = path

  if (base.endsWith("/v1") && normalizedPath.startsWith("/v1")) {
    normalizedPath = normalizedPath.replace(/^\/v1/, "")
  }

  if (!normalizedPath.startsWith("/")) {
    normalizedPath = `/${normalizedPath}`
  }

  return `${base}${normalizedPath}`
}
