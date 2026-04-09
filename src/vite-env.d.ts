/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY: string
  
  // OpenRouter AI Configuration
  // Pattern: OpenAI SDK + OpenRouter base URL
  readonly Nemotron_API: string
  readonly VITE_OPENROUTER_API_KEY: string
  readonly VITE_OPENROUTER_MODEL: string
  readonly VITE_OPENROUTER_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
