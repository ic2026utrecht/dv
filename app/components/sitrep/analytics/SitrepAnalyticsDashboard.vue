<script setup lang="ts">
import { Bar, Doughnut, Line, PolarArea } from 'vue-chartjs'
import {
  ANALYTICS_DEPARTMENT_LABELS,
  ANALYTICS_PRIORITY_LABELS,
  buildAnalyticsSnapshot,
  buildTimelineSeries,
  enrichSnapshotWithPeriod,
  getBucketLabel,
  getLookbackLabel,
  type SitrepAnalyticsBucket,
} from '~/utils/sitrepAnalytics'
import {
  DEPARTMENT_CHART_COLORS,
  PRIORITY_CHART_COLORS,
  STATUS_CHART_COLORS,
  barChartOptions,
  doughnutChartOptions,
  groupedBarChartOptions,
  horizontalBarChartOptions,
  lineChartOptions,
  polarChartOptions,
} from '~/utils/sitrepChartTheme'
import {
  SITREP_ANALYTICS_CHARTS,
  type SitrepAnalyticsChartId,
} from '~/composables/useSitrepAnalyticsPrefs'

const { incidents } = useSitrep()

const doughnutOptions = doughnutChartOptions()
const barOptions = barChartOptions()
const groupedBarOptions = groupedBarChartOptions()
const lineOptions = lineChartOptions()
const horizontalBarOptions = horizontalBarChartOptions()
const polarOptions = polarChartOptions()

const {
  prefs,
  settingsOpen,
  setBucket,
  setChartVisible,
  showAllCharts,
  hideTrendCharts,
  isChartVisible,
} = useSitrepAnalyticsPrefs()

const viewMode = ref<'live' | 'historical'>('live')
const historicalDate = ref<Date>(new Date())
const historicalHour = ref<number>(new Date().getHours())

const bucketOptions: { value: SitrepAnalyticsBucket, label: string }[] = [
  { value: '30m', label: '30 min' },
  { value: '1h', label: '1 uur' },
  { value: '1d', label: '1 dag' },
]

const hourOptions = computed(() =>
  Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: `${String(i).padStart(2, '0')}:00`,
  })),
)

const filteredIncidents = computed(() => {
  if (viewMode.value === 'live') {
    return incidents.value
  }

  const targetDate = new Date(historicalDate.value)
  targetDate.setHours(historicalHour.value, 0, 0, 0)
  const targetEnd = new Date(targetDate)
  targetEnd.setHours(historicalHour.value + 1, 0, 0, 0)

  return incidents.value.filter((incident) => {
    const incidentTime = new Date(incident.timestamp)
    return incidentTime >= targetDate && incidentTime < targetEnd
  })
})

const historicalNow = computed(() => {
  if (viewMode.value === 'live') {
    return new Date()
  }
  const date = new Date(historicalDate.value)
  date.setHours(historicalHour.value + 1, 0, 0, 0)
  return date
})

const timeline = computed(() => 
  buildTimelineSeries(
    viewMode.value === 'live' ? filteredIncidents.value : incidents.value,
    prefs.value.bucket,
    historicalNow.value,
  ),
)

const snapshot = computed(() =>
  enrichSnapshotWithPeriod(buildAnalyticsSnapshot(filteredIncidents.value), timeline.value),
)

const visibleChartCount = computed(() =>
  SITREP_ANALYTICS_CHARTS.filter(chart => isChartVisible(chart.id)).length,
)

const hiddenCharts = computed(() =>
  SITREP_ANALYTICS_CHARTS.filter(chart => !isChartVisible(chart.id)),
)

const dataRevision = computed(() =>
  `${filteredIncidents.value.length}-${snapshot.value.totalOpen}-${prefs.value.bucket}-${viewMode.value}`,
)

function formatHistoricalPeriod(): string {
  if (viewMode.value === 'live') {
    return `Trend: ${getLookbackLabel(prefs.value.bucket)} · interval ${getBucketLabel(prefs.value.bucket)}`
  }

  const date = historicalDate.value.toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const hourLabel = `${String(historicalHour.value).padStart(2, '0')}:00-${String(historicalHour.value + 1).padStart(2, '0')}:00`
  return `Historisch: ${date} ${hourLabel}`
}

