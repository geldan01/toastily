<script setup lang="ts">
/**
 * Render a stored news body (issue #12). New articles are Editor.js JSON,
 * rendered to HTML via `renderEditorJs`; legacy/seeded articles are plain text,
 * shown with preserved line breaks. The HTML branch is styled with the shared
 * `prose` utility (see assets/css).
 */
const props = defineProps<{ content: string }>()

const isRich = computed(() => isEditorJsDoc(props.content))
const html = computed(() => (isRich.value ? renderEditorJs(props.content) : ''))
</script>

<template>
  <!-- Deliberate: `html` is built by our own renderer from Editor.js JSON that
       only content managers (trusted) can author — same trust model as a CMS. -->
  <!-- eslint-disable vue/no-v-html -->
  <div
    v-if="isRich"
    class="prose-news"
    v-html="html"
  />
  <!-- eslint-enable vue/no-v-html -->
  <div
    v-else
    class="whitespace-pre-line text-lg leading-relaxed text-foreground/90"
  >
    {{ content }}
  </div>
</template>

<style scoped>
/* Editor.js block styling — scoped, deep selectors reach the v-html subtree. */
.prose-news {
  --tw-prose-gap: 1.25rem;
  font-size: 1.125rem;
  line-height: 1.75;
  color: hsl(var(--foreground) / 0.9);
}
.prose-news :deep(h2) {
  margin-top: 2rem;
  margin-bottom: 0.75rem;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.prose-news :deep(h3) {
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  font-size: 1.25rem;
  font-weight: 600;
}
.prose-news :deep(p) {
  margin-bottom: 1.25rem;
}
.prose-news :deep(a) {
  color: hsl(var(--primary));
  text-decoration: underline;
}
.prose-news :deep(ul),
.prose-news :deep(ol) {
  margin-bottom: 1.25rem;
  padding-left: 1.5rem;
}
.prose-news :deep(ul) {
  list-style: disc;
}
.prose-news :deep(ol) {
  list-style: decimal;
}
.prose-news :deep(li) {
  margin-bottom: 0.375rem;
}
.prose-news :deep(blockquote) {
  margin: 1.5rem 0;
  border-left: 3px solid hsl(var(--primary));
  padding-left: 1rem;
  font-style: italic;
  color: hsl(var(--muted-foreground));
}
.prose-news :deep(blockquote cite) {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.875rem;
  font-style: normal;
}
.prose-news :deep(figure) {
  margin: 1.5rem 0;
}
.prose-news :deep(figure img) {
  width: 100%;
  border-radius: 0.5rem;
}
.prose-news :deep(figure.embed) {
  position: relative;
  aspect-ratio: 16 / 9;
}
.prose-news :deep(figure.embed iframe) {
  width: 100%;
  height: 100%;
  border-radius: 0.5rem;
}
.prose-news :deep(figcaption) {
  margin-top: 0.5rem;
  text-align: center;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
}
.prose-news :deep(table) {
  width: 100%;
  margin: 1.5rem 0;
  border-collapse: collapse;
}
.prose-news :deep(th),
.prose-news :deep(td) {
  border: 1px solid hsl(var(--border));
  padding: 0.5rem 0.75rem;
  text-align: left;
}
.prose-news :deep(th) {
  background: hsl(var(--muted));
  font-weight: 600;
}
.prose-news :deep(hr) {
  margin: 2rem auto;
  width: 4rem;
  border: none;
  border-top: 2px solid hsl(var(--border));
}
</style>
