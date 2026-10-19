<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef, watch } from 'vue'
import type { TemplateKey } from '../../domain/models'
import { marketingActions } from '../../application/use_cases/marketing'
import { MarketingApiAdapter } from '../../infrastructure/marketing_api_adapter'

const props = defineProps<{ templateKey: TemplateKey | null; subject: string; body: string }>()
const html = shallowRef('')
const error = shallowRef('')
const busy = shallowRef(false)
const dirty = shallowRef(true)
const mobile = shallowRef(false)
const actions = marketingActions(new MarketingApiAdapter())
let generation = 0
watch(
  () => [props.templateKey, props.subject, props.body],
  () => {
    dirty.value = true
    generation++
  }
)
async function refresh() {
  if (busy.value) return
  const current = ++generation
  busy.value = true
  error.value = ''
  try {
    const result = await actions.preview({
      template_key: props.templateKey,
      subject: props.subject,
      body: props.body
    })
    if (current === generation) {
      html.value = result
      dirty.value = false
    }
  } catch {
    error.value = 'No se pudo generar la vista previa. Vuelve a intentarlo.'
  } finally {
    busy.value = false
  }
}
onMounted(() => {
  void refresh()
})
onUnmounted(() => {
  generation++
})
</script>

<template>
  <section class="email-preview rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
      <h3 class="font-semibold">Vista previa del correo</h3>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded border px-2 py-1"
          :aria-pressed="!mobile"
          @click="mobile = false"
        >
          Escritorio
        </button>
        <button
          type="button"
          class="rounded border px-2 py-1"
          :aria-pressed="mobile"
          @click="mobile = true"
        >
          Móvil
        </button>
        <button
          type="button"
          class="rounded bg-emerald-700 px-2 py-1 text-white disabled:opacity-50"
          :disabled="busy"
          @click="refresh"
        >
          {{ busy ? 'Generando…' : 'Actualizar vista previa' }}
        </button>
      </div>
    </div>
    <p v-if="dirty && html" class="text-xs text-amber-800">
      El contenido cambió. Actualiza la vista previa para revisar la última versión.
    </p>
    <p v-if="error" role="alert" class="text-sm text-red-700">{{ error }}</p>
    <div v-if="html" class="preview-canvas overflow-x-auto">
      <iframe
        :srcdoc="html"
        sandbox=""
        referrerpolicy="no-referrer"
        title="Vista previa de la campaña de correo"
        class="mx-auto block border-0 bg-white"
        :style="{
          width: mobile ? '360px' : '640px',
          maxWidth: 'none',
          height: mobile ? '1960px' : '1640px'
        }"
      />
    </div>
    <p class="text-xs text-slate-500">
      Esta plantilla se usa también en las pruebas y el envío masivo. Cada destinatario recibirá su
      propio enlace de baja. El aspecto puede variar según la aplicación de correo.
    </p>
  </section>
</template>
