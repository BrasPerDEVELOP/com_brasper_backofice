<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { HomeBannerApiAdapter } from '../../infrastructure/adapters'
import { Domain } from '@/interface/infrastructure/services'
import type { HomeBanner } from '../../domain/models'
import type { BannerIndicator } from '../../domain/models/home_banner'
import { Icon } from '@iconify/vue'

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
const showImage = ref(true)
const showIndicators = ref(true)
const content = reactive({
  es: { eyebrow: '', title: '', subtitle: '', image_alt: '' },
  pr: { eyebrow: '', title: '', subtitle: '', image_alt: '' },
  en: { eyebrow: '', title: '', subtitle: '', image_alt: '' }
})
const appearance = reactive({ type: 'gradient' as 'solid' | 'gradient', primary: '#2563eb', secondary: '#38bdf8', blur: true })
const indicators = ref<BannerIndicator[]>([])
const iconOptions = ['mdi:shield-check-outline', 'mdi:account-heart-outline', 'mdi:swap-horizontal-circle-outline', 'mdi:clock-fast', 'mdi:whatsapp']
function addIndicator() {
  if (indicators.value.length >= 3) return
  indicators.value.push({ icon: iconOptions[indicators.value.length] ?? 'mdi:shield-check-outline', enabled: true, text: { es: '', pr: '', en: '' } })
}
function removeIndicator(index: number) { indicators.value.splice(index, 1) }

function copyContent() {
  return {
    es: { ...content.es },
    pr: { ...content.pr },
    en: { ...content.en }
  }
}

function copyIndicators(source: BannerIndicator[] = indicators.value): BannerIndicator[] {
  return source.map((indicator) => ({
    ...indicator,
    text: { ...indicator.text }
  }))
}

function copyAppearance() {
  return { ...appearance }
}

