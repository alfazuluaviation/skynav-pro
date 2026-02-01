/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

// Allow Vite asset imports like: import wasmUrl from 'pkg/file.wasm?url'
declare module '*?url' {
  const src: string;
  export default src;
}
