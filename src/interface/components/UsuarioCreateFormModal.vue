<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  createUser,
  fetchUserById,
  updateUser,
  USER_ROLES,
  type CreateUserPayload,
  type UpdateUserPayload,
  type UserIdentification,
  type UserListItem
} from '@/modules/auth/infrastructure/adapters/users_management_api_adapter'
import { USER_ROLE_LABELS, PHONE_CODES } from '@/modules/auth/domain/models'
import AppDropdown from '@/interface/components/AppDropdown.vue'
import UserIdentificationsEditor from '@/interface/components/UserIdentificationsEditor.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    /** Rol por defecto (ej. 'client' para nuevo cliente). */
    defaultRole?: string
    /** Si true, muestra el selector de rol. Si false, usa defaultRole. */
    showRoleField?: boolean
    user?: UserListItem | null
    /**
     * `quick` deja solo nombre y teléfono: sirve para dar de alta un cliente en
     * medio de una transacción sin frenar la operación. El resto del perfil se
     * completa después desde /app/usuarios.
     */
    variant?: 'full' | 'quick'
  }>(),
  {
    defaultRole: 'client',
    showRoleField: false,
    user: null,
    variant: 'full'
  }
)

/**
 * `expandedFromQuick` deja pasar al formulario completo sin cerrar el modal ni
 * perder lo escrito: quien empieza rápido y descubre que sí tiene los datos no
 * debería tener que volver a empezar.
 */
const expandedFromQuick = ref(false)
const isQuick = computed(
  () => props.variant === 'quick' && !props.user && !expandedFromQuick.value
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  created: [user: UserListItem]
}>()

const creating = ref(false)
const error = ref('')
const loadingDetail = ref(false)
const detailError = ref('')
const isEditing = computed(() => Boolean(props.user?.id))

const form = ref<CreateUserPayload>({
  email: '',
  names: '',
  lastnames: '',
  role: props.defaultRole,
  document_number: '',
  document_type: '',
  profile_image: null,
  phone: null,
  code_phone: ''
})

const phoneCodeOptions = computed(() =>
  PHONE_CODES.map((p) => ({ value: p.code, label: `${p.country} (${p.code})` }))
)

const identifications = ref<UserIdentification[]>([])

const formRoleOptions = computed(() =>
  USER_ROLES.map((r) => ({ value: r, label: USER_ROLE_LABELS[r] }))
)

function onProfileImageChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file && file.type.startsWith('image/')) {
    form.value.profile_image = file
  }
  input.value = ''
}

function resetForm() {
  error.value = ''
  form.value = {
    email: props.user?.email && props.user.email !== '-' ? props.user.email : '',
    names: props.user?.names ?? props.user?.name ?? '',
    lastnames: props.user?.lastnames ?? '',
    role: props.user?.role ?? props.defaultRole,
    document_number: props.user?.document_number ?? '',
    document_type: props.user?.document_type ?? '',
    profile_image: null,
    phone: props.user?.phone ?? null,
    code_phone: props.user?.code_phone ?? ''
  }
  // El parser garantiza que `identifications` ya incluya el documento heredado
  // como identificación principal, así que basta con clonar la lista.
  identifications.value = (props.user?.identifications ?? []).map((item) => ({ ...item }))
  detailError.value = ''
}

/**
 * Al editar, la fila de la lista puede traer una colección de identificaciones
 * incompleta. Recargamos el detalle canónico para no sobrescribir (borrar) las
 * que no se ven al guardar. Guardas de carrera: si el modal se cierra o se
 * reabre para otro usuario mientras llega la respuesta, se descarta.
 */
async function hydrateFromDetail(id: string) {
  loadingDetail.value = true
  detailError.value = ''
  try {
    const detail = await fetchUserById(id)
    if (!props.modelValue || props.user?.id !== id) return
    if (detail) {
      identifications.value = detail.identifications.map((item) => ({ ...item }))
    }
  } catch {
    if (props.modelValue && props.user?.id === id) {
      detailError.value =
        'No se pudieron cargar todas las identificaciones. Revísalas antes de guardar para no borrar datos existentes.'
    }
  } finally {
    if (props.user?.id === id) loadingDetail.value = false
  }
}

function close() {
  expandedFromQuick.value = false
  emit('update:modelValue', false)
}

