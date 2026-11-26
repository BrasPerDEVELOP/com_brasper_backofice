<script setup lang="ts">
import { computed } from 'vue'
import { normalizeWhatsAppUsername } from '@/modules/auth/domain/models/user_phone'

defineProps<{ id: string; disabled?: boolean }>()
const model = defineModel<string | null>({ default: '' })
const username = computed(() => (model.value ?? '').replace(/^@+/, ''))
function updateUsername(event: Event) {
  const input = event.target as HTMLInputElement
  const normalized = normalizeWhatsAppUsername(input.value) ?? ''
  input.value = normalized.replace(/^@/, '')
  model.value = normalized
}
</script>

<template>
  <div class="flex items-center rounded-lg border border-[#e5e7eb] bg-white focus-within:border-brasper-indigoStrong focus-within:ring-1 focus-within:ring-brasper-indigoStrong">
    <span aria-hidden="true" class="pl-3 text-sm text-[#6b7280]">@</span>
    <input :id="id" :value="username" :disabled="disabled" type="text" maxlength="100" @input="updateUsername"
      placeholder="usuario" autocomplete="off" autocapitalize="none" :spellcheck="false"
      class="min-w-0 w-full rounded-r-lg bg-transparent py-2.5 pl-1 pr-3 text-sm outline-none disabled:opacity-60" />
  </div>
</template>
