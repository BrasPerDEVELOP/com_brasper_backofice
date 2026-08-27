<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { ChevronDown, Filter, RotateCcw } from '@lucide/vue'
import {
  GRANULARITY_LABELS,
  METRICS_CORRIDORS,
  type MetricsAgentBreakdown,
  type MetricsFilters,
  type MetricsTagBreakdown
} from '../../domain/models'

const props = defineProps<{
  modelValue: MetricsFilters
  agents: MetricsAgentBreakdown[]
  tags: MetricsTagBreakdown[]
  loading: boolean
}>()

const emit = defineEmits<{
  apply: [filters: MetricsFilters]
  reset: []
}>()

const local = reactive<MetricsFilters>({
  ...props.modelValue,
  tagIds: [...props.modelValue.tagIds]
})
watch(
  () => props.modelValue,
  (value) => Object.assign(local, value, { tagIds: [...value.tagIds] }),
  { deep: true }
)

const invalidRange = computed(() =>
  Boolean(local.dateFrom && local.dateTo && local.dateFrom > local.dateTo)
)

function apply() {
  if (invalidRange.value) return
  emit('apply', { ...local, tagIds: [...local.tagIds] })
}
</script>

<template>
  <section class="filters" aria-label="Filtros de métricas">
    <div class="filters__primary">
      <div class="filters__field filters__corridors">
        <span class="filters__label">Corredor</span>
        <div class="filters__segments" role="radiogroup" aria-label="Corredor de cambio">
          <button
            v-for="corridor in METRICS_CORRIDORS"
            :key="corridor.value"
            type="button"
            role="radio"
            :aria-checked="local.corridor === corridor.value"
            :class="{ active: local.corridor === corridor.value }"
            @click="local.corridor = corridor.value"
          >
            {{ corridor.label }}
          </button>
        </div>
      </div>

      <label class="filters__field">
        <span class="filters__label">Desde</span>
        <input v-model="local.dateFrom" type="date" />
      </label>
      <label class="filters__field">
        <span class="filters__label">Hasta</span>
        <input v-model="local.dateTo" type="date" />
      </label>
      <label class="filters__field">
        <span class="filters__label">Agrupar por</span>
        <select v-model="local.granularity">
          <option v-for="(label, key) in GRANULARITY_LABELS" :key="key" :value="key">
            {{ label }}
          </option>
        </select>
      </label>
    </div>

    <p v-if="invalidRange" class="filters__validation" role="alert">
      La fecha inicial no puede ser posterior a la fecha final.
    </p>

    <details class="filters__advanced">
      <summary>
        <span><Filter :size="16" aria-hidden="true" /> Filtros avanzados</span>
        <span class="filters__count">
          {{
            Number(Boolean(local.status)) + Number(Boolean(local.agentId)) + local.tagIds.length
          }}
          activos
        </span>
        <ChevronDown :size="16" class="filters__chevron" aria-hidden="true" />
      </summary>
      <div class="filters__advanced-content">
        <label class="filters__field">
          <span class="filters__label">Estado</span>
          <select v-model="local.status">
            <option :value="null">Todos los estados</option>
            <option value="verification">En verificación</option>
            <option value="verified">Verificado</option>
            <option value="completed">Finalizada</option>
            <option value="failed">Fallida</option>
          </select>
        </label>
        <label class="filters__field">
          <span class="filters__label">Asesor</span>
          <select v-model="local.agentId">
            <option :value="null">Todos los asesores</option>
            <option
              v-for="agent in agents"
              :key="agent.agentId ?? 'unassigned'"
              :value="agent.agentId"
            >
              {{ agent.agentName }}
            </option>
          </select>
        </label>
        <fieldset class="filters__tags">
          <legend class="filters__label">Etiquetas (cualquiera de las seleccionadas)</legend>
          <div v-if="tags.length" class="filters__tag-list">
            <label v-for="tag in tags" :key="tag.tagId">
              <input v-model="local.tagIds" type="checkbox" :value="tag.tagId" />
              <span>{{ tag.label }}</span>
            </label>
          </div>
          <span v-else class="filters__muted">No hay etiquetas en los datos actuales.</span>
        </fieldset>
      </div>
    </details>

    <footer class="filters__actions">
      <button type="button" class="filters__reset" :disabled="loading" @click="emit('reset')">
        <RotateCcw :size="16" aria-hidden="true" /> Limpiar
      </button>
      <button
        type="button"
        class="filters__apply"
        :disabled="loading || invalidRange"
        @click="apply"
      >
        {{ loading ? 'Actualizando…' : 'Aplicar filtros' }}
      </button>
    </footer>
  </section>