async function handleSubmit() {
  // Evita guardar con la colección parcial mientras aún llega el detalle.
  if (loadingDetail.value) return
  if (isQuick.value && !form.value.names?.trim()) {
    error.value = 'El nombre es obligatorio.'
    return
  }
  creating.value = true
  error.value = ''
  try {
    // Sin espacios internos: "130 028 633 43" y "13002863343" son el mismo documento.
    const normalizedIdentifications = identifications.value.map((item) => ({
      document_type: item.document_type.trim(),
      document_number: item.document_number.replace(/\s+/g, ''),
      is_primary: item.is_primary
    }))
    if (normalizedIdentifications.some((item) => !item.document_type || !item.document_number)) {
      error.value = 'Completa el tipo y número de cada identificación'
      return
    }
    const uniqueDocuments = new Set(
      normalizedIdentifications.map((item) => `${item.document_type.toLowerCase()}:${item.document_number.toLowerCase()}`)
    )
    if (uniqueDocuments.size !== normalizedIdentifications.length) {
      error.value = 'No puedes registrar la misma identificación más de una vez'
      return
    }
    // Garantiza exactamente una identificación principal antes de enviar.
    let primaryAssigned = false
    for (const item of normalizedIdentifications) {
      item.is_primary = item.is_primary && !primaryAssigned
      if (item.is_primary) primaryAssigned = true
    }
    if (!primaryAssigned && normalizedIdentifications[0]) {
      normalizedIdentifications[0].is_primary = true
    }
    const primaryIdentification = normalizedIdentifications.find((item) => item.is_primary)
    const role = props.showRoleField ? form.value.role : props.defaultRole
    const email = form.value.email?.trim()
    const payload: CreateUserPayload = {
      ...form.value,
      role,
      email: email || undefined,
      identifications: normalizedIdentifications,
      document_type: primaryIdentification?.document_type,
      document_number: primaryIdentification?.document_number
    }
    const user = isEditing.value
      ? await updateUser({
          ...(payload as Omit<UpdateUserPayload, 'id'>),
          id: props.user?.id ?? ''
        })
      : await createUser(payload)
    emit('created', user)
    close()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al crear usuario'
  } finally {
    creating.value = false
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    resetForm()
    if (props.user?.id) void hydrateFromDetail(props.user.id)
  }
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-xl">
        <h2 class="mb-6 text-lg font-semibold text-[#1f2937]">
          {{ isEditing ? 'Editar usuario' : isQuick ? 'Cliente nuevo' : 'Nuevo usuario' }}
        </h2>
        <p v-if="isQuick" class="-mt-4 mb-6 text-sm text-[#6b7280]">
          Solo el nombre es obligatorio. Queda como <strong>perfil incompleto</strong>
          y se puede usar en la transacción de inmediato.
        </p>

        <form class="space-y-6" @submit.prevent="handleSubmit">
          <div class="grid gap-4 sm:grid-cols-2">
            <div v-if="!isQuick">
              <label class="mb-1.5 block text-sm font-medium text-[#374151]">
                Email (opcional)
              </label>
              <input
                v-model="form.email"
                type="text"
                inputmode="email"
                autocomplete="email"
                class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                placeholder="usuario@ejemplo.com"
              />
            </div>
            <div :class="isQuick ? 'sm:col-span-2' : ''">
              <label class="mb-1.5 block text-sm font-medium text-[#374151]">
                {{ isQuick ? 'Nombre o razón social' : 'Nombres' }}
                <span v-if="isQuick" class="text-[#dc2626]">*</span>
              </label>
              <input
                v-model="form.names"
                type="text"
                class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                :placeholder="isQuick ? 'Esperanza Tello' : 'Nombres'"
              />
              <p v-if="isQuick" class="mt-1.5 text-xs text-[#6b7280]">
                Como lo escriben en el grupo de WhatsApp. Se corrige después.
              </p>
            </div>
            <div v-if="!isQuick">
              <label class="mb-1.5 block text-sm font-medium text-[#374151]">Apellidos</label>
              <input
                v-model="form.lastnames"
                type="text"
                class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                placeholder="Apellidos"
              />
            </div>
            <div v-if="showRoleField">
              <label class="mb-1.5 block text-sm font-medium text-[#374151]">Rol</label>
              <AppDropdown
                v-model="form.role"
                :options="formRoleOptions"
                placeholder="Seleccionar"
                :searchable="false"
              />
            </div>
            <UserIdentificationsEditor v-if="!isQuick" v-model="identifications" />
            <p v-if="loadingDetail" class="-mt-1 text-xs text-[#6b7280] sm:col-span-2">
              Cargando identificaciones del usuario…
            </p>
            <p v-else-if="detailError" class="-mt-1 text-xs text-[#dc3545] sm:col-span-2">
              {{ detailError }}
            </p>
            <div v-if="!isQuick">
              <label class="mb-1.5 block text-sm font-medium text-[#374151]">Código tel.</label>
              <AppDropdown
                v-model="form.code_phone"
                :options="phoneCodeOptions"
                placeholder="Seleccionar"
                searchable
              />
            </div>
            <div :class="isQuick ? 'sm:col-span-2' : ''">
              <label class="mb-1.5 block text-sm font-medium text-[#374151]">
                Teléfono <span v-if="isQuick" class="text-xs text-[#6b7280]">(opcional)</span>
              </label>
              <input
                v-model.number="form.phone"
                type="number"
                class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                placeholder="987654321"
              />
            </div>
            <div v-if="!isQuick" class="sm:col-span-2">
              <label class="mb-1.5 block text-sm font-medium text-[#374151]">
                Foto de perfil (opcional)
              </label>
              <input
                type="file"
                accept="image/*"
                class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-brasper-indigoStrong file:px-4 file:py-2 file:text-sm file:text-white file:hover:bg-brasper-indigoDark"
                @change="onProfileImageChange"
              />
            </div>
          </div>

          <div
            v-if="isQuick"
            class="rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-xs text-[#9a3412]"
          >
            <p>
              Email, apellidos, documento y cuenta bancaria quedan pendientes. El
              cliente aparecerá como «perfil incompleto» en Usuarios hasta que
              alguien los complete.
            </p>
            <button
              type="button"
              class="mt-2 font-semibold underline underline-offset-2 hover:no-underline"
              @click="expandedFromQuick = true"
            >
              ¿Tienes todos los datos? Completar el perfil ahora
            </button>
          </div>

          <p v-if="error" class="rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]">
            {{ error }}
          </p>

          <div class="flex flex-wrap justify-end gap-3 border-t border-[#e5e7eb] pt-6">
            <button
              type="button"
              class="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#6b7280] transition hover:bg-[#f9fafb]"
              @click="close"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="rounded-lg bg-brasper-indigoStrong px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brasper-indigoDark disabled:opacity-60"
              :disabled="creating || loadingDetail"
            >
              {{ creating ? (isEditing ? 'Guardando...' : 'Creando...') : 'Guardar' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
