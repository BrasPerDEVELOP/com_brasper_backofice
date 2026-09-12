<script setup lang="ts">
import { computed, ref, shallowRef, onMounted } from 'vue'
import { notificationsApi } from '../infrastructure/notifications_api_adapter'
import { mentionQuery, activeMentionIds } from '../domain/mentions'
import type { StaffMember } from '../domain/notification'
const props = defineProps<{ modelValue: string; mentionedUserIds: string[] }>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:mentionedUserIds': [ids: string[]]
}>()
const staff = shallowRef<StaffMember[]>([])
const selected = computed(() =>
  staff.value.filter((person) => props.mentionedUserIds.includes(person.id))
)
const caret = shallowRef(0)
const input = ref<HTMLTextAreaElement | null>(null)
const error = shallowRef('')
const active = shallowRef(0)
const query = computed(() => mentionQuery(props.modelValue, caret.value))
const suggestions = computed(() =>
  query.value
    ? staff.value.filter((p) => p.name.toLowerCase().includes(query.value!.query)).slice(0, 8)
    : []
)
onMounted(async () => {
  try {
    staff.value = await notificationsApi.staff()
  } catch {
    error.value = 'No se pudieron cargar las menciones. Puedes guardar el texto.'
  }
})
function update(event: Event) {
  const target = event.target as HTMLTextAreaElement
  caret.value = target.selectionStart
  active.value = 0
  emit('update:modelValue', target.value)
  emit('update:mentionedUserIds', activeMentionIds(target.value, selected.value))
}
function choose(person: StaffMember) {
  if (!query.value) return
  const prefix = props.modelValue.slice(0, query.value.start) + `@${person.name} `
  const text = prefix + props.modelValue.slice(caret.value)
  emit('update:modelValue', text)
  emit('update:mentionedUserIds', activeMentionIds(text, [...selected.value, person]))
  caret.value = 0
  input.value?.focus()
}
function key(event: KeyboardEvent) {
  if (!suggestions.value.length) return
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    active.value =
      (active.value + (event.key === 'ArrowDown' ? 1 : suggestions.value.length - 1)) %
      suggestions.value.length
  } else if (event.key === 'Enter') {
    event.preventDefault()
    choose(suggestions.value[active.value]!)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    caret.value = 0
  }
}
</script>
<template>
  <div class="relative space-y-2">
    <label class="block text-sm font-medium"
      >Observaciones
      <textarea
        ref="input"
        :value="modelValue"
        maxlength="10000"
        rows="3"
        class="mt-1 w-full rounded-lg border p-3"
        placeholder="Escribe @ para mencionar a alguien del equipo"
        @input="update"
        @click="caret = input?.selectionStart ?? 0"
        @keydown="key"
      />
    </label>
    <ul
      v-if="suggestions.length"
      aria-label="Sugerencias de menciones"
      class="absolute z-30 max-h-56 w-full overflow-auto rounded border bg-white shadow-lg"
    >
      <li v-for="(person, index) in suggestions" :key="person.id">
        <button
          type="button"
          class="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50"
          :class="{ 'bg-indigo-50': index === active }"
          @click="choose(person)"
        >
          {{ person.name }} — {{ person.role }}
        </button>
      </li>
    </ul>
    <p v-if="error" class="text-xs text-amber-700">{{ error }}</p>
  </div>
</template>