</template>

<style scoped>
.filters {
  padding: 16px;
  border: 1px solid #dfe6f0;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 24px rgb(15 23 42 / 5%);
}
.filters__primary {
  display: grid;
  grid-template-columns: minmax(360px, 1fr) repeat(3, minmax(135px, auto));
  gap: 12px;
  align-items: end;
}
.filters__field {
  display: grid;
  min-width: 0;
  gap: 6px;
}
.filters__label {
  color: #52627a;
  font-size: 0.73rem;
  font-weight: 700;
  letter-spacing: 0.025em;
}
.filters input[type='date'],
.filters select {
  width: 100%;
  height: 40px;
  padding: 0 10px;
  border: 1px solid #cfd8e6;
  border-radius: 9px;
  color: #17213a;
  background: #fff;
  font: inherit;
  font-size: 0.82rem;
}
.filters input:focus-visible,
.filters select:focus-visible {
  border-color: #3346a8;
  outline: 3px solid rgb(51 70 168 / 11%);
}
.filters__segments {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  padding: 3px;
  border: 1px solid #dbe3ef;
  border-radius: 10px;
  background: #f5f7fb;
}
.filters__segments button {
  min-height: 34px;
  padding: 5px 8px;
  border: 0;
  border-radius: 7px;
  color: #52627a;
  background: transparent;
  font-size: 0.75rem;
  font-weight: 650;
  cursor: pointer;
  white-space: nowrap;
}
.filters__segments button:hover {
  color: #3346a8;
}
.filters__segments button.active {
  color: #fff;
  background: #3346a8;
  box-shadow: 0 2px 8px rgb(51 70 168 / 24%);
}
.filters__segments button:focus-visible {
  outline: 2px solid #08a7c7;
  outline-offset: 2px;
}
.filters__validation {
  margin: 10px 0 0;
  color: #b42318;
  font-size: 0.78rem;
}
.filters__advanced {
  margin-top: 14px;
  border-top: 1px solid #edf1f6;
}
.filters__advanced summary {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 13px 2px 0;
  color: #334155;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  list-style: none;
}
.filters__advanced summary::-webkit-details-marker {
  display: none;
}
.filters__advanced summary > span:first-child {
  display: flex;
  align-items: center;
  gap: 7px;
}
.filters__count {
  margin-left: auto;
  color: #718096;
  font-size: 0.72rem;
  font-weight: 500;
}
.filters__chevron {
  transition: transform 0.2s;
}
.filters__advanced[open] .filters__chevron {
  transform: rotate(180deg);
}
.filters__advanced-content {
  display: grid;
  grid-template-columns: minmax(180px, 0.6fr) minmax(210px, 0.8fr) minmax(280px, 1.6fr);
  gap: 14px;
  padding-top: 14px;
}
.filters__tags {
  min-width: 0;
  padding: 0;
  border: 0;
}
.filters__tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 6px;
}
.filters__tag-list label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 9px;
  border: 1px solid #dbe3ef;
  border-radius: 999px;
  color: #475569;
  background: #f8fafc;
  font-size: 0.75rem;
  cursor: pointer;
}
.filters__tag-list label:has(input:checked) {
  border-color: #3346a8;
  color: #28398d;
  background: #eef0ff;
}
.filters__tag-list input {
  accent-color: #3346a8;
}
.filters__muted {
  display: block;
  margin-top: 7px;
  color: #8792a4;
  font-size: 0.76rem;
}
.filters__actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 14px;
}
.filters__actions button {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 14px;
  border-radius: 9px;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}
.filters__reset {
  border: 1px solid #cfd8e6;
  color: #52627a;
  background: #fff;
}
.filters__apply {
  border: 1px solid #3346a8;
  color: #fff;
  background: #3346a8;
}
.filters__actions button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
@media (max-width: 1100px) {
  .filters__primary {
    grid-template-columns: 1fr 1fr 1fr;
  }
  .filters__corridors {
    grid-column: 1 / -1;
  }
}
@media (max-width: 760px) {
  .filters__primary,
  .filters__advanced-content {
    grid-template-columns: 1fr;
  }
  .filters__segments {
    grid-template-columns: repeat(2, 1fr);
    gap: 3px;
  }
  .filters__segments button:first-child {
    grid-column: 1 / -1;
  }
}
</style>
