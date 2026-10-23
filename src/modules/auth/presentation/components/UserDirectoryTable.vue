<script setup lang="ts">
import AppDropdown from '@/interface/components/AppDropdown.vue'
import UserRowActionsMenu from './UserRowActionsMenu.vue'
import { USER_ROLE_LABELS } from '../../domain/models'
import type { UserListItem } from '../../infrastructure/adapters/users_management_api_adapter'

defineProps<{
  users: UserListItem[]
  totalResults: number
  totalUsers: number
  loading: boolean
  selectedUserId: string | null
  openMenuId: string | null
  deletingId: string | null
  currentPage: number
  totalPages: number
  canUpdate: boolean
  canDelete: boolean
  canResetPassword: boolean
  canViewAccounts: boolean
}>()

const emit = defineEmits<{
  select: [user: UserListItem]
  toggleMenu: [id: string]
  closeMenu: []
  edit: [user: UserListItem]
  resetPassword: [user: UserListItem]
  viewAccounts: [user: UserListItem]
  exportExcel: [user: UserListItem]
  delete: [user: UserListItem]
  goToPage: [page: number]
}>()

const perPage = defineModel<string>('perPage', { required: true })
const perPageOptions = [
  { value: '5', label: '5' },
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' }
]

function documentType(user: UserListItem): string {
  return user.identifications.length > 1
    ? user.identifications.map((item) => item.document_type.toUpperCase()).join(', ')
    : (user.document_type ?? '-').toUpperCase()
}

function documentNumber(user: UserListItem): string {
  return user.identifications.length > 1
    ? user.identifications.map((item) => item.document_number).join(', ')
    : (user.document_number ?? '-')
}
</script>

<template>
  <div class="min-w-0">
    <div class="relative overflow-x-auto rounded-xl border border-[#e5e7eb] bg-white">
      <div
        v-if="loading"
        class="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/80"
      >
        <span class="text-sm text-[#6b7280]">Cargando...</span>
      </div>
      <table class="w-full min-w-[960px] text-left text-sm">
        <thead>
          <tr class="bg-[#dbeafe]">
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark">
              Nombres
            </th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark">Email</th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark">
              Documento
            </th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark">Rol</th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark">País</th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark">
              Zona local
            </th>
            <th
              class="sticky right-0 z-10 w-32 whitespace-nowrap bg-[#dbeafe] px-3 py-3 text-right font-semibold text-brasper-indigoDark"
            >
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="user in users"
            :key="user.id"
            class="cursor-pointer border-t border-[#e5e7eb] bg-white transition hover:bg-[#f9fafb]"
            :class="
              selectedUserId === user.id
                ? 'bg-[#eef2ff] ring-1 ring-inset ring-brasper-indigoStrong/30'
                : ''
            "
            @click="emit('select', user)"
          >
            <td class="px-4 py-3 text-[#374151]">
              {{ user.name || '-' }}
            </td>
            <td class="px-4 py-3 text-[#374151]">{{ user.email || '-' }}</td>
            <td class="px-4 py-3 text-[#374151]">
              <span class="block text-xs text-[#6b7280]">{{ documentType(user) }}</span
              >{{ documentNumber(user) }}
            </td>
            <td class="px-4 py-3">
              <span
                class="inline-flex rounded-full bg-[#dbeafe] px-2.5 py-0.5 text-xs font-medium text-brasper-indigoDark"
                >{{
                  USER_ROLE_LABELS[user.role as keyof typeof USER_ROLE_LABELS] ?? user.role ?? '—'
                }}</span
              >
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-[#374151]">
              {{ user.country || 'Sin registrar' }}
            </td>
            <td class="min-w-[200px] max-w-[280px] px-4 py-3 text-[#374151]">
              {{ user.local_area_name || '—' }}
            </td>
            <td class="sticky right-0 bg-white px-3 py-3 text-right" @click.stop>
              <UserRowActionsMenu
                :user="user"
                :open="openMenuId === user.id"
                :deleting="deletingId === user.id"
                :can-update="canUpdate"
                :can-delete="canDelete"
                :can-reset-password="canResetPassword"
                :can-view-accounts="canViewAccounts"
                @toggle="emit('toggleMenu', user.id)"
                @close="emit('closeMenu')"
                @edit="emit('edit', user)"
                @reset-password="emit('resetPassword', user)"
                @view-accounts="emit('viewAccounts', user)"
                @export-excel="emit('exportExcel', user)"
                @delete="emit('delete', user)"
              />
            </td>
          </tr>
          <tr v-if="!loading && users.length === 0">
            <td colspan="7" class="px-4 py-12 text-center text-[#6b7280]">
              {{
                totalUsers === 0
                  ? 'No hay usuarios registrados.'
                  : 'No hay usuarios que coincidan con el filtro o búsqueda.'
              }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div
      class="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#e5e7eb] pt-4"
    >
      <div class="flex items-center gap-4 text-sm text-[#6b7280]">
        <span>Página {{ currentPage }} de {{ totalPages }}</span
        ><AppDropdown
          v-model="perPage"
          :options="perPageOptions"
          placeholder="10"
          :searchable="false"
          size="sm"
          min-width="3rem"
        />
      </div>
      <div class="flex items-center gap-2 text-sm text-[#6b7280]">
        <span>{{ totalResults }} resultados</span>
        <div class="flex gap-1">
          <button
            type="button"
            class="rounded p-2 hover:bg-[#f3f4f6] disabled:opacity-40"
            :disabled="currentPage <= 1"
            @click="emit('goToPage', 1)"
          >
            «</button
          ><button
            type="button"
            class="rounded p-2 hover:bg-[#f3f4f6] disabled:opacity-40"
            :disabled="currentPage <= 1"
            @click="emit('goToPage', currentPage - 1)"
          >
            ‹</button
          ><button
            type="button"
            class="rounded p-2 hover:bg-[#f3f4f6] disabled:opacity-40"
            :disabled="currentPage >= totalPages"
            @click="emit('goToPage', currentPage + 1)"
          >
            ›</button
          ><button
            type="button"
            class="rounded p-2 hover:bg-[#f3f4f6] disabled:opacity-40"
            :disabled="currentPage >= totalPages"
            @click="emit('goToPage', totalPages)"
          >
            »
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
