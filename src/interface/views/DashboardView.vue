<template>
  <div class="space-y-8">
    <section class="overflow-hidden rounded-3xl border border-[#d8e5fb] bg-white p-8 shadow-lg shadow-[#007bff]/5">
      <div class="mb-6">
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#066ac9]">Comercial</p>
        <h1 class="text-2xl font-semibold text-[#232b4d]">Gestión de clientes: Base de clientes</h1>
      </div>

      <!-- Buscador y filtros -->
      <div class="mb-6 flex flex-wrap items-center gap-5">
        <div class="relative flex-1 min-w-[200px]">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar"
            class="w-full rounded-xl border border-[#cfdbef] bg-white py-3 pl-4 pr-10 text-sm text-[#333] outline-none placeholder:text-[#999] focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
          />
          <svg
            class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            :class="[
              'rounded-xl border px-5 py-3 text-sm font-medium transition',
              filterType === 'natural'
                ? 'border-[#5ED6B3] bg-gradient-to-r from-[#10b981] to-[#5ED6B3] text-white'
                : 'border-[#5ED6B3]/60 bg-white text-[#066ac9] hover:bg-[#5ED6B3]/10'
            ]"
            @click="filterType = 'natural'"
          >
            Persona Natural
          </button>
          <button
            type="button"
            :class="[
              'rounded-xl border px-5 py-3 text-sm font-medium transition',
              filterType === 'legal'
                ? 'border-[#5ED6B3] bg-gradient-to-r from-[#10b981] to-[#5ED6B3] text-white'
                : 'border-[#5ED6B3]/60 bg-white text-[#066ac9] hover:bg-[#5ED6B3]/10'
            ]"
            @click="filterType = 'legal'"
          >
            Persona Jurídica
          </button>
        </div>
      </div>

      <!-- Acciones de tabla -->
      <div class="mb-4 flex justify-end gap-3">
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dbe7fb] bg-white text-[#4A52D8] transition hover:bg-[#4A52D8]/10"
          title="Vista"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        </button>
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dbe7fb] bg-white text-[#4A52D8] transition hover:bg-[#4A52D8]/10"
          title="Filtrar"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dbe7fb] bg-white text-[#4A52D8] transition hover:bg-[#4A52D8]/10"
          title="Ordenar"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>

      <!-- Tabla -->
      <div class="overflow-hidden overflow-x-auto rounded-2xl border border-[#dbe7fb]">
        <table class="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr class="bg-gradient-to-r from-[#066ac9]/90 to-[#4A52D8]/90 text-white">
              <th class="px-5 py-4 font-semibold first:rounded-tl-2xl">Nombres completos</th>
              <th class="px-5 py-4 font-semibold">Género</th>
              <th class="px-5 py-4 font-semibold">Fecha de nacimiento</th>
              <th class="px-5 py-4 font-semibold">País de origen</th>
              <th class="px-5 py-4 font-semibold">Nacionalidad</th>
              <th class="px-5 py-4 font-semibold">Tipo de documento</th>
              <th class="px-5 py-4 font-semibold">Número de documento</th>
              <th class="w-14 px-3 py-4 last:rounded-tr-2xl"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, i) in tableData"
              :key="i"
              class="border-t border-[#dbe7fb] bg-white transition hover:bg-[#fbfdff]"
            >
              <td class="px-5 py-4 font-medium text-[#232b4d]">{{ row.nombres }}</td>
              <td class="px-5 py-4 text-[#666]">{{ row.genero }}</td>
              <td class="px-5 py-4 text-[#666]">{{ row.fechaNacimiento }}</td>
              <td class="px-5 py-4 text-[#666]">{{ row.paisOrigen }}</td>
              <td class="px-5 py-4 text-[#666]">{{ row.nacionalidad }}</td>
              <td class="px-5 py-4 text-[#666]">{{ row.tipoDoc }}</td>
              <td class="px-5 py-4 text-[#666]">{{ row.numDoc }}</td>
              <td class="px-3 py-4">
                <button
                  type="button"
                  class="flex h-9 w-9 items-center justify-center rounded-xl text-[#666] transition hover:bg-[#4A52D8]/10 hover:text-[#4A52D8]"
                  title="Más opciones"
                >
                  <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="tableData.length === 0" class="py-12 text-center text-sm text-[#666]">
        No hay registros para mostrar.
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const searchQuery = ref('')
const filterType = ref<'natural' | 'legal'>('natural')

const tableData = ref([
  {
    nombres: 'Tomas Herrera Carpio',
    genero: 'male',
    fechaNacimiento: '21/02/1997',
    paisOrigen: 'Chile',
    nacionalidad: 'Argentina',
    tipoDoc: 'DNI',
    numDoc: '77023456'
  },
  {
    nombres: 'Tomas Herrera Carpio',
    genero: 'male',
    fechaNacimiento: '21/02/1997',
    paisOrigen: 'Chile',
    nacionalidad: 'Argentina',
    tipoDoc: 'DNI',
    numDoc: '77023456'
  }
])
</script>
