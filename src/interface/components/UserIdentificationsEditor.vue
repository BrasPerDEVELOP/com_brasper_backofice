<script setup lang="ts">
import { useId } from 'vue'
import type { UserIdentification } from '@/modules/auth/infrastructure/adapters/users_management_api_adapter'
import AppDropdown from '@/interface/components/AppDropdown.vue'

const identifications = defineModel<UserIdentification[]>({ required: true })

// Nombre único por instancia para que el grupo de radios "principal" no
// colisione si el editor se monta más de una vez en la misma página.
const primaryGroupName = useId()

const documentTypeOptions = [
  { value: 'dni', label: 'DNI' },
  { value: 'ce', label: 'CE' },
  { value: 'passport', label: 'Pasaporte' },
  { value: 'ruc', label: 'RUC' },
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'other', label: 'Otro' }
]

function addIdentification() {
  identifications.value = [
    ...identifications.value,
    { document_type: '', document_number: '', is_primary: identifications.value.length === 0 }
  ]
}

function removeIdentification(index: number) {
  const removedPrimary = identifications.value[index]?.is_primary
  const next = identifications.value.filter((_, itemIndex) => itemIndex !== index)
  const first = next[0]
  if (removedPrimary && first) next[0] = { ...first, is_primary: true }
  identifications.value = next
}

function setPrimary(index: number) {
  identifications.value = identifications.value.map((item, itemIndex) => ({
    ...item,
    is_primary: itemIndex === index
  }))
}
</script>

<template>
  <fieldset class="space-y-3 sm:col-span-2">
    <div class="flex items-center justify-between gap-3">
      <legend class="text-sm font-medium text-[#374151]">Identificaciones</legend>
      <button
        type="button"
        class="rounded-lg border border-brasper-indigoStrong px-3 py-1.5 text-sm font-medium text-brasper-indigoStrong transition hover:bg-brasper-indigoStrong/5"
        @click="addIdentification"
      >
        + Agregar identificación
      </button>
    </div>

    <p v-if="identifications.length === 0" class="rounded-lg border border-dashed border-[#d1d5db] p-3 text-sm text-[#6b7280]">
      El cliente todavía no tiene identificaciones registradas.
    </p>

    <div
      v-for="(identification, index) in identifications"
      :key="index"
      class="grid gap-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-3 sm:grid-cols-[1fr_1.4fr_auto]"
    >
      <AppDropdown
        v-model="identification.document_type"
        :options="documentTypeOptions"
        placeholder="Tipo de documento"
        :searchable="false"
      />
      <input
        v-model="identification.document_number"
        type="text"
        class="form-input w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm transition focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
        placeholder="Número de documento"
      />
      <button
        type="button"
        class="rounded-lg px-3 py-2 text-sm font-medium text-[#dc3545] transition hover:bg-[#dc3545]/10"
        aria-label="Eliminar identificación"
        @click="removeIdentification(index)"
      >
        Eliminar
      </button>
      <label class="flex items-center gap-2 text-sm text-[#4b5563] sm:col-span-3">
        <input
          type="radio"
          :name="primaryGroupName"
          :checked="identification.is_primary"
          @change="setPrimary(index)"
        />
        Identificación principal
      </label>
    </div>
  </fieldset>
</template>
