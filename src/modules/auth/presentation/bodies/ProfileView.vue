<template>
  <div class="space-y-6">
    <section class="rounded-2xl border border-[#d8e5fb] bg-white p-6 shadow-lg shadow-[#007bff]/5">
      <div class="mb-4">
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#066ac9]">Cuenta</p>
        <h1 class="text-2xl font-semibold text-[#232b4d]">Perfil de usuario</h1>
      </div>

      <div v-if="authStore.user" class="space-y-4">
        <div class="flex flex-wrap items-start gap-4">
          <div
            v-if="authStore.user.profile_image"
            class="flex h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-[#dbe7fb] bg-[#fbfdff]"
          >
            <img
              :src="authStore.user.profile_image"
              :alt="authStore.user.name"
              class="h-full w-full object-cover"
            />
          </div>
          <div
            v-else
            class="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-[#dbe7fb] bg-gradient-to-br from-[#4A52D8]/20 to-[#007aff]/20 text-2xl font-bold text-[#232b4d]"
          >
            {{ initials }}
          </div>
          <div class="min-w-0 flex-1 space-y-2">
            <div class="rounded-xl border border-[#dbe7fb] bg-[#fbfdff] px-4 py-3">
              <p class="text-xs font-medium text-[#666]">Nombre</p>
              <p class="mt-0.5 font-medium text-[#232b4d]">{{ authStore.user.name }}</p>
            </div>
            <div class="rounded-xl border border-[#dbe7fb] bg-[#fbfdff] px-4 py-3">
              <p class="text-xs font-medium text-[#666]">Email</p>
              <p class="mt-0.5 font-medium text-[#232b4d]">{{ authStore.user.email }}</p>
            </div>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
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
import { computed } from 'vue'
import { useAuthStore } from '../controllers/useAuthStore'

const authStore = useAuthStore()

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
</script>
