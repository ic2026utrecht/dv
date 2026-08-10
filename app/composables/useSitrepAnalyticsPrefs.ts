import type { SitrepAnalyticsBucket } from '~/utils/sitrepAnalytics'

export type SitrepAnalyticsChartId =
  | 'open-priority'
  | 'open-department'
  | 'open-status'
  | 'open-types'
  | 'priority-polar'
  | 'timeline-volume'
  | 'timeline-priority'
  | 'timeline-department'

export interface SitrepAnalyticsChartMeta {
  id: SitrepAnalyticsChartId
  title: string
  description: string
  group: 'live' | 'trend'
}

export const SITREP_ANALYTICS_CHARTS: SitrepAnalyticsChartMeta[] = [
  {
    id: 'open-priority',
    title: 'Open per prioriteit',
    description: 'Huidige open meldingen verdeeld over urgentieniveaus',
    group: 'live',
  },
  {
    id: 'open-department',
    title: 'Open per afdeling',
    description: 'Welke teams hebben nu de meeste open meldingen',
    group: 'live',
  },
  {
    id: 'open-status',
    title: 'Open per status',
    description: 'Open versus in behandeling op dit moment',
    group: 'live',
  },
  {
    id: 'open-types',
    title: 'Top incidenttypes',
    description: 'Meest voorkomende open incidenttypes',
    group: 'live',
  },
  {
    id: 'priority-polar',
    title: 'Prioriteitsmix',
    description: 'Polar view van de huidige prioriteitsverdeling',
    group: 'live',
  },
  {
    id: 'timeline-volume',
    title: 'Meldingen per interval',
    description: 'Aantal nieuwe meldingen per gekozen tijdsinterval',
    group: 'trend',
  },
  {
    id: 'timeline-priority',
    title: 'Trend per prioriteit',
    description: 'Nieuwe meldingen per interval, uitgesplitst naar prioriteit',
    group: 'trend',
  },
  {
    id: 'timeline-department',
    title: 'Trend per afdeling',
    description: 'Nieuwe meldingen per interval, uitgesplitst naar afdeling',
    group: 'trend',
  },
]

export interface SitrepAnalyticsPrefs {
  bucket: SitrepAnalyticsBucket
  charts: Record<SitrepAnalyticsChartId, boolean>
}

const STORAGE_KEY = 'ic2026-sitrep-analytics-prefs'

function defaultChartVisibility(): Record<SitrepAnalyticsChartId, boolean> {
  return SITREP_ANALYTICS_CHARTS.reduce((acc, chart) => {
    acc[chart.id] = true
    return acc
  }, {} as Record<SitrepAnalyticsChartId, boolean>)
}

export function defaultSitrepAnalyticsPrefs(): SitrepAnalyticsPrefs {
  return {
    bucket: '1h',
    charts: defaultChartVisibility(),
  }
}

function isChartId(value: string): value is SitrepAnalyticsChartId {
  return SITREP_ANALYTICS_CHARTS.some(chart => chart.id === value)
}

function isBucket(value: string): value is SitrepAnalyticsBucket {
  return value === '30m' || value === '1h' || value === '1d'
}

function parseStoredPrefs(raw: string | null): SitrepAnalyticsPrefs | null {
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SitrepAnalyticsPrefs>
    const defaults = defaultSitrepAnalyticsPrefs()

    const charts = { ...defaults.charts }
    if (parsed.charts && typeof parsed.charts === 'object') {
      for (const [key, value] of Object.entries(parsed.charts)) {
        if (isChartId(key) && typeof value === 'boolean') {
          charts[key] = value
        }
      }
    }

    return {
      bucket: parsed.bucket && isBucket(parsed.bucket) ? parsed.bucket : defaults.bucket,
      charts,
    }
  }
  catch {
    return null
  }
}

export function useSitrepAnalyticsPrefs() {
  const prefs = useState<SitrepAnalyticsPrefs>('sitrep-analytics-prefs', defaultSitrepAnalyticsPrefs)
  const settingsOpen = ref(false)

  onMounted(() => {
    if (!import.meta.client) {
      return
    }

    const stored = parseStoredPrefs(localStorage.getItem(STORAGE_KEY))
    if (stored) {
      prefs.value = stored
    }
  })

  watch(
    prefs,
    (value) => {
      if (!import.meta.client) {
        return
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    },
    { deep: true },
  )

  function setBucket(bucket: SitrepAnalyticsBucket) {
    prefs.value = { ...prefs.value, bucket }
  }

  function setChartVisible(chartId: SitrepAnalyticsChartId, visible: boolean) {
    prefs.value = {
      ...prefs.value,
      charts: {
        ...prefs.value.charts,
        [chartId]: visible,
      },
    }
  }

  function showAllCharts() {
    prefs.value = {
      ...prefs.value,
      charts: defaultChartVisibility(),
    }
  }

  function hideTrendCharts() {
    const charts = { ...prefs.value.charts }
    for (const chart of SITREP_ANALYTICS_CHARTS) {
      if (chart.group === 'trend') {
        charts[chart.id] = false
      }
    }
    prefs.value = { ...prefs.value, charts }
  }

  function isChartVisible(chartId: SitrepAnalyticsChartId) {
    return prefs.value.charts[chartId] ?? true
  }

  return {
    prefs,
    settingsOpen,
    setBucket,
    setChartVisible,
    showAllCharts,
    hideTrendCharts,
    isChartVisible,
  }
}