const priorityDoughnutData = computed(() => ({
  labels: ANALYTICS_PRIORITY_LABELS,
  datasets: [{
    data: ANALYTICS_PRIORITY_LABELS.map(priority => snapshot.value.byPriority[priority]),
    backgroundColor: ANALYTICS_PRIORITY_LABELS.map(priority => PRIORITY_CHART_COLORS[priority]),
    borderWidth: 0,
  }],
}))

const departmentBarData = computed(() => ({
  labels: ANALYTICS_DEPARTMENT_LABELS,
  datasets: [{
    label: 'Open',
    data: ANALYTICS_DEPARTMENT_LABELS.map(dept => snapshot.value.byDepartment[dept]),
    backgroundColor: ANALYTICS_DEPARTMENT_LABELS.map(dept => DEPARTMENT_CHART_COLORS[dept]),
    borderRadius: 6,
  }],
}))

const statusEntries = computed(() => Object.entries(snapshot.value.byStatus))
const statusDoughnutData = computed(() => {
  const entries = statusEntries.value
  if (entries.length === 0) {
    return {
      labels: ['Geen open meldingen'],
      datasets: [{
        data: [1],
        backgroundColor: ['#e2e8f0'],
        borderWidth: 0,
      }],
    }
  }

  return {
    labels: entries.map(([status]) => status),
    datasets: [{
      data: entries.map(([, count]) => count),
      backgroundColor: entries.map(([status]) =>
        STATUS_CHART_COLORS[status as keyof typeof STATUS_CHART_COLORS] ?? '#94a3b8',
      ),
      borderWidth: 0,
    }],
  }
})

const typesBarData = computed(() => {
  const items = snapshot.value.byType
  if (items.length === 0) {
    return {
      labels: ['Geen open meldingen'],
      datasets: [{
        label: 'Open',
        data: [0],
        backgroundColor: '#e2e8f0',
        borderRadius: 6,
      }],
    }
  }

  return {
    labels: items.map(item => item.label),
    datasets: [{
      label: 'Open',
      data: items.map(item => item.count),
      backgroundColor: '#6366f1',
      borderRadius: 6,
    }],
  }
})

const priorityPolarData = computed(() => ({
  labels: ANALYTICS_PRIORITY_LABELS,
  datasets: [{
    data: ANALYTICS_PRIORITY_LABELS.map(priority => snapshot.value.byPriority[priority]),
    backgroundColor: ANALYTICS_PRIORITY_LABELS.map(priority => `${PRIORITY_CHART_COLORS[priority]}bb`),
    borderColor: ANALYTICS_PRIORITY_LABELS.map(priority => PRIORITY_CHART_COLORS[priority]),
    borderWidth: 1,
  }],
}))

const timelineLineData = computed(() => ({
  labels: timeline.value.labels,
  datasets: [{
    label: 'Nieuwe meldingen',
    data: timeline.value.totals,
    borderColor: '#2d2e7e',
    backgroundColor: 'rgba(45, 46, 126, 0.12)',
    fill: true,
  }],
}))

const timelinePriorityData = computed(() => ({
  labels: timeline.value.labels,
  datasets: ANALYTICS_PRIORITY_LABELS.map(priority => ({
    label: priority,
    data: timeline.value.byPriority[priority],
    backgroundColor: PRIORITY_CHART_COLORS[priority],
    borderRadius: 4,
  })),
}))

const timelineDepartmentData = computed(() => ({
  labels: timeline.value.labels,
  datasets: ANALYTICS_DEPARTMENT_LABELS.map(department => ({
    label: department,
    data: timeline.value.byDepartment[department],
    backgroundColor: DEPARTMENT_CHART_COLORS[department],
    borderRadius: 4,
  })),
}))

const timelineClosedData = computed(() => ({
  labels: timeline.value.labels,
  datasets: [{
    label: 'Afgesloten meldingen',
    data: timeline.value.closedTotals,
    borderColor: '#94a3b8',
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    fill: true,
  }],
}))

function hideChart(id: SitrepAnalyticsChartId) {
  setChartVisible(id, false)
}

function chartVisible(id: SitrepAnalyticsChartId) {
  return isChartVisible(id)
}
</script>

