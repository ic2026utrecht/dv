import type { Incident, IncidentUpdate } from '~/types/models'
import { parseSitrepEditIncidentFromQuery } from '~/utils/sitrepFilters'

export function useSitrepEditIncident() {
  const route = useRoute()
  const router = useRouter()
  const { incidents, updateIncident } = useSitrep()

  const saving = ref(false)
  const saveError = useState<string | null>('sitrep-edit-save-error', () => null)

  const editIncidentId = computed(() => parseSitrepEditIncidentFromQuery(route.query))

  const selectedIncident = computed(() => {
    const id = editIncidentId.value
    if (!id) {
      return null
    }
    return incidents.value.find(incident => incident.incidentId === id) ?? null
  })

  const editDialogOpen = computed({
    get: () => Boolean(editIncidentId.value),
    set: (open: boolean) => {
      if (!open) {
        setEditIncidentId(null)
        saveError.value = null
      }
    },
  })

  function setEditIncidentId(id: string | null) {
    const query = { ...route.query }
    if (id?.trim()) {
      query.incident = id.trim()
    }
    else {
      delete query.incident
    }
    router.replace({ query })
  }

  function openEditIncident(incident: Incident) {
    saveError.value = null
    setEditIncidentId(incident.incidentId)
  }

  async function handleSave(payload: IncidentUpdate) {
    saving.value = true
    saveError.value = null

    try {
      await updateIncident(payload)
      setEditIncidentId(null)
      saveError.value = null
    }
    catch (err: unknown) {
      saveError.value = err instanceof Error ? err.message : 'Opslaan mislukt'
    }
    finally {
      saving.value = false
    }
  }

  return {
    editDialogOpen,
    selectedIncident,
    saving,
    saveError,
    openEditIncident,
    handleSave,
  }
}
