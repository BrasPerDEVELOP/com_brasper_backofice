<template>
  <div class="space-y-6">
    <section class="overflow-hidden rounded-3xl border border-[#d8e5fb] bg-white p-8 shadow-lg shadow-[#007bff]/5">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#066ac9]">Cuenta</p>
          <h1 class="text-2xl font-semibold text-[#232b4d]">Perfil de usuario</h1>
        </div>
        <button
          v-if="authStore.user && !isEditing"
          type="button"
          class="rounded-xl border border-[#4A52D8]/30 bg-[#4A52D8]/10 px-4 py-2.5 text-sm font-medium text-[#3C4DA7] transition hover:bg-[#4A52D8]/20"
          @click="startEditing"
        >
          Editar
        </button>
      </div>

      <p v-if="authStore.error" class="mb-4 rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]">
        {{ authStore.error }}
      </p>

      <div v-if="authStore.user" class="space-y-8">
        <div class="flex flex-col gap-8 sm:flex-row sm:items-start">
          <div class="flex shrink-0 flex-col items-center gap-2">
            <label
              :class="[
                'flex h-28 w-28 shrink-0 overflow-hidden rounded-full border-2 sm:h-32 sm:w-32',
                isEditing
                  ? 'cursor-pointer border-dashed border-[#4A52D8]/50 bg-[#fbfdff] hover:border-[#4A52D8]'
                  : 'cursor-default border-[#dbe7fb] bg-[#fbfdff]'
              ]"
            >
              <input
                v-if="isEditing"
                type="file"
                accept="image/*"
                class="hidden"
                @change="onFileSelect"
              />
              <img
                v-if="avatarPreview"
                :src="avatarPreview"
                :alt="authStore.user.name"
                class="h-full w-full object-cover"
                @error="onImageError"
              />
              <div
                v-else
                class="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#4A52D8]/20 to-[#007aff]/20 text-3xl font-bold text-[#232b4d]"
              >
                {{ initials }}
              </div>
            </label>
            <p v-if="isEditing" class="text-xs text-[#666]">Clic para cambiar foto</p>
          </div>
          <div class="min-w-0 flex-1 max-w-2xl">
            <template v-if="isEditing">
              <div class="grid gap-3 sm:grid-cols-2">
                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-[#666]">Nombres</label>
                  <input
                    v-model="form.names"
                    type="text"
                    class="w-full rounded-xl border border-[#cfdbef] bg-white px-4 py-3 text-sm text-[#333] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
                    placeholder="Nombres"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-[#666]">Apellidos</label>
                  <input
                    v-model="form.lastnames"
                    type="text"
                    class="w-full rounded-xl border border-[#cfdbef] bg-white px-4 py-3 text-sm text-[#333] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
                    placeholder="Apellidos"
                  />
                </div>
              </div>
              <div class="mt-5 space-y-1.5">
                <label class="block text-xs font-medium text-[#666]">Email</label>
                <input
                  :value="authStore.user.email"
                  type="text"
                  disabled
                  class="w-full cursor-not-allowed rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-sm text-[#666]"
                />
                <p class="mt-1.5 text-xs text-[#666]">El email no se puede modificar</p>
              </div>
              <div class="mt-5 grid gap-3 sm:grid-cols-2">
                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-[#666]">Número de documento</label>
                  <input
                    v-model="form.document_number"
                    type="text"
                    class="w-full rounded-xl border border-[#cfdbef] bg-white px-4 py-3 text-sm text-[#333] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
                    placeholder="Documento"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-[#666]">Tipo de documento</label>
                  <select
                    v-model="form.document_type"
                    class="w-full rounded-xl border border-[#cfdbef] bg-white px-4 py-3 text-sm text-[#333] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
                  >
                    <option value="">Seleccionar</option>
                    <option value="dni">DNI</option>
                    <option value="ce">CE</option>
                    <option value="passport">Pasaporte</option>
                  </select>
                </div>
              </div>
              <div v-if="!isRoleClient" class="mt-5 space-y-1.5">
                <label class="block text-xs font-medium text-[#666]">Rol</label>
                <input
                  :value="authStore.user.role"
                  type="text"
                  disabled
                  class="w-full cursor-not-allowed rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-sm text-[#666]"
                />
                <p class="mt-1.5 text-xs text-[#666]">El rol no se puede modificar</p>
              </div>
              <div class="mt-5 grid gap-3 sm:grid-cols-2">
                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-[#666]">Código de teléfono</label>
                  <input
                    v-model="form.code_phone"
                    type="text"
                    class="w-full rounded-xl border border-[#cfdbef] bg-white px-4 py-3 text-sm text-[#333] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
                    placeholder="Ej: pe, +51"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-[#666]">Teléfono</label>
                  <input
                    v-model.number="form.phone"
                    type="number"
                    class="w-full rounded-xl border border-[#cfdbef] bg-white px-4 py-3 text-sm text-[#333] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
                    placeholder="987654321"
                  />
                </div>
              </div>
              <div class="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  class="rounded-xl bg-gradient-to-r from-[#10b981] to-[#5ED6B3] px-5 py-2.5 text-sm font-semibold text-[#06271d] transition hover:opacity-90 disabled:opacity-60"
                  :disabled="authStore.isLoading"
                  @click="saveProfile"
                >
                  {{ authStore.isLoading ? 'Guardando...' : 'Guardar' }}
                </button>
                <button
                  type="button"
                  class="rounded-xl border border-[#4A52D8]/30 bg-white px-5 py-2.5 text-sm font-medium text-[#3C4DA7] transition hover:bg-[#4A52D8]/10"
                  :disabled="authStore.isLoading"
                  @click="cancelEditing"
                >
                  Cancelar
                </button>
              </div>
            </template>
            <template v-else>
              <div class="space-y-4">
                <div class="rounded-xl border border-[#dbe7fb] bg-[#fbfdff] px-4 py-3">
                  <p class="text-xs font-medium text-[#666]">Nombre</p>
                  <p class="mt-1 font-medium text-[#232b4d]">{{ authStore.user.name }}</p>
                </div>
                <div class="rounded-xl border border-[#dbe7fb] bg-[#fbfdff] px-4 py-3">
                  <p class="text-xs font-medium text-[#666]">Email</p>
                  <p class="mt-1 font-medium text-[#232b4d]">{{ authStore.user.email }}</p>
                </div>
              </div>
            </template>
          </div>
        </div>

        <div v-if="!isEditing" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div v-if="authStore.user.document_number" class="rounded-xl border border-[#dbe7fb] bg-[#fbfdff] px-4 py-3">
            <p class="text-xs font-medium text-[#666]">Documento</p>
            <p class="mt-1 font-medium text-[#232b4d]">{{ authStore.user.document_number }}</p>
          </div>
          <div v-if="authStore.user.document_type" class="rounded-xl border border-[#dbe7fb] bg-[#fbfdff] px-4 py-3">
            <p class="text-xs font-medium text-[#666]">Tipo de documento</p>
            <p class="mt-1 font-medium text-[#232b4d]">{{ authStore.user.document_type.toUpperCase() }}</p>
          </div>
          <div v-if="authStore.user.role && !isRoleClient" class="rounded-xl border border-[#dbe7fb] bg-[#fbfdff] px-4 py-3">
            <p class="text-xs font-medium text-[#666]">Rol</p>
            <p class="mt-1">
              <span class="inline-flex items-center rounded-full bg-[#e6ff00]/30 px-2.5 py-0.5 text-sm font-semibold text-[#232b4d]">
                {{ authStore.user.role.toUpperCase() }}
              </span>
            </p>
          </div>
          <div v-if="authStore.user.phone != null || authStore.user.code_phone" class="rounded-xl border border-[#dbe7fb] bg-[#fbfdff] px-4 py-3">
            <p class="text-xs font-medium text-[#666]">Teléfono</p>
            <p class="mt-1 font-medium text-[#232b4d]">
              {{ [authStore.user.code_phone, authStore.user.phone].filter(Boolean).join(' ') || '—' }}
            </p>
          </div>
        </div>
      </div>

      <p v-else class="rounded-lg bg-[#dc3545]/10 px-3 py-2 text-sm text-[#dc3545]">
        No hay datos de usuario disponibles.
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { Domain } from '@/interface/infrastructure/services'
import type { User } from '../../domain/models'
import { useAuthStore } from '../controllers/useAuthStore'

const authStore = useAuthStore()

const isRoleClient = computed(() => {
  const r = authStore.user?.role?.toLowerCase()
  return r === 'client' || r === 'cliente'
})

onMounted(() => {
  authStore.restoreSession()
})

const imageError = ref(false)

function onImageError() {
  imageError.value = true
}

const isEditing = ref(false)

const form = ref<{
  names: string
  lastnames: string
  document_number: string
  document_type: string
  phone: number | ''
  code_phone: string
  profile_image: File | null
}>({
  names: '',
  lastnames: '',
  document_number: '',
  document_type: '',
  phone: '',
  code_phone: '',
  profile_image: null
})

const avatarPreviewUrl = ref('')

watch(
  () => form.value.profile_image,
  (file: File | null) => {
    if (avatarPreviewUrl.value) {
      URL.revokeObjectURL(avatarPreviewUrl.value)
      avatarPreviewUrl.value = ''
    }
    if (file) {
      avatarPreviewUrl.value = URL.createObjectURL(file)
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (avatarPreviewUrl.value) URL.revokeObjectURL(avatarPreviewUrl.value)
})

const avatarPreview = computed(() => {
  if (avatarPreviewUrl.value) return avatarPreviewUrl.value
  if (authStore.user?.profile_image && !imageError.value) {
    return Domain.mediaUrl(authStore.user.profile_image)
  }
  return ''
})

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file && file.type.startsWith('image/')) {
    form.value.profile_image = file
  }
  input.value = ''
}

watch(
  () => authStore.user,
  (user: User | null) => {
    imageError.value = false
    if (user) {
      form.value = {
        names: user.names ?? '',
        lastnames: user.lastnames ?? '',
        document_number: user.document_number ?? '',
        document_type: user.document_type ?? '',
        phone: user.phone ?? '',
        code_phone: user.code_phone ?? '',
        profile_image: null
      }
    }
  },
  { immediate: true }
)

const initials = computed(() => {
  const user = authStore.user
  if (!user) return '?'
  const parts = user.name.trim().split(/\s+/)
  if (parts.length >= 2) {
    const a = parts[0]?.[0] ?? ''
    const b = parts[parts.length - 1]?.[0] ?? ''
    return (a + b || '?').toUpperCase()
  }
  return (user.name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()
})

function startEditing() {
  if (authStore.user) {
    form.value = {
      names: authStore.user.names ?? '',
      lastnames: authStore.user.lastnames ?? '',
      document_number: authStore.user.document_number ?? '',
      document_type: authStore.user.document_type ?? '',
      phone: authStore.user.phone ?? '',
      code_phone: authStore.user.code_phone ?? '',
      profile_image: null
    }
    isEditing.value = true
  }
}

function cancelEditing() {
  form.value.profile_image = null
  isEditing.value = false
}

async function saveProfile() {
  try {
    await authStore.updateProfile({
      names: form.value.names.trim() || null,
      lastnames: form.value.lastnames.trim() || null,
      document_number: form.value.document_number.trim() || null,
      document_type: form.value.document_type.trim() || null,
      phone: form.value.phone === '' ? null : (Number.isFinite(Number(form.value.phone)) ? Number(form.value.phone) : null),
      code_phone: form.value.code_phone.trim() || null,
      profile_image: form.value.profile_image
    })
    form.value.profile_image = null
    isEditing.value = false
  } catch {
    // Error ya mostrado en authStore.error
  }
}
</script>
