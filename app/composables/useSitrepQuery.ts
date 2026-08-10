import type { Incident } from '~/types/models'
import {
  buildSitrepQuery,
  DEFAULT_SITREP_LIST_FILTERS,
  filterAndSortIncidents,
  parseSitrepFiltersFromQuery,
  parseSitrepViewFromQuery,
  stripSitrepQueryKeys,
  type SitrepListFilters,
  type SitrepView,
} from '~/utils/sitrepFilters'

export const useSitrepQuery = () => {
  const route = useRoute()
  const router = useRouter()

  const filters = computed(() => parseSitrepFiltersFromQuery(route.query))
  const view = computed(() => parseSitrepViewFromQuery(route.query))

  function replaceSitrepQuery(nextFilters: SitrepListFilters, nextView: SitrepView = view.value) {
    const preserved = stripSitrepQueryKeys(route.query)
    router.replace({
      query: {
        ...preserved,
        ...buildSitrepQuery(nextFilters, nextView),
      },
    })
  }

  function setFilter<K extends keyof SitrepListFilters>(key: K, value: SitrepListFilters[K]) {
    replaceSitrepQuery({
      ...filters.value,
      [key]: value,
    })
  }

  function setFilters(partial: Partial<SitrepListFilters>) {
    replaceSitrepQuery({
      ...DEFAULT_SITREP_LIST_FILTERS,
      ...filters.value,
      ...partial,
    })
  }

  function setView(nextView: SitrepView) {
    replaceSitrepQuery(filters.value, nextView)
  }

  function filterIncidents(incidents: Incident[]) {
    return filterAndSortIncidents(incidents, filters.value)
  }

  return {
    filters,
    view,
    setFilter,
    setFilters,
    setView,
    filterIncidents,
  }
}
