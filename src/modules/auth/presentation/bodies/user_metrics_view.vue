<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  fetchUserMetrics,
  type UserMetrics
} from '../../infrastructure/adapters/user_metrics_api_adapter'
import { USER_ROLES, USER_ROLE_LABELS } from '../../domain/models'

const role = ref('')
const metrics = ref<UserMetrics | null>(null)
const loading = ref(false)
const error = ref('')
let requestId = 0
const number = (value: number) => value.toLocaleString('es-PE')
const coverage = computed(() =>
  metrics.value?.brazil
    ? Math.round((metrics.value.brazil_located * 100) / metrics.value.brazil)
    : 0
)
const maxArea = computed(() =>
  Math.max(1, ...(metrics.value?.areas.map((area) => area.count) ?? []))
)
const maxCountry = computed(() =>
  Math.max(1, ...(metrics.value?.countries.map((country) => country.count) ?? []))
)

async function load() {
  const current = ++requestId
  loading.value = true
  error.value = ''
  metrics.value = null
  try {
    const data = await fetchUserMetrics(role.value)
    if (current === requestId) metrics.value = data
  } catch (e) {
    if (current === requestId)
      error.value = e instanceof Error ? e.message : 'No se pudieron cargar las métricas'
  } finally {
    if (current === requestId) loading.value = false
  }
}
watch(role, load, { immediate: true })
onBeforeUnmount(() => {
  requestId += 1
})
</script>