<template>
  <div class="ic-sitrep-analytics">
    <header class="ic-sitrep-analytics__toolbar">
      <div class="ic-sitrep-analytics__toolbar-main">
        <div class="ic-sitrep-analytics__kpis">
          <div class="ic-sitrep-analytics-kpi">
            <span class="ic-sitrep-analytics-kpi__value">{{ snapshot.totalOpen }}</span>
            <span class="ic-sitrep-analytics-kpi__label">Nu open</span>
          </div>
          <div class="ic-sitrep-analytics-kpi ic-sitrep-analytics-kpi--critical">
            <span class="ic-sitrep-analytics-kpi__value">{{ snapshot.criticalOpen }}</span>
            <span class="ic-sitrep-analytics-kpi__label">Critical / Hoog</span>
          </div>
          <div class="ic-sitrep-analytics-kpi">
            <span class="ic-sitrep-analytics-kpi__value">{{ snapshot.inProgress }}</span>
            <span class="ic-sitrep-analytics-kpi__label">In behandeling</span>
          </div>
          <div class="ic-sitrep-analytics-kpi">
            <span class="ic-sitrep-analytics-kpi__value">{{ snapshot.newInPeriod }}</span>
            <span class="ic-sitrep-analytics-kpi__label">Nieuw in periode</span>
          </div>
        </div>
        <p class="ic-sitrep-analytics__period">
          {{ formatHistoricalPeriod() }}
        </p>
      </div>

      <div class="ic-sitrep-analytics__toolbar-actions">
        <SelectButton
          v-model="viewMode"
          :options="[
            { value: 'live', label: 'Live' },
            { value: 'historical', label: 'Historisch' }
          ]"
          option-label="label"
          option-value="value"
          aria-label="Weergavemodus"
        />
        
        <template v-if="viewMode === 'historical'">
          <DatePicker
            v-model="historicalDate"
            show-icon
            icon-display="input"
            date-format="dd-mm-yy"
            placeholder="Datum"
            class="ic-sitrep-analytics__date-picker"
          />
          <Select
            v-model="historicalHour"
            :options="hourOptions"
            option-label="label"
            option-value="value"
            placeholder="Uur"
            class="ic-sitrep-analytics__hour-select"
          />
        </template>
        
        <SelectButton
          v-if="viewMode === 'live'"
          :model-value="prefs.bucket"
          :options="bucketOptions"
          option-label="label"
          option-value="value"
          aria-label="Tijdsinterval"
          @update:model-value="setBucket($event)"
        />
        <button
          type="button"
          class="ic-sitrep-analytics__settings-btn"
          @click="settingsOpen = !settingsOpen"
        >
          <i class="pi pi-sliders-h" aria-hidden="true" />
          Grafieken ({{ visibleChartCount }})
        </button>
      </div>
    </header>

    <section v-if="settingsOpen" class="ic-sitrep-analytics__settings">
      <div class="ic-sitrep-analytics__settings-head">
        <h3>Grafieken beheren</h3>
        <div class="ic-sitrep-analytics__settings-actions">
          <button type="button" @click="showAllCharts">
            Alles tonen
          </button>
          <button type="button" @click="hideTrendCharts">
            Alleen live
          </button>
        </div>
      </div>
      <p class="ic-sitrep-analytics__settings-hint">
        Vink grafieken aan om ze toe te voegen, of gebruik ✕ op een kaart om te verbergen. Instelling wordt lokaal opgeslagen.
      </p>
      <div class="ic-sitrep-analytics__settings-grid">
        <label
          v-for="chart in SITREP_ANALYTICS_CHARTS"
          :key="chart.id"
          class="ic-sitrep-analytics__settings-item"
          :class="{ 'ic-sitrep-analytics__settings-item--hidden': !isChartVisible(chart.id) }"
        >
          <Checkbox
            binary
            :model-value="isChartVisible(chart.id)"
            @update:model-value="setChartVisible(chart.id, $event)"
          />
          <span>
            <strong>{{ chart.title }}</strong>
            <small>{{ chart.description }}</small>
          </span>
        </label>
      </div>
      <p v-if="hiddenCharts.length > 0" class="ic-sitrep-analytics__settings-hidden">
        {{ hiddenCharts.length }} verborgen — vink hierboven aan om toe te voegen
      </p>
    </section>

    <div v-if="visibleChartCount === 0" class="ic-sitrep-analytics__empty">
      <i class="pi pi-chart-bar" aria-hidden="true" />
      <p>Geen grafieken geselecteerd</p>
      <button type="button" @click="showAllCharts">
        Alle grafieken tonen
      </button>
    </div>

    <section v-else class="ic-sitrep-analytics__grid">
      <SitrepAnalyticsChartCard
        v-if="chartVisible('open-priority')"
        title="Open per prioriteit"
        description="Actieve meldingen op dit moment"
        removable
        @remove="hideChart('open-priority')"
      >
        <Doughnut
          :key="`priority-${dataRevision}`"
          :data="priorityDoughnutData"
          :options="doughnutOptions"
        />
      </SitrepAnalyticsChartCard>

      <SitrepAnalyticsChartCard
        v-if="chartVisible('open-department')"
        title="Open per afdeling"
        description="Workload per team"
        removable
        @remove="hideChart('open-department')"
      >
        <Bar
          :key="`department-${dataRevision}`"
          :data="departmentBarData"
          :options="barOptions"
        />
      </SitrepAnalyticsChartCard>

      <SitrepAnalyticsChartCard
        v-if="chartVisible('open-status')"
        title="Open per status"
        description="Open vs in behandeling"
        removable
        @remove="hideChart('open-status')"
      >
        <Doughnut
          :key="`status-${dataRevision}`"
          :data="statusDoughnutData"
          :options="doughnutOptions"
        />
      </SitrepAnalyticsChartCard>

      <SitrepAnalyticsChartCard
        v-if="chartVisible('open-types')"
        title="Top incidenttypes"
        description="Meest voorkomende open types"
        removable
        @remove="hideChart('open-types')"
      >
        <Bar
          :key="`types-${dataRevision}`"
          :data="typesBarData"
          :options="horizontalBarOptions"
        />
      </SitrepAnalyticsChartCard>

      <SitrepAnalyticsChartCard
        v-if="chartVisible('priority-polar')"
        title="Prioriteitsmix"
        description="Polar overzicht van open meldingen"
        class="ic-sitrep-analytics__wide"
        removable
        @remove="hideChart('priority-polar')"
      >
        <PolarArea
          :key="`polar-${dataRevision}`"
          :data="priorityPolarData"
          :options="polarOptions"
        />
      </SitrepAnalyticsChartCard>

      <SitrepAnalyticsChartCard
        v-if="chartVisible('timeline-priority')"
        title="Trend per prioriteit"
        description="Nieuwe meldingen per interval"
        class="ic-sitrep-analytics__wide"
        removable
        @remove="hideChart('timeline-priority')"
      >
        <Bar
          :key="`timeline-priority-${dataRevision}`"
          :data="timelinePriorityData"
          :options="groupedBarOptions"
        />
      </SitrepAnalyticsChartCard>

      <SitrepAnalyticsChartCard
        v-if="chartVisible('timeline-department')"
        title="Trend per afdeling"
        description="Nieuwe meldingen per interval"
        class="ic-sitrep-analytics__wide"
        removable
        @remove="hideChart('timeline-department')"
      >
        <Bar
          :key="`timeline-department-${dataRevision}`"
          :data="timelineDepartmentData"
          :options="groupedBarOptions"
        />
      </SitrepAnalyticsChartCard>

      <SitrepAnalyticsChartCard
        v-if="chartVisible('timeline-volume')"
        title="Meldingen per interval"
        description="Volume in de gekozen periode"
        class="ic-sitrep-analytics__wide"
        removable
        @remove="hideChart('timeline-volume')"
      >
        <Line
          :key="`timeline-${dataRevision}`"
          :data="timelineLineData"
          :options="lineOptions"
        />
      </SitrepAnalyticsChartCard>

      <SitrepAnalyticsChartCard
        v-if="chartVisible('timeline-closed')"
        title="Afgesloten incidenten"
        description="Aantal afgesloten meldingen per interval"
        class="ic-sitrep-analytics__wide"
        removable
        @remove="hideChart('timeline-closed')"
      >
        <Line
          :key="`timeline-closed-${dataRevision}`"
          :data="timelineClosedData"
          :options="lineOptions"
        />
      </SitrepAnalyticsChartCard>
    </section>
  </div>
