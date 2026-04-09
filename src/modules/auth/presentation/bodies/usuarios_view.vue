<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import {
  fetchUsers,
  deleteUser,
  createUser,
  USER_ROLES,
  type UserListItem
} from '../../infrastructure/adapters/users_management_api_adapter'
import { parseUsersFromExcel } from '../../infrastructure/utils/excel_users_parser'
import { USER_ROLE_LABELS } from '../../domain/models/user_roles'
import * as XLSX from 'xlsx'
import AppDropdown from '@/interface/components/AppDropdown.vue'
import UsuarioCreateFormModal from '@/interface/components/UsuarioCreateFormModal.vue'

const users = ref<UserListItem[]>([])
const loading = ref(false)
const error = ref('')
const successMessage = ref('')
const showCreateModal = ref(false)
const showImportModal = ref(false)
const importFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const importing = ref(false)
const importError = ref('')
const searchQuery = ref('')
const openMenuId = ref<string | null>(null)

const roleSelectFilter = ref<string>('todos')

const perPage = ref(10)
const currentPage = ref(1)

const roleOptions = computed(() => [
  { value: 'todos', label: 'Todos' },
  ...USER_ROLES.map((r) => ({ value: r, label: USER_ROLE_LABELS[r] }))
])

const perPageOptions = [
  { value: '5', label: '5' },
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' }
]

const perPageStr = computed({
  get: () => String(perPage.value),
  set: (v) => {
    perPage.value = Number(v) || 10
  }
})

const createModalDefaultRole = computed(() =>
  roleSelectFilter.value.toLowerCase() === 'todos' ? 'client' : roleSelectFilter.value
)

const debouncedSearch = ref('')
let searchDebounceId: ReturnType<typeof setTimeout>
watch(searchQuery, (q) => {
  clearTimeout(searchDebounceId)
  searchDebounceId = setTimeout(() => {
    debouncedSearch.value = q
  }, 150)
}, { immediate: true })

const filteredByRole = computed(() => {
  const role = roleSelectFilter.value.toLowerCase()
  if (role === 'todos') return users.value
  return users.value.filter((u) => (u.role ?? '').toLowerCase() === role)
})

const searchedUsers = computed(() => {
  const list = filteredByRole.value
  const q = debouncedSearch.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((u) => {
    const name = (u.name ?? '').toLowerCase()
    const email = (u.email ?? '').toLowerCase()
    const doc = (u.document_number ?? '').toLowerCase()
    return name.includes(q) || email.includes(q) || doc.includes(q)
  })
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(searchedUsers.value.length / perPage.value))
)

const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return searchedUsers.value.slice(start, start + perPage.value)
})

async function loadUsers() {
  loading.value = true
  error.value = ''
  try {
    const role = roleSelectFilter.value.toLowerCase()
    const params = role !== 'todos' ? { role } : undefined
    users.value = await fetchUsers(params)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar usuarios'
    users.value = []
  } finally {
    loading.value = false
  }
}

function openCreateModal() {
  error.value = ''
  successMessage.value = ''
  showCreateModal.value = true
}

async function onUserCreated() {
  successMessage.value = 'Usuario creado correctamente'
  await loadUsers()
}

async function submitImport() {
  if (!importFile.value) return
  importing.value = true
  importError.value = ''
  error.value = ''
  try {
    const defaultRole =
      roleSelectFilter.value.toLowerCase() === 'todos' ? 'client' : roleSelectFilter.value
    const payloads = await parseUsersFromExcel(importFile.value, defaultRole)
    if (payloads.length === 0) {
      importError.value = 'No se encontraron filas válidas con email en el archivo'
      return
    }
    let created = 0
    const errors: string[] = []
    for (const p of payloads) {
      try {
        await createUser(p)
        created++
      } catch (e) {
        errors.push(`${p.email}: ${e instanceof Error ? e.message : 'Error'}`)
      }
    }
    showImportModal.value = false
    importFile.value = null
    if (fileInput.value) fileInput.value.value = ''
    if (created > 0) {
      successMessage.value =
        errors.length > 0
          ? `Se importaron ${created} usuario(s). Errores: ${errors.length}`
          : `Se importaron ${created} usuario(s) correctamente`
      await loadUsers()
    }
    if (errors.length > 0) {
      error.value = errors.slice(0, 5).join('; ') + (errors.length > 5 ? ` ... y ${errors.length - 5} más` : '')
    }
  } catch (e) {
    importError.value = e instanceof Error ? e.message : 'Error al procesar el archivo Excel'
  } finally {
    importing.value = false
  }
}

const deletingId = ref<string | null>(null)

function toggleMenu(id: string) {
  if (openMenuId.value === id) {
    openMenuId.value = null
    return
  }
  openMenuId.value = id
  nextTick(() => {
    const close = () => {
      openMenuId.value = null
      document.removeEventListener('click', close)
    }
    setTimeout(() => document.addEventListener('click', close), 0)
  })
}

async function handleDelete(u: UserListItem) {
  if (!confirm(`¿Eliminar a ${u.name} (${u.email})?`)) return
  openMenuId.value = null
  deletingId.value = u.id
  error.value = ''
  try {
    await deleteUser(u.id)
    successMessage.value = 'Usuario eliminado correctamente'
    await loadUsers()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al eliminar usuario'
  } finally {
    deletingId.value = null
  }
}

