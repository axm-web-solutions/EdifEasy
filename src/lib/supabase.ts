import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from './env'
import type { Database } from '@/types/database'

/**
 * Esquema de PostgreSQL donde vive TODO el modelo de datos de EdiFeasy.
 *
 * No usamos `public` para poder convivir con otras aplicaciones en la misma
 * base de datos. Requiere que el esquema este expuesto en la API REST:
 * Dashboard -> Settings -> API -> "Exposed schemas".
 */
export const DB_SCHEMA = 'tribuia' as const

export type DbSchema = typeof DB_SCHEMA

/**
 * Cliente unico de Supabase para todo el frontend.
 *
 * Usa exclusivamente la ANON KEY. La SERVICE_ROLE_KEY jamas debe llegar al
 * navegador: toda operacion privilegiada se resuelve con RLS, funciones
 * SECURITY DEFINER o Edge Functions.
 */
export const supabase: SupabaseClient<Database, DbSchema> = createClient<Database, DbSchema>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY,
  {
    db: { schema: DB_SCHEMA },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'edifeasy.auth',
      flowType: 'pkce',
    },
    global: {
      headers: { 'x-application-name': 'edifeasy-web' },
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  },
)

export const STORAGE_BUCKETS = {
  documents: 'documents',
  avatars: 'avatars',
  incidentEvidence: 'incident-evidence',
  invoices: 'invoices',
  announcements: 'announcements',
  signatures: 'signatures',
  reportImages: 'report-images',
} as const

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS]
