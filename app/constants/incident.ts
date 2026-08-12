export const DEPARTMENTS = ['Parkeer', 'Dienstverlening', 'EHBO'] as const

export const PRIORITIES = ['Laag', 'Middel', 'Hoog', 'Critical'] as const

export const PERSONS_COUNT_OPTIONS = Array.from({ length: 10 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}))
