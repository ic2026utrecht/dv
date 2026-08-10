export const PRIORITY_CHART_COLORS = {
  Critical: '#991b1b',
  Hoog: '#ef4444',
  Middel: '#e69732',
  Laag: '#22c55e',
} as const

export const DEPARTMENT_CHART_COLORS = {
  Parkeer: '#2d2e7e',
  Dienstverlening: '#6366f1',
  EHBO: '#0ea5e9',
} as const

export const STATUS_CHART_COLORS = {
  Open: '#2d2e7e',
  'In behandeling': '#e69732',
  Afgesloten: '#94a3b8',
} as const

export function chartFontFamily() {
  if (import.meta.client) {
    return getComputedStyle(document.documentElement).fontFamily || 'system-ui, sans-serif'
  }
  return 'system-ui, sans-serif'
}

export function baseChartOptions(title?: string) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#475569',
          font: { family: chartFontFamily(), size: 11 },
          boxWidth: 12,
          padding: 12,
        },
      },
      title: title
        ? {
            display: true,
            text: title,
            color: '#1c1d52',
            font: { family: chartFontFamily(), size: 13, weight: '600' as const },
            padding: { bottom: 8 },
          }
        : undefined,
      tooltip: {
        backgroundColor: 'rgba(28, 29, 82, 0.95)',
        titleFont: { family: chartFontFamily(), size: 12 },
        bodyFont: { family: chartFontFamily(), size: 11 },
        padding: 10,
        cornerRadius: 8,
      },
    },
  }
}

export function doughnutChartOptions(title?: string) {
  return {
    ...baseChartOptions(title),
    cutout: '62%',
    plugins: {
      ...baseChartOptions(title).plugins,
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#475569',
          font: { family: chartFontFamily(), size: 11 },
          boxWidth: 12,
          padding: 10,
        },
      },
    },
  }
}

export function barChartOptions(title?: string, stacked = false) {
  return {
    ...baseChartOptions(title),
    scales: {
      x: {
        stacked,
        ticks: { color: '#64748b', font: { size: 10 } },
        grid: { color: 'rgba(135, 161, 198, 0.15)' },
      },
      y: {
        stacked,
        beginAtZero: true,
        ticks: {
          color: '#64748b',
          font: { size: 10 },
          precision: 0,
        },
        grid: { color: 'rgba(135, 161, 198, 0.2)' },
      },
    },
  }
}

/** Side-by-side grouped bars (e.g. trend charts with multiple series per interval). */
export function groupedBarChartOptions(title?: string) {
  return {
    ...barChartOptions(title, false),
    datasets: {
      bar: {
        categoryPercentage: 0.72,
        barPercentage: 0.9,
      },
    },
  }
}

export function lineChartOptions(title?: string) {
  return {
    ...baseChartOptions(title),
    scales: {
      x: {
        ticks: {
          color: '#64748b',
          font: { size: 10 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
        },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#64748b',
          font: { size: 10 },
          precision: 0,
        },
        grid: { color: 'rgba(135, 161, 198, 0.2)' },
      },
    },
    elements: {
      line: { tension: 0.35, borderWidth: 2 },
      point: { radius: 3, hoverRadius: 5 },
    },
  }
}

export function polarChartOptions(title?: string) {
  return {
    ...baseChartOptions(title),
    scales: {
      r: {
        beginAtZero: true,
        ticks: {
          display: false,
          precision: 0,
        },
        grid: { color: 'rgba(135, 161, 198, 0.25)' },
        angleLines: { color: 'rgba(135, 161, 198, 0.2)' },
      },
    },
  }
}

export function horizontalBarChartOptions(title?: string) {
  return {
    ...baseChartOptions(title),
    indexAxis: 'y' as const,
    scales: {
      x: {
        beginAtZero: true,
        ticks: { color: '#64748b', font: { size: 10 }, precision: 0 },
        grid: { color: 'rgba(135, 161, 198, 0.2)' },
      },
      y: {
        ticks: { color: '#475569', font: { size: 10 } },
        grid: { display: false },
      },
    },
  }
}
