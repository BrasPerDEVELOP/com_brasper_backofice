<script setup lang="ts">
import { shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth/presentation/controllers/use_auth_store_controller'
import { useNotifications } from './use_notifications'
import NoticeForm from './NoticeForm.vue'
import type { Notification } from '../domain/notification'
const auth = useAuthStore()
const router = useRouter()
const open = shallowRef(false)
const creating = shallowRef(false)
const { items, unread, total, page, loading, error, refresh, read, readAll, changePage } =
  useNotifications()
async function select(item: Notification) {
  if (!(await read(item))) return
  if (
    item.entity_type === 'transaction' &&
    item.entity_id &&
    auth.hasPermission('transactions.view')
  ) {
    open.value = false
    await router.push({ path: '/app/transacciones', query: { transaction_id: item.entity_id } })
  }
}
function created() {
  creating.value = false
  void refresh()
}
</script>
<template>
  <div class="relative" @keydown.esc="open = false">
    <button
      type="button"
      aria-label="Notificaciones"
      :aria-expanded="open"
      class="relative h-10 rounded-xl px-3 hover:bg-neutral-100"
      @click="open = !open"
    >
      <svg
        aria-hidden="true"
        class="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </svg>
      <span
        v-if="unread"
        class="absolute -right-1 -top-1 rounded-full bg-indigo-700 px-1.5 text-xs text-white"
        >{{ unread > 99 ? '99+' : unread }}</span
      >
    </button>
    <section
      v-if="open"
      aria-label="Bandeja de notificaciones"
      class="absolute right-0 z-50 mt-2 max-h-[80vh] w-96 max-w-[90vw] overflow-auto rounded-xl border bg-white shadow-xl"
    >
      <header class="flex flex-wrap items-center gap-3 border-b p-4">
        <strong>Avisos</strong><button class="ml-auto text-sm" @click="open = false">Cerrar</button
        ><button
          v-if="auth.hasPermission('notifications.create')"
          class="text-sm text-indigo-700"
          @click="creating = !creating"
        >
          Nuevo aviso
        </button>
      </header>
      <NoticeForm v-if="creating" @created="created" @cancel="creating = false" />
      <template v-else>
        <div class="flex justify-between p-3 text-sm">
          <button :disabled="loading" @click="refresh">Actualizar</button
          ><button :disabled="!unread || loading" @click="readAll">Marcar todo leído</button>
        </div>
        <p v-if="error" role="alert" class="p-3 text-sm text-red-700">{{ error }}</p>
        <p v-if="loading && !items.length" class="p-4">Cargando…</p>
        <p v-else-if="!items.length" class="p-4 text-sm text-gray-500">No tienes avisos.</p>
        <ul>
          <li v-for="item in items" :key="item.id" class="border-t">
            <button
              class="w-full p-4 text-left hover:bg-gray-50"
              :class="{ 'bg-indigo-50': !item.read_at }"
              @click="select(item)"
            >
              <strong class="block text-sm">{{ item.title }}</strong
              ><span class="block whitespace-pre-wrap text-sm">{{ item.body }}</span
              ><time class="text-xs text-gray-500">{{
                new Date(item.created_at).toLocaleString('es-PE')
              }}</time>
            </button>
          </li>
        </ul>
        <footer class="flex justify-between p-3 text-sm">
          <button :disabled="page === 1 || loading" @click="changePage(page - 1)">Anterior</button
          ><span>{{ page }}</span
          ><button :disabled="page * 20 >= total || loading" @click="changePage(page + 1)">
            Siguiente
          </button>
        </footer>
      </template>
    </section>
  </div>
</template>
