<script setup lang="ts">
import { ref, watch } from 'vue'
import { resetUserPassword, type UserListItem } from '../../infrastructure/adapters/users_management_api_adapter'

const props = defineProps<{ user: UserListItem | null }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const password = ref('')
const confirmation = ref('')
const loading = ref(false)
const error = ref('')

watch(() => props.user, () => {
  password.value = ''
  confirmation.value = ''
  error.value = ''
})

async function submit() {
  if (!props.user) return
  const next = password.value.trim()
  const confirm = confirmation.value.trim()
  if (!next || !confirm) error.value = 'Completa la contraseña temporal y su confirmación'
  else if (next.length < 8) error.value = 'La contraseña temporal debe tener al menos 8 caracteres'
  else if (next !== confirm) error.value = 'La confirmación no coincide'
  else {
    loading.value = true
    error.value = ''
    try {
      await resetUserPassword({ userId: props.user.id, new_password: next })
      emit('saved')
      emit('close')
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Error al resetear contraseña'
    } finally {
      loading.value = false
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="user" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-md rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-xl">
        <h2 class="text-lg font-semibold text-[#1f2937]">Resetear contraseña</h2>
        <p class="mt-2 text-sm text-[#6b7280]">Se asignará una contraseña temporal para {{ user.name }}.</p>
        <form class="mt-5 space-y-4" @submit.prevent="submit">
          <label class="block text-sm font-medium text-[#374151]">Contraseña temporal<input v-model="password" type="password" minlength="8" autocomplete="new-password" class="mt-1 w-full rounded-lg border border-[#e5e7eb] px-4 py-2.5" required /></label>
          <label class="block text-sm font-medium text-[#374151]">Confirmar contraseña<input v-model="confirmation" type="password" minlength="8" autocomplete="new-password" class="mt-1 w-full rounded-lg border border-[#e5e7eb] px-4 py-2.5" required /></label>
          <p v-if="error" class="rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]">{{ error }}</p>
          <div class="flex justify-end gap-3 border-t border-[#e5e7eb] pt-4"><button type="button" class="rounded-lg border border-[#e5e7eb] px-4 py-2.5 text-sm" :disabled="loading" @click="emit('close')">Cancelar</button><button type="submit" class="rounded-lg bg-brasper-indigoStrong px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60" :disabled="loading">{{ loading ? 'Guardando...' : 'Guardar' }}</button></div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