<template>
  <div class="space-y-5" :aria-busy="loading">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-medium text-[#1f2937]">Métricas de usuarios</h1>
        <p class="mt-1 text-sm text-[#6b7280]">
          Distribución del directorio y zonas telefónicas de Brasil por código local (DDD).
        </p>
      </div>
      <div class="flex items-end gap-3">
        <label class="flex flex-col gap-1 text-xs text-[#6b7280]"
          >Rol
          <select
            v-model="role"
            class="h-10 rounded-lg border border-[#dbe7fb] bg-white px-3 text-sm text-[#374151]"
          >
            <option value="">Todos los roles</option>
            <option v-for="item in USER_ROLES" :key="item" :value="item">
              {{ USER_ROLE_LABELS[item] }}
            </option>
          </select>
        </label>
        <button
          type="button"
          class="h-10 rounded-lg border border-[#dbe7fb] bg-white px-4 text-sm text-brasper-indigoStrong disabled:opacity-50"
          :disabled="loading"
          @click="load"
        >
          Actualizar
        </button>
      </div>
    </header>
    <p v-if="error" role="alert" class="rounded-lg bg-red-50 p-4 text-sm text-red-700">
      {{ error }}
    </p>
    <p v-if="loading" role="status" class="py-12 text-center text-sm text-[#6b7280]">
      Cargando métricas…
    </p>
    <template v-else-if="metrics">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-xl border border-[#dbe7fb] bg-white p-5">
          <p class="text-sm text-[#6b7280]">Usuarios registrados</p>
          <p class="mt-2 text-3xl font-semibold text-[#232b4d]">{{ number(metrics.total) }}</p>
          <p class="mt-2 text-xs text-[#6b7280]">{{ number(metrics.active) }} habilitados</p>
        </article>
        <article class="rounded-xl border border-[#dbe7fb] bg-white p-5">
          <p class="text-sm text-[#6b7280]">Usuarios de Brasil</p>
          <p class="mt-2 text-3xl font-semibold text-brasper-indigoStrong">
            {{ number(metrics.brazil) }}
          </p>
          <p class="mt-2 text-xs text-[#6b7280]">País Brasil o prefijo +55 sin país registrado</p>
        </article>
        <article class="rounded-xl border border-[#dbe7fb] bg-white p-5">
          <p class="text-sm text-[#6b7280]">Con código local</p>
          <p class="mt-2 text-3xl font-semibold text-emerald-700">{{ coverage }}%</p>
          <p class="mt-2 text-xs text-[#6b7280]">
            {{ number(metrics.brazil_located) }} usuarios · {{ metrics.areas.length }} códigos DDD
          </p>
        </article>
        <article class="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p class="text-sm text-amber-800">Sin código local válido</p>
          <p class="mt-2 text-3xl font-semibold text-amber-800">
            {{ number(metrics.brazil_missing_area) }}
          </p>
          <p class="mt-2 text-xs text-amber-800">Usuarios de Brasil pendientes de completar</p>
        </article>
      </div>
      <div class="grid items-start gap-5 xl:grid-cols-[3fr_2fr]">
        <section class="rounded-xl border border-[#dbe7fb] bg-white p-5">
          <h2 class="text-lg font-semibold text-[#232b4d]">Brasil por código local</h2>
          <p class="mt-1 text-xs text-[#6b7280]">
            Usuarios por DDD. El nombre corresponde a la zona registrada.
          </p>
          <p v-if="!metrics.areas.length" class="py-10 text-center text-sm text-[#6b7280]">
            No hay códigos locales registrados para este filtro.
          </p>
          <ol
            v-else
            class="mt-5 max-h-[480px] space-y-4 overflow-y-auto pr-2"
            aria-label="Distribución de usuarios por DDD"
          >
            <li v-for="area in metrics.areas" :key="area.code">
              <div class="mb-1 flex justify-between gap-3 text-sm">
                <span class="min-w-0 text-[#374151]">{{ area.code }} · {{ area.name }}</span
                ><strong class="shrink-0 text-[#232b4d]">{{ number(area.count) }}</strong>
              </div>
              <div class="h-3 overflow-hidden rounded-full bg-[#eef2ff]" aria-hidden="true">
                <div
                  class="h-full rounded-full bg-brasper-indigoStrong"
                  :style="{ width: `${(area.count * 100) / maxArea}%` }"
                />
              </div>
            </li>
          </ol>
        </section>
        <section class="rounded-xl border border-[#dbe7fb] bg-white p-5">
          <h2 class="text-lg font-semibold text-[#232b4d]">Usuarios por país</h2>
          <p v-if="!metrics.total" class="py-10 text-center text-sm text-[#6b7280]">
            No hay usuarios para este filtro.
          </p>
          <ol
            v-else
            class="mt-5 max-h-[480px] space-y-4 overflow-y-auto pr-2"
            aria-label="Distribución de usuarios por país"
          >
            <li v-for="country in metrics.countries" :key="country.name">
              <div class="mb-1 flex justify-between gap-3 text-sm">
                <span class="capitalize text-[#374151]">{{
                  country.name === 'sin-pais' ? 'Sin país registrado' : country.name
                }}</span
                ><strong>{{ number(country.count) }}</strong>
              </div>
              <div class="h-3 overflow-hidden rounded-full bg-sky-50" aria-hidden="true">
                <div
                  class="h-full rounded-full bg-sky-600"
                  :style="{ width: `${(country.count * 100) / maxCountry}%` }"
                />
              </div>
            </li>
          </ol>
        </section>
      </div>
      <section class="overflow-hidden rounded-xl border border-[#dbe7fb] bg-white">
        <h2 class="px-5 py-4 text-lg font-semibold text-[#232b4d]">Detalle de zonas de Brasil</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-[#eef5ff] text-[#232b4d]">
              <tr>
                <th class="px-5 py-3">Código local</th>
                <th class="px-5 py-3">Nombre de zona</th>
                <th class="px-5 py-3 text-right">Usuarios</th>
                <th class="px-5 py-3 text-right">% de Brasil</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#e5e7eb]">
              <tr v-for="area in metrics.areas" :key="area.code">
                <td class="px-5 py-3 font-semibold">{{ area.code }}</td>
                <td class="px-5 py-3">{{ area.name }}</td>
                <td class="px-5 py-3 text-right tabular-nums">{{ number(area.count) }}</td>
                <td class="px-5 py-3 text-right tabular-nums">
                  {{ area.percentage.toLocaleString('es-PE') }}%
                </td>
              </tr>
              <tr v-if="metrics.brazil_missing_area">
                <td class="px-5 py-3" colspan="2">Sin código local válido</td>
                <td class="px-5 py-3 text-right">{{ number(metrics.brazil_missing_area) }}</td>
                <td class="px-5 py-3 text-right">
                  {{ ((metrics.brazil_missing_area * 100) / metrics.brazil).toFixed(2) }}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <p class="text-xs text-[#6b7280]">
        Los conteos excluyen usuarios eliminados. La zona telefónica no acredita domicilio ni
        nacionalidad. Un DDD puede abarcar varias ciudades; no se deducen ubicaciones a partir de
        los últimos dígitos del teléfono.
      </p>
    </template>
  </div>
</template>
