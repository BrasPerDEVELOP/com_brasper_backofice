<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { safeNoticeHtml } from './notice_html'
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const sourceMode = ref(false)
const editor = ref<HTMLDivElement | null>(null)
const commands = [
  { label: 'Negrita', command: 'bold' },
  { label: 'Cursiva', command: 'italic' },
  { label: 'Subrayado', command: 'underline' },
  { label: 'Lista', command: 'insertUnorderedList' },
  { label: 'Lista numerada', command: 'insertOrderedList' }
]
function update() {
  emit('update:modelValue', safeNoticeHtml(editor.value?.innerHTML ?? ''))
}
function format(command: string) {
  editor.value?.focus()
  document.execCommand(command)
  update()
}
function paste(event: ClipboardEvent) {
  document.execCommand('insertText', false, event.clipboardData?.getData('text/plain') ?? '')
  update()
}
async function toggleMode() {
  sourceMode.value = !sourceMode.value
  await nextTick()
  if (editor.value) editor.value.innerHTML = safeNoticeHtml(props.modelValue)
}
watch(() => props.modelValue, (value) => {
  if (editor.value && document.activeElement !== editor.value) {
    editor.value.innerHTML = safeNoticeHtml(value)
  }
})
</script>
<template>
  <div class="rounded-lg border">
    <div class="flex flex-wrap gap-2 border-b p-2">
      <button v-for="item in commands" v-show="!sourceMode" :key="item.command" type="button"
        class="rounded border px-2 py-1 text-xs" @mousedown.prevent @click="format(item.command)">{{ item.label }}</button>
      <button type="button" class="rounded border px-2 py-1 text-xs" @click="toggleMode">{{ sourceMode ? 'Editor visual' : 'Código HTML' }}</button>
    </div>
    <textarea v-if="sourceMode" aria-label="Código HTML del mensaje" :value="modelValue" maxlength="10000"
      class="min-h-40 w-full p-3 font-mono text-sm" @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)" />
    <div v-else ref="editor" contenteditable="true" role="textbox" aria-label="Mensaje" aria-multiline="true"
      class="notice-html min-h-40 p-3 text-sm outline-none" @input="update" @blur="update"
      @paste.prevent="paste" />
    <p class="border-t p-2 text-xs text-gray-500">Admite párrafos, negrita, cursiva, subrayado y listas. No admite scripts, imágenes ni estilos externos.</p>
  </div>
</template>
<style>
.notice-html ul { list-style: disc; padding-left: 1.5rem; }
.notice-html ol { list-style: decimal; padding-left: 1.5rem; }
.notice-html p { margin-bottom: .5rem; }
.notice-html h2, .notice-html h3 { font-weight: 700; }
</style>
