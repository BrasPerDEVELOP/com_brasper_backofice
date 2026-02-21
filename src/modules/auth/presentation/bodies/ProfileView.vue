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

      <div v-if="authStore.user" class="space-y-4">
        <div class="flex flex-wrap items-start gap-6">
          <div class="flex shrink-0 flex-col items-center gap-2">
            <div
              v-if="authStore.user.profile_image"
              class="flex h-28 w-28 overflow-hidden rounded-full border-2 border-[#dbe7fb] bg-[#fbfdff] sm:h-32 sm:w-32"
            >
              <img
                :src="authStore.user.profile_image"
                :alt="authStore.user.name"
                class="h-full w-full object-cover"
              />
            </div>
            <div
              v-else
              class="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-2 border-[#dbe7fb] bg-gradient-to-br from-[#4A52D8]/20 to-[#007aff]/20 text-3xl font-bold text-[#232b4d] sm:h-32 sm:w-32"
            >
              {{ initials }}
            </div>
            <label
              class="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-[#4A52D8]/40 bg-[#4A52D8]/5 px-6 py-4 transition hover:border-[#4A52D8]/60 hover:bg-[#4A52D8]/10"
            >
              <span class="text-sm font-medium text-[#3C4DA7]">{{ authStore.user.profile_image ? 'Cambiar foto' : 'Subir foto' }}</span>
              <span class="text-xs text-[#666]">PNG, JPG hasta 5MB</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                class="hidden"
                :disabled="authStore.isLoading"
                @change="onImageSelected"
              />
            </label>
          </div>
          <div class="min-w-0 flex-1 space-y-4">
            <!-- Modo edición -->
            <template v-if="isEditing">
              <div>
                <label class="mb-1 block text-xs font-medium text-[#666]">Nombres</label>
                <input
                  v-model="form.names"
                  type="text"
                  class="w-full rounded-xl border border-[#cfdbef] bg-white px-4 py-3 text-sm text-[#333] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
                  placeholder="Nombres"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-[#666]">Apellidos</label>
                <input
                  v-model="form.lastnames"
                  type="text"
                  class="w-full rounded-xl border border-[#cfdbef] bg-white px-4 py-3 text-sm text-[#333] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
                  placeholder="Apellidos"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-[#666]">Email</label>
                <input
                  :value="authStore.user.email"
                  type="text"
                  disabled
                  class="w-full cursor-not-allowed rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-sm text-[#666]"
                />
                <p class="mt-1 text-xs text-[#666]">El email no se puede modificar</p>
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-[#666]">Número de documento</label>
                <input
                  v-model="form.document_number"
                  type="text"
                  class="w-full rounded-xl border border-[#cfdbef] bg-white px-4 py-3 text-sm text-[#333] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
                  placeholder="Documento"
                />
              </div>
              <div class="flex gap-3 pt-2">
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
            <!-- Modo visualización -->
            <template v-else>
              <div class="rounded-xl border border-[#dbe7fb] bg-[#fbfdff] px-4 py-3">
                <p class="text-xs font-medium text-[#666]">Nombre</p>
                <p class="mt-0.5 font-medium text-[#232b4d]">{{ authStore.user.name }}</p>
              </div>
              <div class="rounded-xl border border-[#dbe7fb] bg-[#fbfdff] px-4 py-3">
                <p class="text-xs font-medium text-[#666]">Email</p>
                <p class="mt-0.5 font-medium text-[#232b4d]">{{ authStore.user.email }}</p>
              </div>
            </template>
          </div>
        </div>

        <div v-if="!isEditing" class="grid gap-3 sm:grid-cols-2">
          <div v-if="authStore.user.document_number" class="rounded-xl border border-[#dbe7fb] bg-[#fbfdff] px-4 py-3">
            <p class="text-xs font-medium text-[#666]">Documento</p>
            <p class="mt-0.5 font-medium text-[#232b4d]">{{ authStore.user.document_number }}</p>
          </div>
          <div v-if="authStore.user.role" class="rounded-xl border border-[#dbe7fb] bg-[#fbfdff] px-4 py-3">
            <p class="text-xs font-medium text-[#666]">Rol</p>
            <p class="mt-0.5">
              <span class="inline-flex items-center rounded-full bg-[#e6ff00]/30 px-2.5 py-0.5 text-sm font-semibold text-[#232b4d]">
                {{ authStore.user.role.toUpperCase() }}
              </span>
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
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '../controllers/useAuthStore'

const authStore = useAuthStore()
const isEditing = ref(false)

const form = ref({
  names: '',
  lastnames: '',
  document_number: ''
})

watch(
  () => authStore.user,
  (user) => {
    if (user) {
      form.value = {
        names: user.names ?? '',
        lastnames: user.lastnames ?? '',
        document_number: user.document_number ?? ''
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
      document_number: authStore.user.document_number ?? ''
    }
    isEditing.value = true
  }
}

function cancelEditing() {
  isEditing.value = false
}

async function saveProfile() {
  try {
    await authStore.updateProfile({
      names: form.value.names.trim() || null,
      lastnames: form.value.lastnames.trim() || null,
      document_number: form.value.document_number.trim() || null
    })
    isEditing.value = false
  } catch {
    // Error ya mostrado en authStore.error
  }
}

async function onImageSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    authStore.error = 'La imagen no debe superar 5MB'
    return
  }
  try {
    await authStore.uploadProfileImage(file)
    input.value = ''
  } catch {
    // Error ya mostrado en authStore.error
  }
}
</script>
