import {
  formatReporter,
  loadReporterContact,
  saveReporterContact,
} from '~/utils/reporterContactStorage'

export const useReporterContact = () => {
  const reporterName = ref('')
  const reporterPhone = ref('')

  onMounted(() => {
    const saved = loadReporterContact()
    reporterName.value = saved.name
    reporterPhone.value = saved.phone
  })

  function persistReporterContact() {
    saveReporterContact({
      name: reporterName.value,
      phone: reporterPhone.value,
    })
  }

  const reporterFormatted = computed(() =>
    formatReporter(reporterName.value, reporterPhone.value),
  )

  const hasReporterContact = computed(() =>
    Boolean(reporterName.value.trim() && reporterPhone.value.trim()),
  )

  return {
    reporterName,
    reporterPhone,
    reporterFormatted,
    hasReporterContact,
    persistReporterContact,
  }
}
