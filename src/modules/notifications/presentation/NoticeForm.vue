<script setup lang="ts">
import { ref, shallowRef, onMounted, computed } from 'vue'
import { notificationsApi } from '../infrastructure/notifications_api_adapter'
import type { StaffMember } from '../domain/notification'
import NoticeHtmlEditor from './NoticeHtmlEditor.vue'
import { USER_ROLE_LABELS } from '@/modules/auth/domain/models'
const audience = ref<'users' | 'roles' | 'all'>('users')
const roles = ref<string[]>([])
const roleOptions = computed(() => [...new Set(staff.value.map(person => person.role))])
const recipientCount = computed(() => staff.value.filter(person => audience.value === 'all' || (audience.value === 'roles' ? roles.value.includes(person.role) : recipients.value.includes(person.id))).length)
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
  if (busy.value || !title.value.trim() || !body.value.trim() || !recipientCount.value) return
  busy.value = true
  try {
    error.value = ''
    await notificationsApi.create({
      title: title.value.trim(),
      body: body.value.trim(),
      recipient_user_ids: audience.value === 'users' ? recipients.value : [],
      audience: audience.value,
      roles: audience.value === 'roles' ? roles.value : [],
      body_format: 'html'
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
    <div class="space-y-1"><span class="text-sm">Mensaje</span><NoticeHtmlEditor v-model="body" /></div>
    <label class="block text-sm">Enviar a
      <select v-model="audience" aria-label="Enviar a" class="w-full rounded border p-2">
        <option value="users">Usuarios</option><option value="roles">Roles</option><option value="all">Todo el equipo</option>
      </select>
    </label>
    <label v-if="audience === 'roles'" class="block text-sm">Roles
      <select v-model="roles" aria-label="Roles" multiple required class="h-28 w-full rounded border p-2">
        <option v-for="role in roleOptions" :key="role" :value="role">{{ USER_ROLE_LABELS[role as keyof typeof USER_ROLE_LABELS] ?? role }}</option>
      </select>
    </label>
    <label v-if="audience === 'users'" class="block text-sm"
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
    <p class="text-xs text-gray-500">{{ recipientCount }} destinatarios internos activos. No incluye clientes.</p>
    <p v-if="error" role="alert" class="text-sm text-red-700">{{ error }}</p>
    <div class="flex gap-3">
      <button :disabled="busy || !recipientCount || body.length > 10000" class="rounded bg-indigo-700 px-3 py-2 text-white">
        Publicar aviso</button
      ><button type="button" @click="emit('cancel')">Cancelar</button>
    </div>
  </form>
</template>
