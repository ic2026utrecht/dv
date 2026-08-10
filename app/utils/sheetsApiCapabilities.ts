/** Returns true when the deployed Apps Script supports incident status updates. */
export function supportsIncidentUpdate(config: { supportedActions?: string[], apiVersion?: number } | null | undefined): boolean {
  if (!config) {
    return false
  }
  if (config.apiVersion !== undefined && config.apiVersion >= 2) {
    return true
  }
  return config.supportedActions?.some(action => action === 'update' || action === 'updateIncident') ?? false
}
