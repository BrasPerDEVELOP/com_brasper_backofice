<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { HomeBannerApiAdapter } from '../../infrastructure/adapters'
import { Domain } from '@/interface/infrastructure/services'
import type { HomeBanner } from '../../domain/models'

type BannerLanguage = 'es' | 'pr' | 'en'

interface BannerField {
  key: BannerLanguage
  locale: string
  title: string
  description: string
}

const repo = new HomeBannerApiAdapter()
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const successMessage = ref('')
const currentBanner = ref<HomeBanner | null>(null)

const enable = ref(true)
const selectedFiles = reactive<Record<BannerLanguage, File | null>>({
  es: null,
  pr: null,
  en: null
})
const previewOverrides = reactive<Record<BannerLanguage, string>>({
  es: '',
  pr: '',
  en: ''
})

const bannerFields: BannerField[] = [
  {
    key: 'es',
    locale: 'ES',
    title: 'Banner espanol',
    description: 'Version principal para usuarios que navegan en espanol.'
  },
  {
    key: 'pr',
    locale: 'PR',
    title: 'Banner portugues',
    description: 'Version para el home en portugues.'
  },
  {
    key: 'en',
    locale: 'EN',
    title: 'Banner ingles',
    description: 'Version internacional para el home en ingles.'
  }
]

function mediaUrl(path: string | null | undefined): string {
  if (!path?.trim()) return ''
  const trimmed = path.trim()
  if (trimmed.startsWith('http')) return trimmed
  return Domain.mediaUrl(trimmed)
}

function getCurrentBannerPath(lang: BannerLanguage): string | null {
  if (!currentBanner.value) return null

  if (lang === 'es') return currentBanner.value.banner_es
  if (lang === 'pr') return currentBanner.value.banner_pr

  return currentBanner.value.banner_en
}

function revokePreview(lang: BannerLanguage) {
  const preview = previewOverrides[lang]
  if (preview.startsWith('blob:')) URL.revokeObjectURL(preview)
  previewOverrides[lang] = ''
}

function resetSelectedFiles() {
  bannerFields.forEach((field) => {
    selectedFiles[field.key] = null
    revokePreview(field.key)
  })
}

function setSelectedFile(lang: BannerLanguage, file: File | null) {
  selectedFiles[lang] = file
  revokePreview(lang)
  if (file) previewOverrides[lang] = URL.createObjectURL(file)
}

function previewFor(lang: BannerLanguage): string {
  return previewOverrides[lang] || mediaUrl(getCurrentBannerPath(lang))
}

function formatDate(value: string | undefined): string {
  if (!value) return 'Sin registro'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}

const pageBadge = computed(() => {
  if (!currentBanner.value) {
    return {
      label: 'Nuevo banner',
      className: 'border border-[#dbe7fb] bg-[#f4f8ff] text-brasper-indigoStrong'
    }
  }

  return {
    label: enable.value ? 'Visible en home' : 'Oculto en home',
    className: enable.value
      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border border-amber-200 bg-amber-50 text-amber-700'
  }
})

const bannerCards = computed(() =>
  bannerFields.map((field) => {
    const currentPath = getCurrentBannerPath(field.key)
    const selectedFile = selectedFiles[field.key]

    return {
      ...field,
      currentPath,
      preview: previewFor(field.key),
      selectedFileName: selectedFile?.name ?? '',
      hasServerImage: Boolean(currentPath),
      hasNewSelection: Boolean(selectedFile)
    }
  })
)

const uploadedLocalesCount = computed(() =>
  bannerFields.filter((field) => Boolean(selectedFiles[field.key] ?? getCurrentBannerPath(field.key))).length
)

const submitLabel = computed(() => {
  if (saving.value) return 'Guardando...'
  return currentBanner.value ? 'Actualizar banner' : 'Crear banner'
})

const statusDescription = computed(() => {
  if (enable.value) return 'El banner se mostrara a los usuarios cuando este activo.'
  return 'El registro seguira guardado, pero no se mostrara en el home.'
})

const sidebarSummary = computed(() => [
  {
    label: 'Registro',
    value: currentBanner.value?.id ?? 'Aun no creado'
  },
  {
    label: 'Idiomas con imagen',
    value: `${uploadedLocalesCount.value} de 3`
  },
  {
    label: 'Ultima actualizacion',
    value: formatDate(currentBanner.value?.updated_at)
  }
])

const helperTips = [
  'Cada idioma puede reemplazarse por separado sin perder las imagenes que no modifiques.',
  'Las vistas previas muestran la imagen actual del servidor o la nueva seleccion antes de guardar.',
  'Usa imagenes horizontales con proporcion amplia para que el banner se vea equilibrado en desktop.'
]

function clearSelectedFile(lang: BannerLanguage) {
  setSelectedFile(lang, null)
}

function onFileChange(event: Event, lang: BannerLanguage) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  setSelectedFile(lang, file)
}

onBeforeUnmount(() => {
  bannerFields.forEach((field) => revokePreview(field.key))
})

