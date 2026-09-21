<script setup lang="ts">
import type { TransactionTag } from '../../domain/models'
import { tagColorStyle } from '../../domain/models'

defineProps<{
  tags: TransactionTag[]
  error?: string | null
}>()

const selectedTagIds = defineModel<string[]>({ default: () => [] })

function isSelected(id: string): boolean {
  return selectedTagIds.value.includes(id)
}

function toggleTag(id: string) {
  selectedTagIds.value = isSelected(id)
    ? selectedTagIds.value.filter((tagId) => tagId !== id)
    : [...selectedTagIds.value, id]
}

function chipStyle(tag: TransactionTag) {
  if (!isSelected(tag.id)) return undefined
  const style = tagColorStyle(tag.color)
  return {
    background: style.bg,
    color: style.fg,
    borderColor: style.bd
  }
}
</script>

<template>
  <fieldset class="tag-filter">
    <legend class="tag-filter__label">Etiquetas (cualquiera de las seleccionadas)</legend>
    <p v-if="error" class="tag-filter__error">No se pudo cargar el catálogo: {{ error }}</p>
    <p v-else-if="!tags.length" class="tag-filter__muted">No hay etiquetas en el catálogo.</p>
    <div v-else class="tag-filter__list">
      <button
        v-for="tag in tags"
        :key="tag.id"
        type="button"
        class="tag-filter__chip"
        :class="{ 'tag-filter__chip--inactive': !tag.active }"
        :style="chipStyle(tag)"
        :aria-pressed="isSelected(tag.id)"
        @click="toggleTag(tag.id)"
      >
        {{ tag.label }}
      </button>
    </div>
  </fieldset>
</template>

<style scoped>
.tag-filter {
  min-width: 0;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
}
.tag-filter__label {
  padding: 0;
  color: #6b7280;
  font-size: 11px;
}
.tag-filter__list {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 6px;
}
.tag-filter__chip {
  border: 1px solid #dbe3ef;
  border-radius: 999px;
  background: #f8fafc;
  padding: 6px 10px;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.tag-filter__chip[aria-pressed='true'] {
  border-color: #3346a8;
}
.tag-filter__chip--inactive {
  opacity: 0.7;
}
.tag-filter__muted,
.tag-filter__error {
  margin: 6px 0 0;
  font-size: 12px;
}
.tag-filter__muted {
  color: #8792a4;
}
.tag-filter__error {
  color: #b91c1c;
}
</style>
