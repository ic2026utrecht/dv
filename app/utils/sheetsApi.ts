import type { ConfigResponse, SubmitIncidentResponse } from '~/types/api'
import type { IncidentSubmission } from '~/types/models'

declare global {
  interface Window {
    [key: string]: ((payload: ConfigResponse) => void) | undefined
  }
}

export function assertSheetsApiUrl(url: string): void {
  if (!url || url.includes('YOUR_DEPLOYMENT_ID')) {
    throw new Error(
      'NUXT_PUBLIC_SHEETS_API_URL is not set. Copy .env.example to .env and paste your /exec URL.',
    )
  }
}

/** JSONP — required because Apps Script does not send CORS headers. */
export function fetchSheetsConfig(baseURL: string): Promise<ConfigResponse> {
  assertSheetsApiUrl(baseURL)

  return new Promise((resolve, reject) => {
    const callbackName = `icConfig_${Date.now()}`

    const cleanup = () => {
      delete window[callbackName]
      script.remove()
    }

    window[callbackName] = (payload: ConfigResponse) => {
      cleanup()
      if ('error' in payload && payload.error) {
        reject(new Error(String(payload.error)))
        return
      }
      resolve(payload)
    }

    const script = document.createElement('script')
    const separator = baseURL.includes('?') ? '&' : '?'
    script.src = `${baseURL}${separator}action=config&callback=${callbackName}`
    script.async = true
    script.onerror = () => {
      cleanup()
      reject(new Error('Kon configuratie niet laden (JSONP). Controleer Apps Script deploy.'))
    }

    document.head.appendChild(script)

    window.setTimeout(() => {
      if (window[callbackName]) {
        cleanup()
        reject(new Error('Timeout bij laden configuratie'))
      }
    }, 15000)
  })
}

/** POST via text/plain body (Apps Script workaround). */
export async function postSheetsIncident(
  baseURL: string,
  payload: IncidentSubmission,
): Promise<SubmitIncidentResponse> {
  assertSheetsApiUrl(baseURL)

  const response = await fetch(baseURL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  })

  const text = await response.text()

  try {
    return JSON.parse(text) as SubmitIncidentResponse
  }
  catch {
    throw new Error('Ongeldig antwoord van Sheets API')
  }
}
