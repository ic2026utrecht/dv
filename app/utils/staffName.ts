import type { Staff } from '~/types/models'

export function formatStaffName(staff: Pick<Staff, 'firstName' | 'lastName'> | null | undefined): string {
  if (!staff) return ''
  return `${staff.firstName} ${staff.lastName}`.trim()
}
