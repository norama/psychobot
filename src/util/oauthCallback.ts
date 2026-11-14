// Application parameters (including the invitation token) are never removed.
const oauthParameters = [
  'code', 'sb_flow_id', 'error', 'error_code', 'error_description', 'error_uri',
  'access_token', 'refresh_token', 'provider_token', 'provider_refresh_token',
  'expires_in', 'expires_at', 'token_type', 'type',
]

type CallbackLocation = { search: string; hash: string }

export function hasOAuthCallback(location: CallbackLocation): boolean {
  const query = new URLSearchParams(location.search)
  const hash = new URLSearchParams(location.hash.slice(1))
  return ['code', 'error', 'error_code', 'error_description', 'access_token']
    .some((key) => query.has(key) || hash.has(key))
}

export function withoutOAuthCallback(location: CallbackLocation): CallbackLocation {
  const query = new URLSearchParams(location.search)
  const hash = new URLSearchParams(location.hash.slice(1))
  let queryChanged = false
  let hashChanged = false
  for (const key of oauthParameters) {
    if (query.has(key)) {
      query.delete(key)
      queryChanged = true
    }
    if (hash.has(key)) {
      hash.delete(key)
      hashChanged = true
    }
  }
  return {
    search: queryChanged ? (query.size ? `?${query}` : '') : location.search,
    hash: hashChanged ? (hash.size ? `#${hash}` : '') : location.hash,
  }
}