async function loadBanner() {
  loading.value = true
  error.value = ''
  try {
    currentBanner.value = await repo.getBanner()
    enable.value = currentBanner.value?.enable ?? true
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar el banner'
    currentBanner.value = null
  } finally {
    loading.value = false
  }
}

function createPayload() {
  return {
    enable: enable.value,
    banner_es: selectedFiles.es,
    banner_pr: selectedFiles.pr,
    banner_en: selectedFiles.en
  }
}

async function submit() {
  saving.value = true
  error.value = ''
  successMessage.value = ''
  try {
    if (currentBanner.value?.id) {
      await repo.updateBanner({
        id: currentBanner.value.id,
        enable: enable.value,
        banner_es: selectedFiles.es ?? (currentBanner.value.banner_es || undefined),
        banner_pr: selectedFiles.pr ?? (currentBanner.value.banner_pr || undefined),
        banner_en: selectedFiles.en ?? (currentBanner.value.banner_en || undefined)
      })
      successMessage.value = 'Banner actualizado correctamente.'
    } else {
      await repo.createBanner(createPayload())
      successMessage.value = 'Banner creado correctamente.'
    }
    resetSelectedFiles()
    await loadBanner()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar el banner'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadBanner()
})
</script>

<template>
  <div class="mx-auto max-w-7xl px-2 py-4 lg:py-6">
    <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-[0.24em] text-brasper-indigoStrong">
          Contenido del home
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="text-3xl font-semibold tracking-tight text-[#111827]">
            Banner principal
          </h1>
          <span
            class="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
            :class="pageBadge.className"
          >
            {{ pageBadge.label }}
          </span>
        </div>
        <p class="max-w-3xl text-sm text-[#6b7280]">
          Administra las tres versiones del banner del home desde una sola vista. Puedes actualizar
          cada idioma por separado y mantener las imagenes existentes si no subes un archivo nuevo.
        </p>
      </div>
    </div>

    <p
      v-if="error"
      class="mb-4 rounded-2xl border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm text-[#b91c1c]"
    >
      {{ error }}
    </p>
    <p
      v-if="successMessage"
      class="mb-4 rounded-2xl border border-[#bae6fd] bg-brasper-cyanLight/15 px-4 py-3 text-sm text-brasper-indigoDark"
    >
      {{ successMessage }}
    </p>

    <div
      v-if="loading"
      class="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_320px]"
    >
      <div class="space-y-6">
        <div class="h-44 animate-pulse rounded-3xl border border-[#dbe7fb] bg-white" />
        <div class="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          <div
            v-for="card in 3"
            :key="card"
            class="h-[26rem] animate-pulse rounded-3xl border border-[#dbe7fb] bg-white"
          />
        </div>
      </div>
      <div class="h-72 animate-pulse rounded-3xl border border-[#dbe7fb] bg-white" />
    </div>

    <form
      v-else
      class="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_320px]"
      @submit.prevent="submit"
    >
      <section class="space-y-6">
        <div class="rounded-3xl border border-[#dbe7fb] bg-white p-5 shadow-sm md:p-6">
          <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div class="space-y-2">
              <h2 class="text-lg font-semibold text-[#111827]">Configuracion general</h2>
              <p class="max-w-2xl text-sm text-[#6b7280]">
                Activa o desactiva la visibilidad del banner y luego actualiza las imagenes que
                quieras reemplazar.
              </p>
            </div>

            <label
              for="banner-enable"
              class="flex min-w-[18rem] items-start gap-3 rounded-2xl border border-[#dbe7fb] bg-[#f7faff] px-4 py-3"
            >
              <input
                id="banner-enable"
                v-model="enable"
                type="checkbox"
                class="mt-0.5 h-4 w-4 rounded border-[#d0def6] text-brasper-indigoStrong focus:ring-brasper-indigoStrong"
              />
              <span class="space-y-1">
                <span class="block text-sm font-semibold text-[#1f2937]">Banner visible</span>
                <span class="block text-xs text-[#6b7280]">
                  {{ statusDescription }}
                </span>
              </span>
            </label>
          </div>

          <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div class="rounded-2xl border border-[#e5eefc] bg-[#f9fbff] px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-brasper-indigoStrong">
                Formatos permitidos
              </p>
              <p class="mt-1 text-sm text-[#4b5563]">PNG, JPG, JPEG, WEBP y GIF</p>
            </div>
            <div class="rounded-2xl border border-[#e5eefc] bg-[#f9fbff] px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-brasper-indigoStrong">
                Reemplazo parcial
              </p>
              <p class="mt-1 text-sm text-[#4b5563]">Si omites un idioma, se conserva la imagen actual.</p>
            </div>
            <div class="rounded-2xl border border-[#e5eefc] bg-[#f9fbff] px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-brasper-indigoStrong">
                Vista previa
              </p>
              <p class="mt-1 text-sm text-[#4b5563]">Veras de inmediato la nueva imagen antes de guardarla.</p>
            </div>
          </div>
        </div>

        <div class="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          <article
            v-for="field in bannerCards"
            :key="field.key"
            class="flex h-full flex-col rounded-3xl border border-[#dbe7fb] bg-white p-5 shadow-sm"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-brasper-indigoStrong">
                  {{ field.locale }}
                </p>
                <h2 class="mt-1 text-lg font-semibold text-[#111827]">
                  {{ field.title }}
                </h2>
              </div>
              <span class="rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-brasper-indigoStrong">
                {{ field.hasServerImage || field.hasNewSelection ? 'Con imagen' : 'Pendiente' }}
              </span>
            </div>

            <p class="mt-2 text-sm text-[#6b7280]">
              {{ field.description }}
            </p>

            <div class="mt-4 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-[#f8fafc]">
              <div
                class="flex aspect-[16/9] items-center justify-center"
                :class="field.preview ? 'bg-[#eef4ff]' : 'bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_100%)]'"
              >
                <img
                  v-if="field.preview"
                  :src="field.preview"
                  :alt="field.title"
                  class="h-full w-full object-cover"
                />
                <div v-else class="px-6 text-center">
                  <p class="text-sm font-semibold text-[#374151]">Sin imagen cargada</p>
                  <p class="mt-1 text-xs text-[#6b7280]">
                    Selecciona un archivo para este idioma.
                  </p>
                </div>
              </div>
            </div>

            <div class="mt-4 space-y-3">
              <div class="rounded-2xl border border-[#edf2fb] bg-[#f9fbff] px-4 py-3">
                <p class="text-xs font-semibold uppercase tracking-wide text-brasper-indigoStrong">
                  Estado actual
                </p>
                <p class="mt-1 text-sm text-[#374151]">
                  <span v-if="field.hasNewSelection">
                    Lista para subir: <span class="font-medium">{{ field.selectedFileName }}</span>
                  </span>
                  <span v-else-if="field.hasServerImage">
                    Ya existe una imagen guardada en el servidor.
                  </span>
                  <span v-else>
                    Aun no hay una imagen registrada para este idioma.
                  </span>
                </p>
                <p
                  v-if="field.currentPath && !field.hasNewSelection"
                  class="mt-1 break-all text-xs text-[#6b7280]"
                >
                  {{ field.currentPath }}
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-3">
                <label
                  class="inline-flex cursor-pointer items-center justify-center rounded-xl bg-brasper-indigoStrong px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brasper-indigoDark"
                >
                  {{ field.hasNewSelection ? 'Cambiar imagen' : 'Seleccionar imagen' }}
                  <input
                    type="file"
                    accept="image/*"
                    class="sr-only"
                    @change="onFileChange($event, field.key)"
                  />
                </label>

                <button
                  v-if="field.hasNewSelection"
                  type="button"
                  class="rounded-xl border border-[#d1d5db] bg-white px-4 py-2.5 text-sm font-medium text-[#374151] transition hover:bg-[#f9fafb]"
                  @click="clearSelectedFile(field.key)"
                >
                  Quitar seleccion
                </button>
              </div>

              <p class="text-xs text-[#6b7280]">
                Recomendado: imagen horizontal con buena legibilidad en desktop y mobile.
              </p>
            </div>
          </article>
        </div>

        <div class="flex flex-wrap gap-3">
          <button
            type="submit"
            class="rounded-xl bg-brasper-indigoStrong px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brasper-indigoDark disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="saving"
          >
            {{ submitLabel }}
          </button>
          <button
            type="button"
            class="rounded-xl border border-[#d1d5db] bg-white px-5 py-2.5 text-sm font-medium text-[#374151] transition hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="saving"
            @click="loadBanner"
          >
            Recargar datos
          </button>
        </div>
      </section>

      <aside class="space-y-6 xl:sticky xl:top-24 xl:self-start">
        <div class="rounded-3xl border border-[#dbe7fb] bg-white p-5 shadow-sm">
          <h2 class="text-lg font-semibold text-[#111827]">Resumen</h2>
          <div class="mt-4 space-y-4">
            <div
              v-for="item in sidebarSummary"
              :key="item.label"
              class="rounded-2xl border border-[#edf2fb] bg-[#f9fbff] px-4 py-3"
            >
              <p class="text-xs font-semibold uppercase tracking-wide text-brasper-indigoStrong">
                {{ item.label }}
              </p>
              <p class="mt-1 break-all text-sm text-[#374151]">
                {{ item.value }}
              </p>
            </div>
          </div>
        </div>

        <div class="rounded-3xl border border-[#dbe7fb] bg-white p-5 shadow-sm">
          <h2 class="text-lg font-semibold text-[#111827]">Recomendaciones</h2>
          <ul class="mt-4 space-y-3 text-sm text-[#4b5563]">
            <li
              v-for="tip in helperTips"
              :key="tip"
              class="rounded-2xl border border-[#edf2fb] bg-[#f9fbff] px-4 py-3"
            >
              {{ tip }}
            </li>
          </ul>
        </div>
      </aside>
    </form>
  </div>
</template>
