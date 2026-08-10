<script setup lang="ts">
import AppDropdown from '@/interface/components/AppDropdown.vue'
import { USER_ROLE_LABELS } from '../../domain/models'
import type { UserListItem } from '../../infrastructure/adapters/users_management_api_adapter'
import { isClientProfileIncomplete, missingProfileFields } from '../../infrastructure/parse_user'

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
  edit: [user: UserListItem]
  resetPassword: [user: UserListItem]
  viewAccounts: [user: UserListItem]
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

function isClient(user: UserListItem): boolean {
  return ['client', 'cliente'].includes((user.role ?? '').toLowerCase())
}

/**
 * Solo se marca a clientes: un asesor sin documento no es un "perfil a completar",
 * y marcarlos ensuciaría la lista con avisos que nadie va a atender.
 */
function isProfileIncomplete(user: UserListItem): boolean {
  return isClient(user) && isClientProfileIncomplete(user)
}

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
      <div v-if="loading" class="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/80"><span class="text-sm text-[#6b7280]">Cargando...</span></div>
      <table class="w-full text-left text-sm">
        <thead><tr class="bg-[#dbeafe]"><th class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark">Nombres</th><th class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark">Email</th><th class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark">Documento</th><th class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark">Rol</th><th class="w-12 px-2 py-3"><span class="sr-only">Acciones</span></th></tr></thead>
        <tbody>
          <tr v-for="user in users" :key="user.id" class="cursor-pointer border-t border-[#e5e7eb] bg-white transition hover:bg-[#f9fafb]" :class="selectedUserId === user.id ? 'bg-[#eef2ff] ring-1 ring-inset ring-brasper-indigoStrong/30' : ''" @click="emit('select', user)">
            <td class="px-4 py-3 text-[#374151]">
              {{ user.name || '-' }}
              <span
                v-if="isProfileIncomplete(user)"
                class="ml-1.5 inline-flex items-center rounded-full border border-[#fed7aa] bg-[#fff7ed] px-1.5 text-[10px] font-semibold text-[#9a3412]"
                :title="`Alta rápida sin completar. Falta: ${missingProfileFields(user).join(', ')}`"
              >
                Por completar
              </span>
            </td><td class="px-4 py-3 text-[#374151]">{{ user.email || '-' }}</td><td class="px-4 py-3 text-[#374151]"><span class="block text-xs text-[#6b7280]">{{ documentType(user) }}</span>{{ documentNumber(user) }}</td>
            <td class="px-4 py-3"><span class="inline-flex rounded-full bg-[#dbeafe] px-2.5 py-0.5 text-xs font-medium text-brasper-indigoDark">{{ USER_ROLE_LABELS[user.role as keyof typeof USER_ROLE_LABELS] ?? user.role ?? '—' }}</span></td>
            <td class="relative px-2 py-3"><button type="button" class="rounded p-1.5 text-[#6b7280] hover:bg-[#f3f4f6]" aria-label="Acciones del usuario" @click.stop="emit('toggleMenu', user.id)">•••</button>
              <div v-if="openMenuId === user.id" class="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg" @click.stop>
                <button v-if="canUpdate" type="button" class="block w-full px-4 py-2 text-left text-sm hover:bg-[#f9fafb]" @click="emit('edit', user)">Editar usuario</button>
                <button v-if="canResetPassword" type="button" class="block w-full px-4 py-2 text-left text-sm hover:bg-[#f9fafb]" @click="emit('resetPassword', user)">Resetear contraseña</button>
                <button v-if="canViewAccounts && isClient(user)" type="button" class="block w-full px-4 py-2 text-left text-sm hover:bg-[#f9fafb]" @click="emit('viewAccounts', user)">Ver cuentas</button>
                <button v-if="canDelete" type="button" class="block w-full px-4 py-2 text-left text-sm text-[#dc3545] hover:bg-[#fef2f2]" :disabled="deletingId === user.id" @click="emit('delete', user)">Borrar</button>
              </div>
            </td>
          </tr>
          <tr v-if="!loading && users.length === 0"><td colspan="5" class="px-4 py-12 text-center text-[#6b7280]">{{ totalUsers === 0 ? 'No hay usuarios registrados.' : 'No hay usuarios que coincidan con el filtro o búsqueda.' }}</td></tr>
        </tbody>
      </table>
    </div>
    <div class="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#e5e7eb] pt-4">
      <div class="flex items-center gap-4 text-sm text-[#6b7280]"><span>Página {{ currentPage }} de {{ totalPages }}</span><AppDropdown v-model="perPage" :options="perPageOptions" placeholder="10" :searchable="false" size="sm" min-width="3rem" /></div>
      <div class="flex items-center gap-2 text-sm text-[#6b7280]"><span>{{ totalResults }} resultados</span><div class="flex gap-1"><button type="button" class="rounded p-2 hover:bg-[#f3f4f6] disabled:opacity-40" :disabled="currentPage <= 1" @click="emit('goToPage', 1)">«</button><button type="button" class="rounded p-2 hover:bg-[#f3f4f6] disabled:opacity-40" :disabled="currentPage <= 1" @click="emit('goToPage', currentPage - 1)">‹</button><button type="button" class="rounded p-2 hover:bg-[#f3f4f6] disabled:opacity-40" :disabled="currentPage >= totalPages" @click="emit('goToPage', currentPage + 1)">›</button><button type="button" class="rounded p-2 hover:bg-[#f3f4f6] disabled:opacity-40" :disabled="currentPage >= totalPages" @click="emit('goToPage', totalPages)">»</button></div></div>
    </div>
  </div>
</template>
