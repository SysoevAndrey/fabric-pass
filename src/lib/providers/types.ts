export type ProviderName = 'github' | 'discord' | 'telegram'

/** Everything we are willing to take from a provider. */
export interface Identity {
  providerId: string
  username?: string
  phone?: string
}

export interface AuthRequest {
  url: URL
  codeVerifier: string
  state: string
}

export interface Provider {
  name: ProviderName
  /** `variant` exists for Telegram's second pass, which asks for a phone. */
  authRequest(redirectUri: string, variant?: 'phone'): Promise<AuthRequest>
  callback(currentUrl: URL, redirectUri: string, codeVerifier: string, state: string): Promise<Identity>
}
