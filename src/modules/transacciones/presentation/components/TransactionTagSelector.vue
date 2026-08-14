<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { TransactionTag } from '../../domain/models'
import { tagColorStyle } from '../../domain/models'

const props = defineProps<{
  tags: TransactionTag[]
  error?: string | null
}>()

const selectedTagIds = defineModel<string[]>({ required: true })

const availableTags = computed(() => {
  const selected = new Set(selectedTagIds.value)
  return props.tags.filter((tag) => tag.active || selected.has(tag.id))
})

function toggleTag(id: string) {
  selectedTagIds.value = selectedTagIds.value.includes(id)
    ? selectedTagIds.value.filter((tagId) => tagId !== id)
    : [...selectedTagIds.value, id]
}

function tagChipStyle(color: string | undefined) {
  const style = tagColorStyle(color)
  return {
    background: style.bg,
    color: style.fg,
    borderColor: style.bd
  }
}
</script>

<template>
  <div class="border-t border-dashed border-[#d8e5fb] pt-5">
    <label class="block text-sm font-medium text-[#374151]"> Etiquetas </label>
    <p class="mt-0.5 text-xs text-[#6b7280]">
      Se marcan aquí, junto al cliente. El catálogo se administra en Configuración &gt; Etiquetas.
    </p>
    <p
      v-if="error"
      class="mt-2.5 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs text-[#b91c1c]"
    >
      No se pudo cargar el catálogo de etiquetas: {{ error }}
    </p>
    <p
      v-else-if="!availableTags.length"
      class="mt-2.5 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2 text-xs text-[#6b7280]"
    >
      Todavía no hay etiquetas activas.
      <RouterLink to="/app/etiquetas" class="font-medium text-brasper-indigoStrong underline">
        Crear la primera en Configuración &gt; Etiquetas
      </RouterLink>
    </p>
    <div v-else class="mt-2.5 flex flex-wrap gap-2">
      <button
        v-for="tag in availableTags"
        :key="tag.id"
        type="button"
        class="rounded-full border px-3 py-1 text-[11px] font-semibold transition"
        :class="
          selectedTagIds.includes(tag.id)
            ? ''
            : 'border-[#e5e7eb] bg-white text-[#6b7280] hover:border-[#c7d2fe]'
        "
        :style="selectedTagIds.includes(tag.id) ? tagChipStyle(tag.color) : undefined"
        :aria-pressed="selectedTagIds.includes(tag.id)"
        @click="toggleTag(tag.id)"
      >
        {{ tag.label }}<span v-if="tag.counts_as_new_client"> ★</span>
      </button>
    </div>
  </div>
</template>
