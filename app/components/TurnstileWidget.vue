<script setup lang="ts">
/**
 * Cloudflare Turnstile CAPTCHA widget (issue #26). Renders the bot-protection
 * challenge and exposes the resulting token via v-model. When no site key is
 * configured (local dev / tests) it renders nothing and the token stays empty —
 * the server gracefully bypasses verification in that case too, so the form
 * still works end-to-end.
 */
const props = defineProps<{ action?: string }>()
// The Turnstile response token, surfaced to the parent form via v-model.
const token = defineModel<string>({ default: '' })

const { locale } = useI18n()
const config = useRuntimeConfig()
const siteKey = config.public.turnstileSiteKey as string

const container = ref<HTMLElement | null>(null)
let widgetId: string | null = null

/** Clear the token and reset the widget so a new challenge can be solved. */
function reset() {
  token.value = ''
  if (widgetId && window.turnstile) window.turnstile.reset(widgetId)
}
defineExpose({ reset })

function render() {
  if (!siteKey || widgetId || !container.value || !window.turnstile) return
  widgetId = window.turnstile.render(container.value, {
    'sitekey': siteKey,
    // Turnstile localises itself; feed it the active UI locale ('en' | 'fr').
    'language': locale.value,
    'action': props.action,
    'callback': (t: string) => { token.value = t },
    'expired-callback': () => { token.value = '' },
    'error-callback': () => { token.value = '' },
  })
}

onMounted(() => {
  if (!siteKey) return
  useHead({
    script: [{
      src: 'https://challenges.cloudflare.com/turnstile/v0/api.js',
      async: true,
      defer: true,
    }],
  })
  // The API script is async; poll briefly until the global is ready, then render.
  const tryRender = () => {
    if (window.turnstile) render()
    else window.setTimeout(tryRender, 150)
  }
  tryRender()
})

onBeforeUnmount(() => {
  if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
})
</script>

<template>
  <div
    v-if="siteKey"
    ref="container"
  />
</template>
