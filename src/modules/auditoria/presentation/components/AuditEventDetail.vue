<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import type { AuditEvent } from '../../domain/models'

const props = defineProps<{ event: AuditEvent | null }>()
const emit = defineEmits<{ close: [] }>()

/** Esc cierra el panel: es la salida que se espera de cualquier modal. */
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.event) emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

function pretty(value: Record<string, unknown> | null): string {
  return value ? JSON.stringify(value, null, 2) : 'Sin datos'
}
</script>

<template>
  <div v-if="event" class="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label="Detalle de auditoría" @click.self="emit('close')">
    <aside class="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl">
      <div class="mb-6 flex items-start justify-between gap-4">
        <div><p class="text-xs font-semibold uppercase text-brasper-indigoStrong">{{ event.entity }}</p><h2 class="text-xl font-semibold text-[#232b4d]">{{ event.action }}</h2></div>
        <button type="button" class="rounded-lg border px-3 py-1.5 text-sm" @click="emit('close')">Cerrar</button>
      </div>
      <dl class="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt class="text-neutral-500">Fecha</dt><dd>{{ new Date(event.created_at).toLocaleString('es-PE') }}</dd></div>
        <div><dt class="text-neutral-500">Resultado</dt><dd>{{ event.success ? 'Exitoso' : 'Fallido' }} · {{ event.status_code ?? '-' }}</dd></div>
        <div><dt class="text-neutral-500">Usuario</dt><dd>{{ event.actor_username ?? event.actor_user_id ?? 'Sistema/anónimo' }}</dd></div>
        <div><dt class="text-neutral-500">Rol / origen</dt><dd>{{ event.actor_role ?? '-' }} · {{ event.source }}</dd></div>
        <div><dt class="text-neutral-500">IP</dt><dd>{{ event.ip_address ?? '-' }}</dd></div>
        <div><dt class="text-neutral-500">Entidad ID</dt><dd class="break-all">{{ event.entity_id ?? '-' }}</dd></div>
        <div class="sm:col-span-2"><dt class="text-neutral-500">Request ID</dt><dd class="break-all font-mono text-xs">{{ event.request_id }}</dd></div>
        <div class="sm:col-span-2"><dt class="text-neutral-500">Ruta</dt><dd class="break-all font-mono text-xs">{{ event.method }} {{ event.path }}</dd></div>
        <div v-if="event.description" class="sm:col-span-2"><dt class="text-neutral-500">Descripción</dt><dd>{{ event.description }}</dd></div>
        <div v-if="event.user_agent" class="sm:col-span-2"><dt class="text-neutral-500">Navegador / agente</dt><dd class="break-all text-xs">{{ event.user_agent }}</dd></div>
      </dl>
      <div class="mt-6 grid gap-4 lg:grid-cols-2">
        <section><h3 class="mb-2 font-semibold">Antes</h3><pre class="max-h-80 overflow-auto rounded-xl bg-neutral-950 p-4 text-xs text-neutral-100">{{ pretty(event.old_values) }}</pre></section>
        <section><h3 class="mb-2 font-semibold">Después</h3><pre class="max-h-80 overflow-auto rounded-xl bg-neutral-950 p-4 text-xs text-neutral-100">{{ pretty(event.new_values) }}</pre></section>
      </div>
      <section v-if="event.metadata" class="mt-4">
        <h3 class="mb-2 font-semibold">Metadatos</h3>
        <pre class="max-h-64 overflow-auto rounded-xl bg-neutral-100 p-4 text-xs text-neutral-800">{{ pretty(event.metadata) }}</pre>
      </section>
    </aside>
  </div>
</template>
