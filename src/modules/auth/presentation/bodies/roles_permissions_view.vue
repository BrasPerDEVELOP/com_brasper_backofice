<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppDropdown from '@/interface/components/AppDropdown.vue'
import {
  PERMISSION_MODULES,
  USER_ROLE_LABELS,
  USER_ROLES,
  type PermissionKey,
  type UserRole
} from '../../domain/models'
import {
  fetchRolePermissions,
  getDefaultRolePermissions,
  updateRolePermissions,
  type RolePermissions
} from '../../infrastructure/adapters/role_permissions_api_adapter'
import axios from 'axios'
import { useAuthStore } from '../controllers/use_auth_store_controller'

const authStore = useAuthStore()

function formatLoadPermissionsError(e: unknown): string {
  const tail =
    'Se muestran permisos por defecto del front (no necesariamente los de la base de datos).'
  if (axios.isAxiosError(e)) {
    const status = e.response?.status
    if (!e.response && e.code === 'ERR_NETWORK') {
      return `No hubo respuesta del servidor (${e.message}). ${tail} Comprueba red o CORS si en consola aparece bloqueo de origen.`
    }
    if (status === 401) {
      return `No autorizado (401). Suele ser sesión caducada o token inválido. ${tail} Prueba cerrar sesión y volver a entrar.`
    }
    if (status === 403) {
      return `Acceso denegado (403). Tu rol no incluye el permiso roles.permissions.view en el servidor. ${tail}`
    }
    return `${e.message}. ${tail}`
  }
  if (e instanceof Error) {
    return `${e.message}. ${tail}`
  }
  return `Error desconocido. ${tail}`
}

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const successMessage = ref('')
const selectedRole = ref<UserRole>('admin')
const rolePermissions = ref<RolePermissions[]>(getDefaultRolePermissions())

const canUpdatePermissions = computed(() =>
  authStore.hasPermission('roles.permissions.update')
)

const roleOptions = computed(() =>
  USER_ROLES.map((role) => ({
    value: role,
    label: USER_ROLE_LABELS[role]
  }))
)

const selectedPermissionSet = computed(() => {
  const role = rolePermissions.value.find((item) => item.role === selectedRole.value)
  return new Set(role?.permissions ?? [])
})

function setRolePermissions(role: UserRole, permissions: PermissionKey[]) {
  rolePermissions.value = rolePermissions.value.map((item) =>
    item.role === role ? { role, permissions } : item
  )
}

function togglePermission(permission: PermissionKey, enabled: boolean) {
  if (!canUpdatePermissions.value) return
  const current = new Set(selectedPermissionSet.value)
  if (enabled) current.add(permission)
  else current.delete(permission)
  setRolePermissions(selectedRole.value, Array.from(current))
  successMessage.value = ''
}

function isPermissionChecked(permission: PermissionKey): boolean {
  return selectedPermissionSet.value.has(permission)
}

async function loadPermissions() {
  loading.value = true
  error.value = ''
  try {
    rolePermissions.value = await fetchRolePermissions()
  } catch (e) {
    rolePermissions.value = getDefaultRolePermissions()
    error.value = formatLoadPermissionsError(e)
  } finally {
    loading.value = false
  }
}

async function saveSelectedRole() {
  if (!canUpdatePermissions.value) return
  const permissions = Array.from(selectedPermissionSet.value)
  if (selectedRole.value === 'admin' && permissions.length === 0) {
    error.value = 'Admin debe conservar permisos críticos'
    return
  }
  saving.value = true
  error.value = ''
  successMessage.value = ''
  try {
    const saved = await updateRolePermissions(selectedRole.value, permissions)
    setRolePermissions(saved.role, saved.permissions)
    successMessage.value = 'Permisos actualizados correctamente'
  } catch (e) {
    error.value = axios.isAxiosError(e)
      ? e.response?.status === 401
        ? 'No autorizado (401). Vuelve a iniciar sesión.'
        : e.response?.status === 403
          ? 'No tienes permiso para guardar (403).'
          : (e.message || 'No se pudieron guardar los permisos')
      : e instanceof Error
        ? e.message
        : 'No se pudieron guardar los permisos'
  } finally {
    saving.value = false
  }
}

onMounted(loadPermissions)
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-[#1f2937]">Permisos de roles</h1>
          <p class="mt-1 text-sm text-[#6b7280]">
            Configura qué puede ver y hacer cada rol fijo del backoffice.
          </p>
        </div>
        <div class="w-full max-w-xs">
          <label class="mb-1.5 block text-sm font-medium text-[#374151]">Rol</label>
          <AppDropdown
            v-model="selectedRole"
            :options="roleOptions"
            :searchable="false"
            placeholder="Seleccionar rol"
          />
        </div>
      </div>

      <p v-if="error" class="mt-5 rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]">
        {{ error }}
      </p>
      <p v-if="successMessage" class="mt-5 rounded-lg bg-brasper-cyanLight/15 px-4 py-3 text-sm text-brasper-indigoDark">
        {{ successMessage }}
      </p>
    </section>

    <section class="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
      <div
        v-if="loading"
        class="flex min-h-[18rem] items-center justify-center text-sm text-[#6b7280]"
      >
        Cargando permisos...
      </div>
      <div v-else class="divide-y divide-[#e5e7eb]">
        <div
          v-for="module in PERMISSION_MODULES"
          :key="module.key"
          class="grid gap-4 p-5 lg:grid-cols-[220px_1fr]"
        >
          <div>
            <h2 class="text-sm font-semibold text-[#1f2937]">{{ module.label }}</h2>
          </div>
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label
              v-for="permission in module.permissions"
              :key="permission.key"
              class="flex items-center justify-between gap-3 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-sm"
            >
              <span class="font-medium text-[#374151]">{{ permission.label }}</span>
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-[#cbd5e1] text-brasper-indigoStrong focus:ring-brasper-indigoStrong"
                :checked="isPermissionChecked(permission.key)"
                :disabled="!canUpdatePermissions"
                @change="togglePermission(permission.key, ($event.target as HTMLInputElement).checked)"
              />
            </label>
          </div>
        </div>
      </div>
    </section>

    <div class="flex justify-end">
      <button
        type="button"
        class="rounded-lg bg-brasper-indigoStrong px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brasper-indigoDark disabled:opacity-60"
        :disabled="saving || loading || !canUpdatePermissions"
        @click="saveSelectedRole"
      >
        {{ saving ? 'Guardando...' : 'Guardar permisos' }}
      </button>
    </div>
  </div>
</template>
