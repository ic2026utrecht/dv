import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ConfigResponse,
  SubmitIncidentResponse,
  IncidentsResponse,
  UpdateIncidentResponse,
  IncidentStatusHistoryResponse,
  IncidentUpdateHistoryResponse,
} from '~/types/api'
import type { IncidentSubmission, IncidentUpdate } from '~/types/models'
import {
  assertSupabaseConfig,
  fetchSupabaseConfig,
  fetchSupabaseIncidents,
  fetchSupabaseIncidentStatusHistory,
  fetchSupabaseIncidentUpdates,
  fetchSupabaseIncidentFeedUnreadCounts,
  postSupabaseIncident,
  postSupabaseIncidentUpdate,
  deleteSupabaseIncidentUpdate,
  markSupabaseIncidentFeedRead,
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

  async getStatusHistory(incidentId: string): Promise<IncidentStatusHistoryResponse> {
    this.assertConfigured()
    return await fetchSupabaseIncidentStatusHistory(this.client, incidentId)
  }

  async getUpdateHistory(incidentId: string): Promise<IncidentUpdateHistoryResponse> {
    this.assertConfigured()
    return await fetchSupabaseIncidentUpdates(this.client, incidentId)
  }

  async deleteUpdate(updateId: string): Promise<void> {
    this.assertConfigured()
    await deleteSupabaseIncidentUpdate(this.client, updateId)
  }

  async getFeedUnreadCounts(): Promise<Record<string, number>> {
    this.assertConfigured()
    return await fetchSupabaseIncidentFeedUnreadCounts(this.client)
  }

  async markFeedRead(incidentId: string, readAt?: string): Promise<void> {
    this.assertConfigured()
    await markSupabaseIncidentFeedRead(this.client, incidentId, readAt)
  }
}

export default IncidentsModule
