// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  // shadcn-vue components are vendored — don't lint them.
  ignores: ['app/components/ui/**'],
  rules: {
    'vue/multi-word-component-names': 'off',
  },
})
