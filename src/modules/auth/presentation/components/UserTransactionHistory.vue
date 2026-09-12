<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { TransactionsApiAdapter } from '@/modules/transacciones/infrastructure/adapters/transactions_api_adapter'
import type { Transaction } from '@/modules/transacciones/domain/models'
const props = defineProps<{ userId: string }>()
const page = shallowRef(1)
const items = shallowRef<Transaction[]>([])
const total = shallowRef(0)
const loading = shallowRef(false)
const error = shallowRef('')
const api = new TransactionsApiAdapter()
watch(
  () => props.userId,
  () => {
    page.value = 1
  }
)
watch(
  [() => props.userId, page],
  async ([id, current], _, onCleanup) => {
    let stale = false
    onCleanup(() => {
      stale = true
    })
    loading.value = true
    error.value = ''
    items.value = []
    try {
      const result = await api.getTransactions({ user_id: id, skip: (current - 1) * 10, limit: 10 })
      if (!stale) {
        items.value = result.items
        total.value = result.total
      }
    } catch {
      if (!stale) error.value = 'No se pudo cargar el historial.'
    } finally {
      if (!stale) loading.value = false
    }
  },
  { immediate: true }
)
</script>
<template>
  <section class="overflow-auto p-4" aria-label="Historial de transacciones">
    <p class="mb-3 font-medium">Transacciones: {{ total }}</p>
    <p v-if="error" role="alert" class="text-red-700">{{ error }}</p>
    <p v-else-if="loading">Cargando historial…</p>
    <p v-else-if="!items.length">No hay transacciones para este usuario.</p>
    <table v-else class="w-full text-left text-sm">
      <thead>
        <tr>
          <th class="p-2">Fecha</th>
          <th class="p-2">Código</th>
          <th class="p-2">Montos</th>
          <th class="p-2">Estado</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id" class="border-t">
          <td class="p-2">
            {{ item.send_date ? new Date(item.send_date).toLocaleDateString('es-PE') : '—' }}
          </td>
          <td class="p-2">{{ item.code }}</td>
          <td class="p-2">{{ item.origin_amount }} → {{ item.destination_amount }}</td>
          <td class="p-2">{{ item.status }}</td>
        </tr>
      </tbody>
    </table>
    <footer class="mt-4 flex justify-between text-sm">
      <button :disabled="page <= 1 || loading" @click="page--">Anterior</button
      ><span>Página {{ page }}</span
      ><button :disabled="page * 10 >= total || loading" @click="page++">Siguiente</button>
    </footer>
  </section>
</template>
