<script setup lang="ts">
defineProps<{ id: string; disabled?: boolean }>()
const model = defineModel<string | null>({ default: '' })
function updatePhone(event: Event) {
  const input = event.target as HTMLInputElement
  if (/^[0-9]*$/.test(input.value)) model.value = input.value
  else input.value = model.value ?? ''
}
</script>

<template>
  <input :id="id" :value="model ?? ''" :disabled="disabled" type="tel" inputmode="numeric"
    pattern="[0-9]*" maxlength="100" autocomplete="tel-national" placeholder="987654321"
    title="Solo números del 0 al 9. El usuario de WhatsApp va en su propio campo."
    class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm focus:border-brasper-indigoStrong focus:outline-none"
    @input="updatePhone" />
</template>
