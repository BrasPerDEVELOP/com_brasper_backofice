<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import { PERMISSION_MODULES, ACCOUNTING_PERMISSION_KEYS } from '../../domain/models/permissions'
import {
  fetchUserAccess,
  saveUserAccess
} from '../../infrastructure/adapters/user_access_api_adapter'
import { fetchRolePermissions } from '../../infrastructure/adapters/role_permissions_api_adapter'
import { useAuthStore } from '../controllers/use_auth_store_controller'
const props = defineProps<{ userId: string; role: string }>()
const auth = useAuthStore()
const granted = ref<string[]>([])
const revoked = ref<string[]>([])
const inherited = shallowRef<string[]>([])
const loading = shallowRef(true)
const loaded = shallowRef(false)
const saving = shallowRef(false)
const error = shallowRef('')
const message = shallowRef('')
function guaranteed(key: string) {
  return props.role === 'accounting' && ACCOUNTING_PERMISSION_KEYS.some((p) => p === key)
}
watch(
  [() => props.userId, () => props.role],
  async ([id, role], _, onCleanup) => {
    let stale = false
    onCleanup(() => {
      stale = true
    })
    loading.value = true
    loaded.value = false
    error.value = ''
    message.value = ''
    try {
      const [access, roles] = await Promise.all([fetchUserAccess(id), fetchRolePermissions()])
      if (!stale) {
        granted.value = access.granted
        revoked.value = access.revoked
        inherited.value = roles.find((r) => r.role === role)?.permissions ?? []
        loaded.value = true
      }
    } catch {
      if (!stale) error.value = 'No se pudo cargar el acceso del usuario.'
    } finally {
      if (!stale) loading.value = false
    }
  },
  { immediate: true }
)
function change(key: string, event: Event) {
  if (guaranteed(key)) return
  const state = (event.target as HTMLSelectElement).value
  granted.value = granted.value.filter((p) => p !== key)
  revoked.value = revoked.value.filter((p) => p !== key)
  if (state === 'added') granted.value.push(key)
  if (state === 'removed') revoked.value.push(key)
  message.value = ''
}
function resetToRole() {
  granted.value = []
  revoked.value = []
  message.value = ''
}
async function save() {
  if (
    saving.value ||
    !loaded.value ||
    auth.user?.id === props.userId ||
    !auth.hasPermission('users.update') ||
    !auth.hasPermission('roles.permissions.update')
  )
    return
  saving.value = true
  error.value = ''
  message.value = ''
  try {
    await saveUserAccess(props.userId, granted.value, revoked.value)
    message.value = 'Acceso guardado.'
  } catch {
    error.value = 'No se pudo guardar el acceso. Revisa tus permisos e intenta nuevamente.'
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <section class="space-y-4 p-4" aria-label="Acceso del usuario">
    <p v-if="loading">Cargando acceso…</p>
    <p v-if="error" role="alert" class="text-sm text-red-700">{{ error }}</p>
    <p v-if="message" role="status" class="text-sm text-green-700">{{ message }}</p>
    <template v-if="!loading">
      <p class="text-sm text-gray-600">
        Los permisos heredados siguen los cambios del rol. Puedes añadir o quitar permisos para este
        usuario.
      </p>
      <fieldset
        v-for="module in PERMISSION_MODULES"
        :key="module.key"
        :disabled="saving || !loaded"
        class="rounded border p-3"
      >
        <legend class="text-sm font-semibold">{{ module.label }}</legend>
        <label
          v-for="permission in module.permissions"
          :key="permission.key"
          class="my-2 flex items-center justify-between gap-3 text-sm"
          ><span>{{ permission.label }}</span
          ><select
            :disabled="guaranteed(permission.key)"
            :title="guaranteed(permission.key) ? 'Permiso garantizado del rol' : ''"
            :value="
              granted.includes(permission.key)
                ? 'added'
                : revoked.includes(permission.key)
                  ? 'removed'
                  : 'inherited'
            "
            class="rounded border p-1"
            @change="change(permission.key, $event)"
          >
            <option value="inherited">
              Heredado ({{ inherited.includes(permission.key) ? 'sí' : 'no' }})
            </option>
            <option value="added">Añadido</option>
            <option value="removed">Quitado</option>
          </select></label
        >
      </fieldset>
      <div class="flex gap-3">
        <button
          :disabled="saving || !loaded"
          class="rounded bg-indigo-700 px-3 py-2 text-white"
          @click="save"
        >
          Guardar acceso</button
        ><button
          :disabled="saving"
          @click="resetToRole"
        >
          Restablecer al rol
        </button>
      </div>
    </template>
  </section>
</template>
