import type { SupabaseClient } from '@supabase/supabase-js'
import type { ConfigResponse, SubmitIncidentResponse, IncidentsResponse, UpdateIncidentResponse } from '~/types/api'
import type { IncidentSubmission, IncidentUpdate } from '~/types/models'
import {
  assertSupabaseConfig,
  fetchSupabaseConfig,
  fetchSupabaseIncidents,
  postSupabaseIncident,
  postSupabaseIncidentUpdate,
} from '~/utils/supabaseApi'

class IncidentsModule {
  private client: SupabaseClient
  private supabaseUrl: string
  private supabaseAnonKey: string

  constructor(client: SupabaseClient, supabaseUrl: string, supabaseAnonKey: string) {
    this.client = client
    this.supabaseUrl = supabaseUrl
    this.supabaseAnonKey = supabaseAnonKey
  }

  private assertConfigured(): void {
    assertSupabaseConfig(this.supabaseUrl, this.supabaseAnonKey)
  }

  async getConfig(): Promise<ConfigResponse> {
    this.assertConfigured()
    return await fetchSupabaseConfig(this.client)
  }

  async submit(payload: IncidentSubmission): Promise<SubmitIncidentResponse> {
    this.assertConfigured()
    const config = await fetchSupabaseConfig(this.client)
    return await postSupabaseIncident(this.client, payload, config.data.helpOptions)
  }

  async list(): Promise<IncidentsResponse> {
    this.assertConfigured()
    return await fetchSupabaseIncidents(this.client)
  }

  async update(payload: IncidentUpdate): Promise<UpdateIncidentResponse> {
    this.assertConfigured()
    return await postSupabaseIncidentUpdate(this.client, payload)
  }
}

export default IncidentsModule
