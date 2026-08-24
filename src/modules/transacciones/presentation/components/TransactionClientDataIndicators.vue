<script setup lang="ts">
import { BadgePlus, Landmark, MailWarning, PhoneOff } from '@lucide/vue'
import { AppTooltip } from '@interface/widgets'
import type { MissingClientData } from '../../domain/client_data_indicators'

const props = defineProps<{
  missing: MissingClientData[]
  canCreateBankAccount: boolean
}>()

const emit = defineEmits<{
  addBankAccount: []
}>()

function isMissing(field: MissingClientData): boolean {
  return props.missing.includes(field)
}
</script>

<template>
  <span
    v-if="missing.length"
    class="inline-flex shrink-0 items-center gap-0.5"
    aria-label="Datos pendientes del cliente"
  >
    <AppTooltip v-if="isMissing('email')" label="Falta registrar el correo">
      <MailWarning class="h-3.5 w-3.5 text-amber-600" :stroke-width="2" aria-hidden="true" />
    </AppTooltip>

    <AppTooltip v-if="isMissing('phone')" label="Falta registrar el teléfono">
      <PhoneOff class="h-3.5 w-3.5 text-amber-600" :stroke-width="2" aria-hidden="true" />
    </AppTooltip>

    <AppTooltip
      v-if="isMissing('bank_account')"
      :label="
        canCreateBankAccount
          ? 'No tiene cuentas bancarias. Agregar una cuenta'
          : 'No tiene cuentas bancarias registradas'
      "
      :interactive="canCreateBankAccount"
      @click="emit('addBankAccount')"
    >
      <BadgePlus
        v-if="canCreateBankAccount"
        class="h-3.5 w-3.5 text-brasper-indigoStrong"
        :stroke-width="2"
        aria-hidden="true"
      />
      <Landmark v-else class="h-3.5 w-3.5 text-amber-600" :stroke-width="2" aria-hidden="true" />
    </AppTooltip>
  </span>
</template>
