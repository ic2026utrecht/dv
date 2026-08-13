export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser()
  if (!user.value) {
    return navigateTo('/login?redirect=/admin/users')
  }

  const { fetchMe, isAdmin } = useStaffAuth()
  await fetchMe()
  if (!isAdmin.value) {
    return navigateTo('/sitrep')
  }
})