function restoreDefaults() {
  Object.assign(content.es, { eyebrow: 'ENVÍA RÁPIDO DESDE WHATSAPP', title: 'Envía soles, dólares y reales a Brasil y Perú con el mejor tipo de cambio.', subtitle: 'Cotiza en segundos con total transparencia.', image_alt: 'Promoción Brasper' })
  Object.assign(content.pr, { eyebrow: 'ENVIE RÁPIDO PELO WHATSAPP', title: 'Envie dinheiro com a melhor taxa de câmbio.', subtitle: 'Faça sua cotação em segundos com transparência.', image_alt: 'Promoção Brasper' })
  Object.assign(content.en, { eyebrow: 'SEND FAST FROM WHATSAPP', title: 'Send money with a great exchange rate.', subtitle: 'Get a transparent quote in seconds.', image_alt: 'Brasper promotion' })
  Object.assign(appearance, { type: 'gradient', primary: '#2563eb', secondary: '#38bdf8', blur: true })
  indicators.value = []
  showImage.value = true
  showIndicators.value = true
}
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
    if (currentBanner.value) {
      Object.assign(content.es, currentBanner.value.content.es ?? {})
      Object.assign(content.pr, currentBanner.value.content.pr ?? {})
      Object.assign(content.en, currentBanner.value.content.en ?? {})
      Object.assign(appearance, currentBanner.value.appearance)
      indicators.value = copyIndicators(currentBanner.value.indicators)
      showImage.value = currentBanner.value.show_image
      showIndicators.value = currentBanner.value.show_indicators
    }
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
    banner_en: selectedFiles.en,
    content: copyContent(),
    indicators: copyIndicators(),
    appearance: copyAppearance(),
    show_image: showImage.value,
    show_indicators: showIndicators.value
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
        banner_en: selectedFiles.en ?? (currentBanner.value.banner_en || undefined),
        content: copyContent(),
        indicators: copyIndicators(),
        appearance: copyAppearance(),
        show_image: showImage.value,
        show_indicators: showIndicators.value
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
      <button
        v-if="!loading"
        type="submit"
        form="home-banner-form"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-brasper-indigoStrong px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brasper-indigoDark disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="saving"
      >
        {{ submitLabel }}
      </button>
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
      id="home-banner-form"
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

        <div class="space-y-6 rounded-3xl border border-[#dbe7fb] bg-white p-5 shadow-sm md:p-6">
          <div class="flex flex-wrap items-start justify-between gap-3"><div><p class="text-xs font-semibold uppercase tracking-[.18em] text-brasper-indigoStrong">Contenido y apariencia</p><h2 class="mt-1 text-lg font-semibold text-slate-900">Textos editables por idioma</h2></div><button type="button" class="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50" @click="restoreDefaults">Restaurar valores iniciales</button></div>
          <div class="grid gap-5 lg:grid-cols-3">
            <fieldset v-for="locale in (['es','pr','en'] as const)" :key="locale" class="space-y-3 rounded-2xl border border-slate-200 p-4"><legend class="px-2 text-sm font-bold uppercase text-brasper-indigoStrong">{{ locale }}</legend><label class="block text-sm text-slate-700">Texto superior<input v-model="content[locale].eyebrow" class="banner-field" maxlength="100" /></label><label class="block text-sm text-slate-700">Título<textarea v-model="content[locale].title" class="banner-field min-h-24 py-2" maxlength="180" /></label><label class="block text-sm text-slate-700">Subtítulo<textarea v-model="content[locale].subtitle" class="banner-field min-h-20 py-2" maxlength="240" /></label><label class="block text-sm text-slate-700">Texto alternativo<input v-model="content[locale].image_alt" class="banner-field" maxlength="140" /></label></fieldset>
          </div>
          <div class="grid gap-4 md:grid-cols-2"><div class="rounded-2xl border border-slate-200 p-4"><h3 class="font-semibold text-slate-900">Fondo</h3><div class="mt-3 grid grid-cols-2 gap-3"><label class="text-sm text-slate-700">Tipo<select v-model="appearance.type" class="banner-field"><option value="gradient">Gradiente</option><option value="solid">Color sólido</option></select></label><label class="text-sm text-slate-700">Color principal<input v-model="appearance.primary" type="color" class="mt-1 h-11 w-full rounded-xl border border-slate-300 p-1" /></label><label v-if="appearance.type === 'gradient'" class="text-sm text-slate-700">Color secundario<input v-model="appearance.secondary" type="color" class="mt-1 h-11 w-full rounded-xl border border-slate-300 p-1" /></label><label class="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700"><input v-model="appearance.blur" type="checkbox" /> Difuminados</label></div></div><div class="rounded-2xl border border-slate-200 p-4"><h3 class="font-semibold text-slate-900">Elementos visibles</h3><label class="mt-3 flex min-h-11 items-center gap-3 text-sm"><input v-model="showImage" type="checkbox" /> Mostrar imagen promocional</label><label class="flex min-h-11 items-center gap-3 text-sm"><input v-model="showIndicators" type="checkbox" /> Mostrar indicadores</label></div></div>
          <div><div class="flex items-center justify-between"><h3 class="font-semibold text-slate-900">Indicadores de confianza</h3><button type="button" class="min-h-11 rounded-xl border border-brasper-indigoStrong px-4 text-sm font-semibold text-brasper-indigoStrong disabled:opacity-50" :disabled="indicators.length >= 3" @click="addIndicator">Agregar indicador</button></div><div class="mt-3 space-y-3"><div v-for="(indicator, index) in indicators" :key="index" class="grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[220px_1fr_1fr_1fr_auto]"><label class="flex items-center gap-2"><Icon :icon="indicator.icon" width="28" height="28" class="shrink-0 text-brasper-indigoStrong" /><select v-model="indicator.icon" aria-label="Icono" class="banner-field !mt-0"><option v-for="icon in iconOptions" :key="icon" :value="icon">{{ icon.split(':')[1] }}</option></select></label><input v-model="indicator.text.es" aria-label="Texto español" class="banner-field" placeholder="Español" /><input v-model="indicator.text.pr" aria-label="Texto portugués" class="banner-field" placeholder="Português" /><input v-model="indicator.text.en" aria-label="Texto inglés" class="banner-field" placeholder="English" /><button type="button" class="min-h-11 rounded-xl px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50" @click="removeIndicator(index)">Quitar</button></div></div></div>
          <div class="overflow-hidden rounded-2xl p-6 text-white" :style="{ background: appearance.type === 'gradient' ? `linear-gradient(110deg, ${appearance.primary}, ${appearance.secondary})` : appearance.primary }"><p class="text-xs font-bold uppercase tracking-widest text-yellow-300">{{ content.es.eyebrow || 'Texto superior' }}</p><h3 class="mt-2 text-2xl font-bold">{{ content.es.title || 'Vista previa del título' }}</h3><p class="mt-2 text-sm text-white/85">{{ content.es.subtitle || 'Vista previa del subtítulo' }}</p><div v-if="showIndicators" class="mt-4 flex flex-wrap gap-2"><span v-for="item in indicators.filter((value) => value.enabled)" :key="item.icon" class="rounded-full bg-white/15 px-3 py-2 text-xs font-semibold">{{ item.text.es || item.icon }}</span></div></div>
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

<style scoped>
.banner-field { display:block; width:100%; min-height:2.75rem; margin-top:.25rem; border:1px solid #cbd5e1; border-radius:.75rem; background:#fff; padding:0 .75rem; color:#0f172a; font-size:.875rem; outline:none; transition:border-color .2s, box-shadow .2s; }
.banner-field:focus { border-color:#3655a5; box-shadow:0 0 0 3px rgb(54 85 165 / 20%); }
</style>
