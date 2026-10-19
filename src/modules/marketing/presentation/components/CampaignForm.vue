<script setup lang="ts">
import { computed, reactive, shallowRef, onMounted, watch } from 'vue'
import CampaignPreview from './CampaignPreview.vue'
import type { CampaignInput, TemplateKey, EmailTemplate } from '../../domain/models'
import { parseRecipients } from '../../domain/recipients'
import { marketingActions } from '../../application/use_cases/marketing'
import { MarketingApiAdapter } from '../../infrastructure/marketing_api_adapter'
defineProps<{ busy: boolean }>()
const emit = defineEmits<{ save: [input: CampaignInput] }>()
const form = reactive({
  name: '',
  subject: '',
  body: '',
  emails: '',
  consent: false,
  template_key: 'brasper_peru_pt_v1' as TemplateKey | null
})
const templates = shallowRef<EmailTemplate[]>([])
const templatesLoaded = shallowRef(false)
const emails = computed(() => parseRecipients(form.emails))
const clients = shallowRef<string[]>([])
const search = shallowRef('')
const clientPage = shallowRef(0)
const error = shallowRef('')
const loading = shallowRef(false)
const actions = marketingActions(new MarketingApiAdapter())
onMounted(async () => {
  try {
    templates.value = await actions.templates()
    const initial = templates.value.find((item) => item.key === form.template_key)
    if (initial) {
      if (!form.subject) form.subject = initial.default_subject
      if (!form.body) form.body = initial.default_body
    }
  } catch {
    error.value = 'No se pudo cargar la plantilla. Actualiza la página para volver a intentarlo.'
  } finally {
    templatesLoaded.value = true
  }
})
watch(
  () => form.template_key,
  (key, previous) => {
    const next = templates.value.find((item) => item.key === key)
    const old = templates.value.find((item) => item.key === previous)
    if (!next) return
    if (!form.subject || form.subject === old?.default_subject) form.subject = next.default_subject
    if (!form.body || form.body === old?.default_body) form.body = next.default_body
  }
)
async function searchClients(page = 0) {
  loading.value = true
  error.value = ''
  try {
    clients.value = await actions.clients(search.value, page * 100)
    clientPage.value = page
  } catch {
    error.value = 'No se pudieron cargar los clientes.'
  } finally {
    loading.value = false
  }
}
async function importFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  error.value = ''
  if (file.size > 5 * 1024 * 1024) {
    error.value = 'El archivo debe pesar menos de 5 MB.'
    return
  }
  try {
    const { read, utils } = await import('xlsx')
    const workbook = read(await file.arrayBuffer(), { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0] ?? '']
    if (!sheet) throw new Error()
    const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
    const found = rows
      .flat()
      .map(String)
      .filter((cell) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cell.trim()))
    if (!found.length) {
      error.value = 'No se encontraron correos en la primera hoja.'
      return
    }
    form.emails += '\n' + found.join('\n')
  } catch {
    error.value = 'No se pudo leer el archivo.'
  }
}
function save() {
  error.value = ''
  if (!emails.value.length || emails.value.length > 10000) {
    error.value = 'Agrega entre 1 y 10 000 destinatarios.'
    return
  }
  if (emails.value.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    error.value = 'Revisa los correos: hay direcciones inválidas.'
    return
  }
  emit('save', {
    name: form.name,
    subject: form.subject,
    body: form.body,
    emails: emails.value,
    template_key: form.template_key,
    consent_confirmed: form.consent
  })
}
</script>

<template>
  <form class="rounded-2xl border border-slate-200 bg-white p-6 space-y-4" @submit.prevent="save">
    <h2 class="text-lg font-semibold">Nueva campaña</h2>
    <label class="block"
      >Diseño del correo
      <select v-model="form.template_key" class="mt-1 w-full rounded-lg border p-2">
        <option v-for="item in templates" :key="item.key" :value="item.key">{{ item.name }}</option>
        <option :value="null">Mensaje sencillo</option>
      </select>
    </label>
    <p v-if="form.template_key" class="text-sm text-slate-500">
      Incluye los banners, el logo, los beneficios y el enlace de baja. El mensaje se mostrará
      debajo del banner principal.
    </p>
    <label class="block"
      >Nombre interno<input
        v-model="form.name"
        required
        maxlength="150"
        class="mt-1 w-full rounded-lg border p-2"
        placeholder="Promoción de octubre"
    /></label>
    <label class="block"
      >Asunto<input
        v-model="form.subject"
        required
        maxlength="200"
        class="mt-1 w-full rounded-lg border p-2"
    /></label>
    <label class="block"
      >Mensaje de la campaña<textarea
        v-model="form.body"
        required
        maxlength="100000"
        rows="7"
        class="mt-1 w-full rounded-lg border p-2"
        placeholder="Escribe el contenido del correo…"
      />
    </label>
    <CampaignPreview
      v-if="templatesLoaded"
      :template-key="form.template_key"
      :subject="form.subject"
      :body="form.body"
    />
    <label class="block"
      >Destinatarios ({{ emails.length }} únicos)<textarea
        v-model="form.emails"
        rows="4"
        class="mt-1 w-full rounded-lg border p-2"
        placeholder="Un correo por línea, o separados por coma"
      />
    </label>
    <label class="block text-sm"
      >Importar correos desde Excel o CSV<input
        type="file"
        accept=".xlsx,.xls,.csv"
        class="mt-2 block w-full"
        @change="importFile"
    /></label>
    <details class="rounded-lg border p-3">
      <summary class="cursor-pointer">Seleccionar clientes de Brasper</summary>
      <div class="my-3 flex gap-2">
        <input
          v-model="search"
          class="min-w-0 flex-1 rounded border p-2"
          placeholder="Buscar correo"
        /><button type="button" :disabled="loading" @click="searchClients(0)">Buscar</button>
      </div>
      <div class="max-h-48 overflow-auto">
        <label v-for="email in clients" :key="email" class="block py-1"
          ><input
            type="checkbox"
            :checked="emails.includes(email.toLowerCase())"
            @change="
              form.emails = ($event.target as HTMLInputElement).checked
                ? [...emails, email].join('\n')
                : emails.filter((item) => item !== email.toLowerCase()).join('\n')
            "
          />
          {{ email }}</label
        >
      </div>
      <div class="mt-2 flex gap-4">
        <button
          type="button"
          :disabled="loading || clientPage === 0"
          @click="searchClients(clientPage - 1)"
        >
          Anterior</button
        ><button
          type="button"
          :disabled="loading || clients.length < 100"
          @click="searchClients(clientPage + 1)"
        >
          Siguiente
        </button>
      </div>
    </details>
    <label class="flex items-start gap-2 text-sm"
      ><input v-model="form.consent" type="checkbox" required class="mt-1" />Confirmo que estos
      destinatarios autorizaron recibir comunicaciones de marketing.</label
    >
    <p v-if="error" role="alert" class="text-red-700">{{ error }}</p>
    <button
      :disabled="busy"
      class="rounded-lg bg-emerald-700 px-5 py-2 text-white disabled:opacity-50"
    >
      Guardar borrador
    </button>
  </form>
</template>