</template>

<style scoped>
.ic-sitrep-analytics {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  height: 100%;
  min-height: 0;
  padding: 0.75rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--ic-surface-muted, #f8fafc);
}

.ic-sitrep-analytics__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid rgb(135 161 198 / 0.25);
  border-radius: 0.75rem;
  background: #fff;
}

.ic-sitrep-analytics__toolbar-main {
  min-width: 0;
}

.ic-sitrep-analytics__kpis {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.ic-sitrep-analytics-kpi {
  display: flex;
  flex-direction: column;
  min-width: 4.75rem;
  padding: 0.5rem 0.625rem;
  border-radius: 0.625rem;
  background: rgb(45 46 126 / 0.06);
}

.ic-sitrep-analytics-kpi--critical {
  background: rgb(153 27 27 / 0.1);
}

.ic-sitrep-analytics-kpi__value {
  font-size: 1.125rem;
  font-weight: 800;
  line-height: 1.1;
  color: var(--ic-brand-dark);
}

.ic-sitrep-analytics-kpi--critical .ic-sitrep-analytics-kpi__value {
  color: var(--ic-critical);
}

.ic-sitrep-analytics-kpi__label {
  margin-top: 0.125rem;
  font-size: 0.625rem;
  font-weight: 600;
  color: #64748b;
}

.ic-sitrep-analytics__period {
  margin: 0.5rem 0 0;
  font-size: 0.6875rem;
  color: #64748b;
}

.ic-sitrep-analytics__toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.ic-sitrep-analytics__settings-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4375rem 0.75rem;
  border: 1px solid rgb(135 161 198 / 0.55);
  border-radius: 0.5rem;
  background: #fff;
  color: var(--ic-brand);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.ic-sitrep-analytics__settings-btn:hover {
  background: rgb(135 161 198 / 0.12);
}

.ic-sitrep-analytics__date-picker,
.ic-sitrep-analytics__hour-select {
  min-width: 9rem;
}

.ic-sitrep-analytics__settings {
  padding: 0.75rem;
  border: 1px solid rgb(135 161 198 / 0.25);
  border-radius: 0.75rem;
  background: #fff;
}

.ic-sitrep-analytics__settings-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.625rem;
}

