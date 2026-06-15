<script setup lang="ts">
/**
 * Block-style news body editor (issue #12) built on Editor.js — the same editor
 * used on the Club Avancé site. Client-only (`.client` suffix): Editor.js needs
 * the DOM, and the heavy tool bundle never reaches the server render.
 *
 * Stores/emits the Editor.js document as a JSON string (the `content_*`
 * columns). The image tool's `uploadByFile` posts to `/api/uploads` (#10),
 * which is gated by the same content-edit capability as this editor.
 */
import type EditorJS from '@editorjs/editorjs'
import type { OutputData } from '@editorjs/editorjs'

const props = defineProps<{
  modelValue: string
  placeholder?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const holder = ref<HTMLElement | null>(null)
let editor: EditorJS | null = null

/** Build Editor.js initial data from the stored string (JSON, plain text, or empty). */
function toInitialData(raw: string): OutputData | undefined {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed?.blocks)) return parsed
    }
    catch { /* fall through to plain-text */ }
  }
  // Legacy plain-text article — seed each line break as a paragraph.
  return { blocks: [{ type: 'paragraph', data: { text: trimmed } }] } as OutputData
}

async function emitChange() {
  if (!editor) return
  const data = await editor.save()
  emit('update:modelValue', JSON.stringify(data))
}

onMounted(async () => {
  const [
    { default: EditorJSCtor },
    { default: Header },
    { default: List },
    { default: Quote },
    { default: ImageTool },
    { default: Table },
    { default: Delimiter },
    { default: Embed },
  ] = await Promise.all([
    import('@editorjs/editorjs'),
    import('@editorjs/header'),
    import('@editorjs/list'),
    import('@editorjs/quote'),
    import('@editorjs/image'),
    import('@editorjs/table'),
    import('@editorjs/delimiter'),
    import('@editorjs/embed'),
  ])

  editor = new EditorJSCtor({
    holder: holder.value!,
    placeholder: props.placeholder,
    minHeight: 200,
    data: toInitialData(props.modelValue),
    tools: {
      header: { class: Header as never, config: { levels: [2, 3], defaultLevel: 2 } },
      list: { class: List as never, inlineToolbar: true },
      quote: { class: Quote as never, inlineToolbar: true },
      table: { class: Table as never, inlineToolbar: true },
      delimiter: Delimiter as never,
      embed: Embed as never,
      image: {
        class: ImageTool as never,
        config: {
          uploader: {
            // Adapt /api/uploads's { key, url } to Editor.js's expected shape.
            async uploadByFile(file: File) {
              const fd = new FormData()
              fd.append('file', file)
              const res = await $fetch<{ url: string }>('/api/uploads', { method: 'POST', body: fd })
              return { success: 1, file: { url: res.url } }
            },
          },
        },
      },
    },
    onChange: emitChange,
  })
})

onBeforeUnmount(() => {
  // isReady resolves once the editor instance is fully constructed.
  editor?.isReady?.then(() => editor?.destroy?.()).catch(() => {})
  editor = null
})
</script>

<template>
  <div
    ref="holder"
    class="rounded-md border bg-background px-3 py-2"
  />
</template>