function goToPage(page: number) {
  currentPage.value = Math.max(1, Math.min(page, totalPages.value))
}

watch([searchQuery, roleSelectFilter, perPage], () => {
  currentPage.value = 1
})

watch(roleSelectFilter, loadUsers)

function getDocumentType(u: UserListItem): string {
  return (u.document_type ?? '-').toUpperCase()
}

function getDocumentNumber(u: UserListItem): string {
  return u.document_number ?? '-'
}

function exportUsersToExcel() {
  const headers = ['uuid', 'nombres', 'email', 'tipo_documento', 'n_documento', 'rol']
  const rows = searchedUsers.value.map((u) => [
    u.id,
    u.name ?? '',
    u.email ?? '',
    (u.document_type ?? '').toUpperCase(),
    u.document_number ?? '',
    USER_ROLE_LABELS[u.role as keyof typeof USER_ROLE_LABELS] ?? (u.role ?? '')
  ])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Usuarios')
  const filename = `usuarios_${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, filename)
}

onMounted(() => {
  loadUsers()
})
</script>

<template>
  <!-- Header -->
  <div class="mb-6">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-medium text-[#1f2937]">Usuarios</h1>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded-lg border border-[#e5e7eb] bg-white p-2 text-[#6b7280] hover:bg-[#f9fafb]"
          title="Vista tabla"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </button>
        <button
          type="button"
          class="rounded-lg border border-[#e5e7eb] bg-white p-2 text-[#6b7280] hover:bg-[#f9fafb]"
          title="Vista cuadrícula"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#374151] transition hover:bg-[#f9fafb]"
          @click="showImportModal = true"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Importar Excel
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#374151] transition hover:bg-[#f9fafb]"
          @click="exportUsersToExcel"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar Excel
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg bg-brasper-indigoStrong px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brasper-indigoDark disabled:opacity-50 disabled:cursor-not-allowed"
          @click.stop="openCreateModal"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Crear
        </button>
      </div>
    </div>
  </div>

  <!-- Search + Rol + Total -->
  <div class="mb-6 flex flex-wrap items-center gap-6">
    <div class="relative min-w-[220px] flex-1 max-w-sm">
      <svg
        class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Buscar"
        class="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white py-2.5 pl-10 pr-4 text-sm text-[#374151] placeholder-[#9ca3af] focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
      />
    </div>
    <div class="flex items-center gap-2">
      <label class="text-sm font-medium text-[#6b7280]">Rol</label>
      <AppDropdown
        v-model="roleSelectFilter"
        :options="roleOptions"
        placeholder="Todos"
        :searchable="false"
        min-width="140px"
      />
    </div>
    <div class="flex items-center gap-2">
      <label class="text-sm font-medium text-[#6b7280]">Total</label>
      <div class="flex h-10 min-w-[4rem] items-center justify-center rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 text-sm font-medium text-[#374151]">
        {{ searchedUsers.length }}
      </div>
    </div>
  </div>

  <!-- Content -->
  <p v-if="error" class="mb-4 rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]">
    {{ error }}
  </p>
  <p v-if="successMessage" class="mb-4 rounded-lg bg-brasper-cyanLight/15 px-4 py-3 text-sm text-brasper-indigoDark">
    {{ successMessage }}
  </p>

  <div class="relative overflow-x-auto rounded-xl border border-[#e5e7eb] bg-white">
    <div
      v-if="loading"
      class="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/80"
    >
      <span class="text-sm text-[#6b7280]">Cargando...</span>
    </div>
    <table class="w-full text-left text-sm">
      <thead>
        <tr class="bg-[#dbeafe]">
          <th class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark">Nombres</th>
          <th class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark">Email</th>
          <th class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark">Tipo documento</th>
          <th class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark">N. documento</th>
          <th class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark">Rol</th>
          <th class="w-12 px-2 py-3"></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="u in paginatedUsers"
          :key="u.id"
          class="border-t border-[#e5e7eb] bg-white transition hover:bg-[#f9fafb]"
        >
          <td class="px-4 py-3 text-[#374151]">{{ u.name ?? '-' }}</td>
          <td class="px-4 py-3 text-[#374151]">{{ u.email ?? '-' }}</td>
          <td class="px-4 py-3 text-[#374151]">{{ getDocumentType(u) }}</td>
          <td class="px-4 py-3 text-[#374151]">{{ getDocumentNumber(u) }}</td>
          <td class="px-4 py-3">
            <span
              class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
              :class="
                (u.role ?? '').toLowerCase() === 'admin'
                  ? 'bg-brasper-cyanLight/30 text-brasper-indigoDark'
                  : 'bg-[#dbeafe] text-brasper-indigoDark'
              "
            >
              {{ USER_ROLE_LABELS[u.role as keyof typeof USER_ROLE_LABELS] ?? (u.role ?? '—').toUpperCase() }}
            </span>
          </td>
          <td class="relative px-2 py-3">
            <button
              type="button"
              class="rounded p-1.5 text-[#6b7280] hover:bg-[#f3f4f6]"
              @click.stop="toggleMenu(u.id)"
            >
              <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </button>
            <div
              v-if="openMenuId === u.id"
              class="absolute right-0 top-full z-10 mt-1 min-w-[160px] rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg"
              @click.stop
            >
              <button
                type="button"
                class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#374151] hover:bg-[#f9fafb]"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Editar
              </button>
              <button
                type="button"
                class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#374151] hover:bg-[#f9fafb]"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Ver ficha
              </button>
              <button
                type="button"
                class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#dc3545] hover:bg-[#fef2f2]"
                :disabled="deletingId === u.id"
                @click="handleDelete(u)"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Borrar
              </button>
            </div>
          </td>
        </tr>
        <tr v-if="!loading && paginatedUsers.length === 0">
          <td colspan="6" class="px-4 py-12 text-center text-[#6b7280]">
            {{
              users.length === 0
                ? 'No hay usuarios registrados.'
                : 'No hay usuarios que coincidan con el filtro o búsqueda.'
            }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Pagination -->
  <div class="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#e5e7eb] pt-4">
    <div class="flex items-center gap-4 text-sm text-[#6b7280]">
      <span>Página {{ currentPage }} de {{ totalPages }}</span>
      <AppDropdown
        v-model="perPageStr"
        :options="perPageOptions"
        placeholder="10"
        :searchable="false"
        size="sm"
        min-width="3rem"
      />
    </div>
    <div class="flex items-center gap-2 text-sm text-[#6b7280]">
      <span>{{ searchedUsers.length }} resultados</span>
      <div class="flex gap-1">
        <button
          type="button"
          class="rounded p-2 text-[#6b7280] hover:bg-[#f3f4f6] disabled:opacity-40"
          :disabled="currentPage <= 1"
          @click="goToPage(1)"
        >
          &laquo;
        </button>
        <button
          type="button"
          class="rounded p-2 text-[#6b7280] hover:bg-[#f3f4f6] disabled:opacity-40"
          :disabled="currentPage <= 1"
          @click="goToPage(currentPage - 1)"
        >
          &lsaquo;
        </button>
        <button
          type="button"
          class="rounded p-2 text-[#6b7280] hover:bg-[#f3f4f6] disabled:opacity-40"
          :disabled="currentPage >= totalPages"
          @click="goToPage(currentPage + 1)"
        >
          &rsaquo;
        </button>
        <button
          type="button"
          class="rounded p-2 text-[#6b7280] hover:bg-[#f3f4f6] disabled:opacity-40"
          :disabled="currentPage >= totalPages"
          @click="goToPage(totalPages)"
        >
          &raquo;
        </button>
      </div>
    </div>
  </div>

  <UsuarioCreateFormModal
    v-model="showCreateModal"
    :show-role-field="roleSelectFilter.toLowerCase() === 'todos'"
    :default-role="createModalDefaultRole"
    @created="onUserCreated"
  />

  <!-- Modal Importar Excel -->
  <Teleport to="body">
    <div
      v-if="showImportModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="showImportModal = false"
    >
      <div class="w-full max-w-md rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-xl">
        <h2 class="mb-4 text-lg font-semibold text-[#1f2937]">Importar usuarios desde Excel</h2>
        <div class="mb-4 rounded-lg bg-[#f9fafb] p-4 text-sm text-[#6b7280]">
          <p class="mb-2 font-medium text-[#374151]">Formatos aceptados: .xlsx, .xls</p>
          <p class="mb-2">La primera fila debe ser encabezados. Columnas soportadas:</p>
          <ul class="list-inside list-disc space-y-1">
            <li><strong>email</strong> / correo — Obligatorio</li>
            <li><strong>nombres</strong> / names — Nombres</li>
            <li><strong>apellidos</strong> / lastnames — Apellidos</li>
            <li><strong>tipo_documento</strong> — DNI, CE, Pasaporte</li>
            <li><strong>n_documento</strong> / documento — Número de documento</li>
            <li><strong>rol</strong> / role — Admin, Cliente, etc.</li>
          </ul>
        </div>
        <form class="space-y-4" @submit.prevent="submitImport">
          <div>
            <label class="mb-1 block text-sm font-medium text-[#374151]">Archivo (.xlsx, .xls)</label>
            <input
              ref="fileInput"
              type="file"
              accept=".xlsx,.xls"
              required
              class="w-full rounded-lg border border-[#e5e7eb] px-4 py-2.5 text-sm"
              @change="importFile = ($event.target as HTMLInputElement).files?.[0] ?? null"
            />
          </div>
          <p v-if="importError" class="rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]">
            {{ importError }}
          </p>
          <div class="flex gap-3 pt-2">
            <button
              type="submit"
              class="rounded-lg bg-brasper-indigoStrong px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brasper-indigoDark disabled:opacity-60"
              :disabled="importing || !importFile"
            >
              {{ importing ? 'Importando...' : 'Importar' }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#6b7280] transition hover:bg-[#f9fafb]"
              @click="showImportModal = false"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.select-dropdown {
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1rem;
}
</style>
