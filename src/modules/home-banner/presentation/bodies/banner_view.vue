<template>
  <div class="mx-auto max-w-2xl px-2 py-4 lg:py-6">
    <h1 class="mb-6 text-2xl font-medium text-[#1f2937]">Banner home</h1>

    <p v-if="error" class="mb-4 rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]">
      {{ error }}
    </p>
    <p v-if="successMessage" class="mb-4 rounded-lg bg-brasper-cyanLight/15 px-4 py-3 text-sm text-brasper-indigoDark">
      {{ successMessage }}
    </p>

    <div v-if="loading" class="rounded-2xl border border-[#e5e7eb] bg-white p-8 text-center text-[#6b7280]">
      Cargando banner...
    </div>

    <form
      v-else
      class="rounded-2xl border border-[#d8e5fb] bg-white px-4 py-6 shadow-lg md:px-6"
      @submit.prevent="submit"
    >
      <div class="mb-6 flex items-center gap-3">
        <input
          id="banner-enable"
          v-model="enable"
          type="checkbox"
          class="h-4 w-4 rounded border-[#d0def6] text-brasper-indigoStrong focus:ring-brasper-indigoStrong"
        />
        <label for="banner-enable" class="text-sm font-medium text-[#374151]">Banner visible (habilitado)</label>
      </div>

      <div class="space-y-6">
        <div class="rounded-xl border border-[#dbe7fb] bg-[#f9fbff] p-4">
          <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-brasper-indigoStrong">
            Banner español (ES)
          </label>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div v-if="previewEs" class="shrink-0">
              <img
                :src="previewEs"
                alt="Banner ES"
                class="h-24 w-40 rounded-lg border border-[#e5e7eb] object-cover"
              />
            </div>
            <div class="min-w-0 flex-1">
              <input
                type="file"
                accept="image/*"
                class="block w-full text-sm text-[#6b7280] file:mr-4 file:rounded-lg file:border-0 file:bg-brasper-indigoStrong file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:hover:bg-brasper-indigoDark"
                @change="onFileChange($event, 'es')"
              />
              <p v-if="currentBanner?.banner_es && !fileEs" class="mt-1 text-xs text-[#6b7280]">
                Imagen actual en servidor. Sube una nueva para reemplazar.
              </p>
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-[#dbe7fb] bg-[#f9fbff] p-4">
          <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-brasper-indigoStrong">
            Banner portugués (PR)
          </label>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div v-if="previewPr" class="shrink-0">
              <img
                :src="previewPr"
                alt="Banner PR"
                class="h-24 w-40 rounded-lg border border-[#e5e7eb] object-cover"
              />
            </div>
            <div class="min-w-0 flex-1">
              <input
                type="file"
                accept="image/*"
                class="block w-full text-sm text-[#6b7280] file:mr-4 file:rounded-lg file:border-0 file:bg-brasper-indigoStrong file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:hover:bg-brasper-indigoDark"
                @change="onFileChange($event, 'pr')"
              />
              <p v-if="currentBanner?.banner_pr && !filePr" class="mt-1 text-xs text-[#6b7280]">
                Imagen actual en servidor. Sube una nueva para reemplazar.
              </p>
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-[#dbe7fb] bg-[#f9fbff] p-4">
          <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-brasper-indigoStrong">
            Banner inglés (EN)
          </label>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div v-if="previewEn" class="shrink-0">
              <img
                :src="previewEn"
                alt="Banner EN"
                class="h-24 w-40 rounded-lg border border-[#e5e7eb] object-cover"
              />
            </div>
            <div class="min-w-0 flex-1">
              <input
                type="file"
                accept="image/*"
                class="block w-full text-sm text-[#6b7280] file:mr-4 file:rounded-lg file:border-0 file:bg-brasper-indigoStrong file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:hover:bg-brasper-indigoDark"
                @change="onFileChange($event, 'en')"
              />
              <p v-if="currentBanner?.banner_en && !fileEn" class="mt-1 text-xs text-[#6b7280]">
                Imagen actual en servidor. Sube una nueva para reemplazar.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-8 flex gap-3">
        <button
          type="submit"
          class="rounded-xl bg-brasper-indigoStrong px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brasper-indigoDark disabled:opacity-50"
          :disabled="saving"
        >
          {{ saving ? 'Guardando...' : (currentBanner ? 'Actualizar banner' : 'Crear banner') }}
        </button>
        <button
          type="button"
          class="rounded-xl border border-[#e5e7eb] bg-white px-5 py-2.5 text-sm font-medium text-[#374151] transition hover:bg-[#f9fafb]"
          :disabled="saving"
          @click="loadBanner"
        >
          Recargar
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { HomeBannerApiAdapter } from '../../infrastructure/adapters'
import { Domain } from '@/interface/infrastructure/services'
import type { HomeBanner } from '../../domain/models'

const repo = new HomeBannerApiAdapter()
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const successMessage = ref('')
const currentBanner = ref<HomeBanner | null>(null)

const enable = ref(true)
const fileEs = ref<File | null>(null)
const filePr = ref<File | null>(null)
const fileEn = ref<File | null>(null)

function mediaUrl(path: string | null | undefined): string {
  if (!path?.trim()) return ''
  const trimmed = path.trim()
  if (trimmed.startsWith('http')) return trimmed
  return Domain.mediaUrl(trimmed)
}

const previewEs = computed(() => {
  if (fileEs.value) return URL.createObjectURL(fileEs.value)
  return mediaUrl(currentBanner.value?.banner_es) || ''
})
const previewPr = computed(() => {
  if (filePr.value) return URL.createObjectURL(filePr.value)
  return mediaUrl(currentBanner.value?.banner_pr) || ''
})
const previewEn = computed(() => {
  if (fileEn.value) return URL.createObjectURL(fileEn.value)
  return mediaUrl(currentBanner.value?.banner_en) || ''
})

function onFileChange(event: Event, lang: 'es' | 'pr' | 'en') {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (lang === 'es') fileEs.value = file ?? null
  if (lang === 'pr') filePr.value = file ?? null
  if (lang === 'en') fileEn.value = file ?? null
}

async function loadBanner() {
  loading.value = true
  error.value = ''
  try {
    currentBanner.value = await repo.getBanner()
    if (currentBanner.value) {
      enable.value = currentBanner.value.enable
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar el banner'
    currentBanner.value = null
  } finally {
    loading.value = false
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
        banner_es: fileEs.value ?? (currentBanner.value.banner_es || undefined),
        banner_pr: filePr.value ?? (currentBanner.value.banner_pr || undefined),
        banner_en: fileEn.value ?? (currentBanner.value.banner_en || undefined)
      })
      successMessage.value = 'Banner actualizado correctamente.'
    } else {
      await repo.createBanner({
        enable: enable.value,
        banner_es: fileEs.value ?? null,
        banner_pr: filePr.value ?? null,
        banner_en: fileEn.value ?? null
      })
      successMessage.value = 'Banner creado correctamente.'
    }
    fileEs.value = null
    filePr.value = null
    fileEn.value = null
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
