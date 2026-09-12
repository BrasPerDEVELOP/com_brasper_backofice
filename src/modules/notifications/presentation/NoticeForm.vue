<script setup lang="ts">
import { ref, shallowRef, onMounted } from 'vue'
import { notificationsApi } from '../infrastructure/notifications_api_adapter'
import type { StaffMember } from '../domain/notification'
const emit = defineEmits<{ created: []; cancel: [] }>()
const title = shallowRef('')
const body = shallowRef('')
const recipients = ref<string[]>([])
const staff = shallowRef<StaffMember[]>([])
const busy = shallowRef(false)
const error = shallowRef('')
onMounted(async () => {
  try {
    staff.value = await notificationsApi.staff()
  } catch {
    error.value = 'No se pudo cargar el equipo interno.'
  }
})
async function submit() {
  if (busy.value || !title.value.trim() || !body.value.trim() || !recipients.value.length) return
  busy.value = true
  try {
    await notificationsApi.create({
      title: title.value.trim(),
      body: body.value.trim(),
      recipient_user_ids: recipients.value
    })
    emit('created')
  } catch {
    error.value = 'No se pudo publicar el aviso.'
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <form class="space-y-3 p-4" @submit.prevent="submit">
    <label class="block text-sm"
      >Título<input v-model="title" required maxlength="200" class="w-full rounded border p-2"
    /></label>
    <label class="block text-sm"
      >Mensaje<textarea
        v-model="body"
        required
        maxlength="10000"
        class="w-full rounded border p-2"
      />
    </label>
    <label class="block text-sm"
      >Destinatarios<select
        v-model="recipients"
        required
        multiple
        class="h-28 w-full rounded border p-2"
      >
        <option v-for="person in staff" :key="person.id" :value="person.id">
          {{ person.name }} — {{ person.role }}
        </option>
      </select></label
    >
    <p v-if="error" role="alert" class="text-sm text-red-700">{{ error }}</p>
    <div class="flex gap-3">
      <button :disabled="busy" class="rounded bg-indigo-700 px-3 py-2 text-white">
        Publicar aviso</button
      ><button type="button" @click="emit('cancel')">Cancelar</button>
    </div>
  </form>
</template>
