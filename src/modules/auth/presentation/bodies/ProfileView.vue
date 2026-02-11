<template>
  <div class="space-y-6">
    <section class="rounded-lg bg-white p-6 shadow-sm">
      <h1 class="text-2xl font-semibold text-on-surface">Perfil</h1>
      <p class="mt-2 text-on-surface/80">
        Datos del usuario. Aquí se mostrará nombre, email y opciones de edición.
      </p>
      <div v-if="authStore.user" class="mt-4 rounded bg-surface-alt p-4">
        <p><span class="font-medium">Email:</span> {{ authStore.user.email }}</p>
        <p><span class="font-medium">Nombre:</span> {{ authStore.user.name }}</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '../controllers/useAuthStore'

const authStore = useAuthStore()
</script>
