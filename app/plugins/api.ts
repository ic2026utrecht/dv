import IncidentsModule from '~/repository/modules/incidents'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const baseURL = config.public.sheetsApiUrl as string

  const apiFetcher = $fetch.create({
    onResponseError({ response }) {
      console.error('[Sheets API]', response.status, response._data)
    },
  })

  const modules = {
    incidents: new IncidentsModule(apiFetcher, baseURL),
  }

  return {
    provide: {
      api: modules,
    },
  }
})
