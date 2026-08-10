import type { ConfigResponse, SubmitIncidentResponse, IncidentsResponse, UpdateIncidentResponse } from '~/types/api'
import type { IncidentSubmission, IncidentUpdate } from '~/types/models'

declare global {
  interface Window {
    [key: string]: ((payload: unknown) => void) | undefined
  }
}

export function assertSheetsApiUrl(url: string): void {
  if (!url || url.includes('YOUR_DEPLOYMENT_ID')) {
    throw new Error(
      'NUXT_PUBLIC_SHEETS_API_URL is not set. Copy .env.example to .env and paste your /exec URL.',
    )
  }
}

type JsonpPayload = { error?: string }

function fetchSheetsJsonp<T extends JsonpPayload>(
  baseURL: string,
  params: Record<string, string>,
  timeoutMs = 15000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const callbackName = `icApi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    const script = document.createElement('script')

    const cleanup = () => {
      delete window[callbackName]
      script.remove()
    }

    window[callbackName] = (payload: T) => {
      cleanup()
      if (payload?.error) {
        const message = String(payload.error)
        if (message === 'Unknown action') {
          reject(new Error(
            'De Sheets API kent deze actie niet. Kopieer de nieuwste apps-script/Api.gs '
            + 'naar Apps Script en deploy opnieuw (Manage deployments → Edit → New version).',
          ))
          return
        }
        reject(new Error(message))
        return
      }
      resolve(payload)
    }

    const search = new URLSearchParams(params)
    search.set('callback', callbackName)
    const separator = baseURL.includes('?') ? '&' : '?'
    script.src = `${baseURL}${separator}${search.toString()}`
    script.async = true
    script.onerror = () => {
      cleanup()
      reject(new Error('Kon geen verbinding maken met Sheets API (JSONP).'))
    }

    document.head.appendChild(script)

    window.setTimeout(() => {
      if (window[callbackName]) {
        cleanup()
        reject(new Error('Timeout bij Sheets API'))
      }
    }, timeoutMs)
  })
}

/** JSONP — required because Apps Script does not send CORS headers. */
export function fetchSheetsConfig(baseURL: string): Promise<ConfigResponse> {
  assertSheetsApiUrl(baseURL)
  return fetchSheetsJsonp<ConfigResponse>(baseURL, { action: 'config' })
}

/** JSONP — fetch all incidents from Incidents_view. */
export function fetchSheetsIncidents(baseURL: string): Promise<IncidentsResponse> {
  assertSheetsApiUrl(baseURL)
  return fetchSheetsJsonp<IncidentsResponse>(baseURL, { action: 'incidents' })
}

/** JSONP submit — avoids POST 302 redirect issues in the browser. */
export function postSheetsIncident(
  baseURL: string,
  payload: IncidentSubmission,
): Promise<SubmitIncidentResponse> {
  assertSheetsApiUrl(baseURL)

  const encoded = JSON.stringify(payload)
  if (baseURL.length + encoded.length > 7500) {
    throw new Error('Formulier te groot. Verkort de omschrijving en probeer opnieuw.')
  }

  return fetchSheetsJsonp<SubmitIncidentResponse>(baseURL, {
    action: 'submit',
    payload: encoded,
  }).then((response) => {
    if (!response.data?.incidentId) {
      throw new Error('Ongeldig antwoord van Sheets API')
    }
    return response
  })
}

/** JSONP update — patch incident status / ops fields. */
export function postSheetsIncidentUpdate(
  baseURL: string,
  payload: IncidentUpdate,
): Promise<UpdateIncidentResponse> {
  assertSheetsApiUrl(baseURL)

  return fetchSheetsJsonp<UpdateIncidentResponse>(baseURL, {
    action: 'update',
    payload: JSON.stringify(payload),
  }).then((response) => {
    if (!response.data?.incidentId) {
      throw new Error('Ongeldig antwoord van Sheets API')
    }
    return response
  })
}
