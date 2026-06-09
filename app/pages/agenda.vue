<script setup lang="ts">
// Legacy route: the agenda now lives at /meeting/[date] directly. Redirect old
// /agenda?date=YYYY-MM-DD links (bookmarks, printed QRs) there; anything
// malformed falls back to the meetings list.
definePageMeta({
  middleware: [(to) => {
    const date = String(to.query.date ?? '')
    const localePath = useLocalePath()
    return navigateTo(
      localePath(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `/meeting/${date}` : '/meetings'),
      { redirectCode: 302, replace: true },
    )
  }],
})
</script>

<template>
  <div />
</template>
