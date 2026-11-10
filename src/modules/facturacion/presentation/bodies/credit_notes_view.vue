<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'

interface CreditNote {
  id: string
  file_name: string
  issuer_ruc: string
  status: string
  issue_time: number
  xml_url: string | null
  cdr_url: string | null
}

const notes = ref<CreditNote[]>([])
const loading = ref(false)
const error = ref('')
const issuer = ref('')
const pdfLoading = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await apiClient.get<CreditNote[]>(Domain.apiPath('billing/credit-notes'), {
      params: issuer.value ? { issuer_ruc: issuer.value } : {}
    })
    notes.value = data
  } catch {
    error.value = 'No se pudieron consultar las notas de crédito de APISUNAT.'
  } finally {
    loading.value = false
  }
}

onMounted(() => void load())

async function downloadPdf(note: CreditNote) {
  pdfLoading.value = note.id
  error.value = ''
  try {
    const { data } = await apiClient.get<Blob>(Domain.apiPath(`billing/credit-notes/${note.issuer_ruc}/${note.id}/pdf`), { responseType: 'blob' })
    const url = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url
    link.download = `${note.file_name}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch {
    error.value = 'No se pudo descargar el PDF de la nota de crédito.'
  } finally {
    pdfLoading.value = ''
  }
}
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-end gap-3 rounded-xl border border-[#dbe4f4] bg-white p-4">
      <label class="space-y-1 text-sm text-[#374151]">
        <span class="block text-xs font-medium">Empresa emisora</span>
        <select v-model="issuer" class="rounded-lg border border-[#d1d5db] bg-white px-3 py-2" @change="load">
          <option value="">Todas</option>
          <option value="20608550454">BRASPER 21 S.A.C.</option>
          <option value="20611936428">INGENITECH S.A.C.</option>
        </select>
      </label>
      <button type="button" class="rounded-lg border border-[#d1d5db] px-3 py-2 text-sm" :disabled="loading" @click="load">Actualizar</button>
      <span class="text-sm text-[#617089]">{{ loading ? 'Consultando APISUNAT…' : `${notes.length} notas de crédito` }}</span>
    </div>
    <p v-if="error" role="alert" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{{ error }}</p>
    <div class="overflow-x-auto rounded-xl border border-[#e5e7eb] bg-white">
      <table class="w-full min-w-[42rem] text-left text-sm">
        <thead class="bg-[#dbeafe] text-xs font-semibold text-brasper-indigoDark"><tr><th class="px-4 py-3">Nota de crédito</th><th class="px-4 py-3">Emisor</th><th class="px-4 py-3">Emisión</th><th class="px-4 py-3">Estado</th><th class="px-4 py-3">Archivos</th></tr></thead>
        <tbody>
          <tr v-for="note in notes" :key="`${note.issuer_ruc}-${note.id || note.file_name}`" class="border-t border-[#e5e7eb]">
            <td class="px-4 py-3 font-mono">{{ note.file_name?.split('-').slice(2).join('-') || '—' }}</td>
            <td class="px-4 py-3">{{ note.issuer_ruc === '20608550454' ? 'BRASPER 21 S.A.C.' : 'INGENITECH S.A.C.' }}</td>
            <td class="px-4 py-3">{{ note.issue_time ? new Date(note.issue_time * 1000).toLocaleDateString('es-PE', { timeZone: 'America/Lima' }) : '—' }}</td>
            <td class="px-4 py-3">{{ note.status }}</td>
            <td class="px-4 py-3"><button type="button" class="text-brasper-indigoStrong hover:underline disabled:opacity-50" :disabled="pdfLoading === note.id" @click="downloadPdf(note)">PDF</button><span v-if="note.xml_url"> · </span><a v-if="note.xml_url" :href="note.xml_url" target="_blank" rel="noopener noreferrer" class="text-brasper-indigoStrong hover:underline">XML</a><span v-if="note.cdr_url"> · </span><a v-if="note.cdr_url" :href="note.cdr_url" target="_blank" rel="noopener noreferrer" class="text-brasper-indigoStrong hover:underline">CDR</a></td>
          </tr>
          <tr v-if="!loading && !notes.length"><td colspan="5" class="px-4 py-10 text-center text-[#617089]">No hay notas de crédito para esta empresa.</td></tr>
        </tbody>
      </table>
    </div>
    <p class="text-xs text-[#617089]">«Anular» solicita la anulación mediante APISUNAT; estas notas de crédito son documentos emitidos y consultados directamente allí.</p>
  </section>
</template>