.ic-sitrep-analytics__settings-head h3 {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--ic-brand-dark);
}

.ic-sitrep-analytics__settings-hint {
  margin: 0 0 0.625rem;
  font-size: 0.6875rem;
  color: #64748b;
  line-height: 1.4;
}

.ic-sitrep-analytics__settings-hidden {
  margin: 0.625rem 0 0;
  font-size: 0.6875rem;
  color: #64748b;
}

.ic-sitrep-analytics__settings-actions {
  display: flex;
  gap: 0.375rem;
}

.ic-sitrep-analytics__settings-actions button {
  padding: 0.25rem 0.5rem;
  border: 1px solid rgb(135 161 198 / 0.45);
  border-radius: 0.375rem;
  background: #fff;
  color: var(--ic-brand);
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
}

.ic-sitrep-analytics__settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 0.5rem;
}

.ic-sitrep-analytics__settings-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 0.5rem;
  background: rgb(248 250 252 / 0.9);
  cursor: pointer;
}

.ic-sitrep-analytics__settings-item--hidden {
  opacity: 0.72;
  background: rgb(241 245 249 / 0.9);
}

.ic-sitrep-analytics__settings-item strong {
  display: block;
  font-size: 0.75rem;
  color: var(--ic-brand-dark);
}

.ic-sitrep-analytics__settings-item small {
  display: block;
  margin-top: 0.125rem;
  font-size: 0.625rem;
  color: #64748b;
  line-height: 1.35;
}

.ic-sitrep-analytics__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 0.75rem;
}

.ic-sitrep-analytics__wide {
  grid-column: 1 / -1;
}

.ic-sitrep-analytics__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 12rem;
  padding: 2rem 1rem;
  border: 1px dashed rgb(135 161 198 / 0.45);
  border-radius: 0.75rem;
  background: #fff;
  color: #64748b;
  text-align: center;
}

.ic-sitrep-analytics__empty i {
  font-size: 1.75rem;
  color: var(--ic-brand);
}

.ic-sitrep-analytics__empty button {
  margin-top: 0.25rem;
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: 0.5rem;
  background: var(--ic-brand);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

@media (min-width: 1100px) {
  .ic-sitrep-analytics__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
