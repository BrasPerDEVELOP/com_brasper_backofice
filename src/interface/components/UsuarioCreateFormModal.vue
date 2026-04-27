<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  createUser,
  updateUser,
  USER_ROLES,
  type CreateUserPayload,
  type UpdateUserPayload,
  type UserListItem
} from '@/modules/auth/infrastructure/adapters/users_management_api_adapter'
import { USER_ROLE_LABELS, PHONE_CODES } from '@/modules/auth/domain/models'
import AppDropdown from '@/interface/components/AppDropdown.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    /** Rol por defecto (ej. 'client' para nuevo cliente). */
    defaultRole?: string
    /** Si true, muestra el selector de rol. Si false, usa defaultRole. */
    showRoleField?: boolean
    user?: UserListItem | null
  }>(),
  {
    defaultRole: 'client',
    showRoleField: false,
    user: null
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  created: [user: UserListItem]
}>()

const creating = ref(false)
const error = ref('')
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

const documentTypeOptions = [
  { value: 'dni', label: 'DNI' },
  { value: 'ce', label: 'CE' },
  { value: 'passport', label: 'Pasaporte' },
  { value: 'ruc', label: 'RUC' },
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'other', label: 'Otro' }
]

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
}

function close() {
  emit('update:modelValue', false)
}

async function handleSubmit() {
  if (!isEditing.value && !form.value.email?.trim()) {
    error.value = 'Email es obligatorio'
    return
  }
  creating.value = true
  error.value = ''
  try {
    const role = props.showRoleField ? form.value.role : props.defaultRole
    const payload: CreateUserPayload = {
      ...form.value,
      role
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
    if (visible) resetForm()
  }
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="close"
    >
      <div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-xl">
        <h2 class="mb-6 text-lg font-semibold text-[#1f2937]">
          {{ isEditing ? 'Editar usuario' : 'Nuevo usuario' }}
        </h2>

        <form class="space-y-6" @submit.prevent="handleSubmit">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-[#374151]">
                Email {{ isEditing ? '' : '*' }}
              </label>
              <input
                v-model="form.email"
                type="email"
                class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                placeholder="usuario@ejemplo.com"
                :required="!isEditing"
              />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-[#374151]">Nombres</label>
              <input
                v-model="form.names"
                type="text"
                class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                placeholder="Nombres"
              />
            </div>
            <div>
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
            <div>
              <label class="mb-1.5 block text-sm font-medium text-[#374151]">N. documento</label>
              <input
                v-model="form.document_number"
                type="text"
                class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                placeholder="Ej. 12345678"
              />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-[#374151]">Tipo documento</label>
              <AppDropdown
                v-model="form.document_type"
                :options="documentTypeOptions"
                placeholder="Seleccionar"
                :searchable="false"
              />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-[#374151]">Código tel.</label>
              <AppDropdown
                v-model="form.code_phone"
                :options="phoneCodeOptions"
                placeholder="Seleccionar"
                searchable
              />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-[#374151]">Teléfono</label>
              <input
                v-model.number="form.phone"
                type="number"
                class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                placeholder="987654321"
              />
            </div>
            <div class="sm:col-span-2">
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
              :disabled="creating"
            >
              {{ creating ? (isEditing ? 'Guardando...' : 'Creando...') : 'Guardar' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
