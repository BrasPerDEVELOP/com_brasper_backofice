<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { apiClient, getApiBaseUrl } from '@/interface/api/client'
import AppSpinner from './AppSpinner.vue'
import { mediaViewerMimeType, resolveMediaViewerKind, type MediaViewerKind } from './media_viewer'

interface Props {
  source: string
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Vista previa del archivo'
})

const open = defineModel<boolean>({ required: true })
const closeButton = useTemplateRef<HTMLButtonElement>('closeButton')
const loading = shallowRef(false)
const errorMessage = shallowRef('')
const objectUrl = shallowRef('')
const mediaKind = shallowRef<MediaViewerKind | null>(null)
let opener: HTMLElement | null = null

function releaseObjectUrl() {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = ''
  mediaKind.value = null
}

function close() {
  open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) close()
}

/** `true` si la URL apunta fuera del API (el CDN de media, que firma las suyas). */
function isExternalUrl(source: string): boolean {
  if (!/^https?:\/\//i.test(source)) return false
  try {
    return new URL(source).origin !== new URL(getApiBaseUrl()).origin
  } catch {
    return false
  }
}

async function fetchMedia(source: string, signal: AbortSignal): Promise<Blob> {
  // El interceptor de apiClient reescribe cualquier URL al origen del API, así
  // que las del CDN hay que pedirlas con fetch: ya llevan su firma en la query
  // y no necesitan (ni deben recibir) la cabecera Authorization.
  if (/^(?:blob:|data:)/i.test(source) || isExternalUrl(source)) {
    const response = await fetch(source, { signal })
    if (!response.ok) throw new Error('No se pudo cargar el archivo seleccionado.')
    return response.blob()
  }

  const response = await apiClient.get<Blob>(source, {
    responseType: 'blob',
    signal
  })
  return response.data
}

watch([open, () => props.source], async ([isOpen, source], _previous, onCleanup) => {
  releaseObjectUrl()
  errorMessage.value = ''
  loading.value = false

  if (!isOpen || !source.trim()) return

  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  await nextTick()
  closeButton.value?.focus()

  const controller = new AbortController()
  onCleanup(() => controller.abort())
  loading.value = true

  try {
    const blob = await fetchMedia(source, controller.signal)
    if (controller.signal.aborted) return

    const kind = resolveMediaViewerKind(blob.type, source)
    if (!kind) {
      errorMessage.value = 'Este visor solo admite imágenes y archivos PDF.'
      return
    }

    const displayBlob = new Blob([blob], {
      type: mediaViewerMimeType(kind, blob.type, source)
    })
    mediaKind.value = kind
    objectUrl.value = URL.createObjectURL(displayBlob)
  } catch {
    if (!controller.signal.aborted) {
      errorMessage.value =
        'No se pudo cargar el archivo. Comprueba tu sesión e inténtalo nuevamente.'
    }
  } finally {
    if (!controller.signal.aborted) loading.value = false
  }
})

watch(open, (isOpen) => {
  if (!isOpen) {
    releaseObjectUrl()
    const target = opener
    opener = null
    void nextTick(() => target?.focus())
  }
})

onMounted(() => document.addEventListener('keydown', onKeydown))

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  releaseObjectUrl()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-viewer-title"
      @click.self="close"
    >
      <section
        class="flex h-[min(90vh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl"
      >
        <header
          class="flex shrink-0 items-center justify-between gap-4 border-b border-[#e5e7eb] px-4 py-3 sm:px-5"
        >
          <div class="min-w-0">
            <h2 id="media-viewer-title" class="truncate text-base font-semibold text-[#1f2937]">
              {{ title }}
            </h2>
            <p class="mt-0.5 text-xs text-[#6b7280]">
              {{
                mediaKind === 'pdf'
                  ? 'Documento PDF'
                  : mediaKind === 'image'
                    ? 'Imagen'
                    : 'Vista previa'
              }}
            </p>
          </div>
          <button
            ref="closeButton"
            type="button"
            class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#6b7280] transition hover:bg-[#f3f4f6] hover:text-[#111827] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brasper-indigoStrong"
            aria-label="Cerrar visor"
            @click="close"
          >
            <svg
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </header>

        <div
          class="relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#eef2f7] p-3 sm:p-5"
        >
          <div
            v-if="loading"
            class="flex flex-col items-center gap-3 text-sm text-[#6b7280]"
            role="status"
          >
            <AppSpinner size="lg" />
            <span>Cargando archivo…</span>
          </div>

          <div
            v-else-if="errorMessage"
            class="max-w-md rounded-xl border border-red-200 bg-white px-5 py-4 text-center text-sm text-red-700 shadow-sm"
            role="alert"
          >
            {{ errorMessage }}
          </div>

          <img
            v-else-if="mediaKind === 'image' && objectUrl"
            :src="objectUrl"
            :alt="title"
            class="max-h-full max-w-full rounded-lg bg-white object-contain shadow-lg"
          />

          <iframe
            v-else-if="mediaKind === 'pdf' && objectUrl"
            :src="objectUrl"
            :title="title"
            class="h-full min-h-[60vh] w-full rounded-lg border-0 bg-white shadow-lg"
          />
        </div>
      </section>
    </div>
  </Teleport>
</template>
