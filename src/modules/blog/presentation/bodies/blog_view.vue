<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { BlogApiAdapter } from '../../infrastructure/adapters/blog_api_adapter'
import type { Blog } from '../../domain/models/blog'
import type { BlogPayload } from '../../infrastructure/adapters/blog_repository'

// Repositorio API
const blogRepo = new BlogApiAdapter()

// Estados de la lista
const blogs = ref<Blog[]>([])
const totalItems = ref(0)
const currentPage = ref(1)
const itemsPerPage = ref(10)
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Estados de búsqueda y filtros
const searchFilter = ref('')
const categoryFilter = ref('')
const languageFilter = ref('')
const statusFilter = ref('') // 'enabled', 'disabled'

// Estados del modal y formulario
const isModalOpen = ref(false)
const isSaving = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const activeBlogId = ref<string | null>(null)

// Modelo de datos del formulario
const form = ref<BlogPayload>({
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  category: '',
  public_id: '',
  read_time: 5,
  date: '',
  language: 'es',
  enable: true
})

// Seguimiento del slug manual
const isSlugManuallyEdited = ref(false)

// Estados de carga de imágenes a Cloudinary
const isUploadingCover = ref(false)
const CLOUD_NAME = 'dhkmdutec'
const UPLOAD_PRESET = 'blog_brasper'

const contentFileName = ref('')
const contentViewMode = ref<'preview' | 'html'>('preview')
const isImportingContent = ref(false)

const contentPreviewHtml = computed(() => {
  const raw = form.value.content.trim()
  if (!raw) {
    return '<div class="empty-preview">Sin contenido cargado.</div>'
  }

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
        padding: 24px;
        color: #1f2937;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.65;
        background: #ffffff;
      }
      img, video, iframe {
        max-width: 100%;
        height: auto;
        border-radius: 12px;
      }
      h1, h2, h3 {
        color: #232b4d;
        line-height: 1.2;
      }
      a {
        color: #3F51B5;
      }
      ol, ul {
        margin: 14px 0 14px 24px;
        padding-left: 20px;
      }
      ol {
        list-style-type: decimal;
      }
      ol ol {
        list-style-type: lower-alpha;
      }
      ol ol ol {
        list-style-type: lower-roman;
      }
      ul {
        list-style-type: disc;
      }
      ul ul {
        list-style-type: circle;
      }
      li {
        margin: 6px 0;
        padding-left: 4px;
      }
      li > p {
        margin: 4px 0;
      }
      blockquote {
        margin: 20px 0;
        padding: 12px 18px;
        border-left: 4px solid #3F51B5;
        background: #f5f7ff;
      }
      .empty-preview {
        display: grid;
        min-height: 240px;
        place-items: center;
        color: #9ca3af;
        font-size: 13px;
      }
    </style>
  </head>
  <body>${raw}</body>
</html>`
})

// Carga inicial
onMounted(() => {
  loadBlogs()
})

// Cargar posts con paginación
async function loadBlogs() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const skip = (currentPage.value - 1) * itemsPerPage.value
    const { items, total } = await blogRepo.listBlogs(skip, itemsPerPage.value)
    blogs.value = items
    totalItems.value = total
  } catch (error: any) {
    errorMessage.value = error.response?.data?.detail || 'Error al cargar los artículos del blog'
  } finally {
    isLoading.value = false
  }
}

// Filtros y búsqueda local + paginación reactiva
watch([currentPage, itemsPerPage], () => {
  loadBlogs()
})

// Filtrado de items mostrados
const filteredBlogs = computed(() => {
  return blogs.value.filter((blog: Blog) => {
    // Búsqueda por título o extracto
    const matchesSearch = searchFilter.value
      ? blog.title.toLowerCase().includes(searchFilter.value.toLowerCase()) ||
        (blog.excerpt && blog.excerpt.toLowerCase().includes(searchFilter.value.toLowerCase()))
      : true

    // Filtro por categoría
    const matchesCategory = categoryFilter.value
      ? blog.category?.toLowerCase() === categoryFilter.value.toLowerCase()
      : true

    // Filtro por idioma
    const matchesLanguage = languageFilter.value
      ? blog.language === languageFilter.value
      : true

    // Filtro por estado
    const matchesStatus = statusFilter.value
      ? (statusFilter.value === 'enabled' ? blog.enable : !blog.enable)
      : true

    return matchesSearch && matchesCategory && matchesLanguage && matchesStatus
  })
})

const totalPages = computed(() => Math.ceil(totalItems.value / itemsPerPage.value))

// Categorías únicas detectadas para el selector de filtro
const uniqueCategories = computed<string[]>(() => {
  const cats = blogs.value.map((b: Blog) => b.category).filter((c: string | null | undefined): c is string => !!c)
  return Array.from(new Set(cats))
})

function getLanguageBadgeLabel(language: string): string {
  const map: Record<string, string> = {
    es: 'ES',
    en: 'EN',
    pr: 'PT'
  }
  return map[language] ?? language.toUpperCase()
}

// Generador de slug a partir del título
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD') // Quita acentos y diacríticos
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '') // Elimina caracteres no alfanuméricos
    .replace(/[\s_]+/g, '-') // Cambia espacios y guiones bajos por guiones
    .replace(/-+/g, '-') // Quita guiones duplicados
    .replace(/^-+|-+$/g, '') // Elimina guiones iniciales o finales
}

// Auto-generación del slug reactiva
watch(() => form.value.title, (newTitle) => {
  if (modalMode.value === 'create' && !isSlugManuallyEdited.value) {
    form.value.slug = generateSlug(newTitle)
  }
})

// Si el usuario cambia el slug manualmente, desactivamos la auto-generación
function handleSlugInput() {
  isSlugManuallyEdited.value = true
}

// Formatear fechas para input datetime-local (YYYY-MM-DDTHH:MM)
function formatDateTimeLocal(dateStr?: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Construye URL de previsualización para Cloudinary
function getCloudinaryUrl(publicId?: string | null): string {
  if (!publicId) return ''
  if (publicId.startsWith('http://') || publicId.startsWith('https://')) return publicId
  return `https://res.cloudinary.com/dhkmdutec/image/upload/f_auto,q_auto,w_900/${publicId}`
}

// Subir Imagen de Portada a Cloudinary
async function handleCoverUpload(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  isUploadingCover.value = true
  errorMessage.value = ''
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', UPLOAD_PRESET)

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData
    })
    if (!res.ok) throw new Error('Error en el servidor de Cloudinary')

    const data = await res.json()
    form.value.public_id = data.public_id
    showToast('success', 'Portada cargada correctamente')
  } catch (error: any) {
    showToast('error', 'Error al cargar imagen: ' + error.message)
  } finally {
    isUploadingCover.value = false
    target.value = '' // reset input
  }
}

// Mostrar Toasts rápidos
function showToast(type: 'success' | 'error', msg: string) {
  if (type === 'success') {
    successMessage.value = msg
    setTimeout(() => successMessage.value = '', 4000)
  } else {
    errorMessage.value = msg
    setTimeout(() => errorMessage.value = '', 5000)
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function plainTextToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

function markdownToBasicHtml(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return ''
      if (trimmed.startsWith('### ')) return `<h3>${escapeHtml(trimmed.slice(4))}</h3>`
      if (trimmed.startsWith('## ')) return `<h2>${escapeHtml(trimmed.slice(3))}</h2>`
      if (trimmed.startsWith('# ')) return `<h1>${escapeHtml(trimmed.slice(2))}</h1>`
      return `<p>${escapeHtml(trimmed)}</p>`
    })
    .join('\n')
}

function inferTitleFromHtml(html: string): string {
  const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/is) ?? html.match(/<title[^>]*>(.*?)<\/title>/is)
  if (!titleMatch?.[1]) return ''
  return titleMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function inferExcerptFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

async function handleContentFileUpload(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const name = file.name.toLowerCase()
  const isDocx = name.endsWith('.docx')
  const isHtml = name.endsWith('.html') || name.endsWith('.htm')
  const isText = name.endsWith('.txt')
  const isMarkdown = name.endsWith('.md') || name.endsWith('.markdown')

  if (!isDocx && !isHtml && !isText && !isMarkdown) {
    showToast('error', 'Sube un archivo .docx, .html, .htm, .txt o .md para cargar el cuerpo del artículo.')
    target.value = ''
    return
  }

  isImportingContent.value = true
  try {
    const content = isDocx
      ? (await import('mammoth').then(async (mammoth) =>
          mammoth.default.convertToHtml(
            { arrayBuffer: await file.arrayBuffer() },
            { convertImage: mammoth.default.images.dataUri }
          )
        )).value
      : ''
    const textContent = isDocx ? '' : await file.text()
    const normalizedContent = isDocx
      ? content
      : isHtml
        ? textContent
        : isMarkdown
          ? markdownToBasicHtml(textContent)
          : plainTextToHtml(textContent)
    form.value.content = normalizedContent
    contentFileName.value = file.name
    contentViewMode.value = 'preview'

    if (!form.value.title.trim()) {
      const inferredTitle = inferTitleFromHtml(normalizedContent)
      if (inferredTitle) form.value.title = inferredTitle
    }
    if (!form.value.excerpt?.trim()) {
      form.value.excerpt = inferExcerptFromHtml(normalizedContent)
    }

    showToast('success', 'Contenido cargado desde archivo')
  } catch (error: any) {
    showToast('error', 'No se pudo leer el archivo: ' + (error?.message ?? 'error desconocido'))
  } finally {
    isImportingContent.value = false
    target.value = ''
  }
}

// Abrir modal de creación
function openCreateModal() {
  modalMode.value = 'create'
  activeBlogId.value = null
  isSlugManuallyEdited.value = false

  form.value = {
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    category: '',
    public_id: '',
    read_time: 5,
    date: formatDateTimeLocal(new Date().toISOString()),
    language: 'es',
    enable: true
  }
  contentFileName.value = ''
  contentViewMode.value = 'preview'

  isModalOpen.value = true
}

// Abrir modal de edición
async function openEditModal(blog: Blog) {
  modalMode.value = 'edit'
  activeBlogId.value = blog.id
  isSlugManuallyEdited.value = true
  isLoading.value = true
  errorMessage.value = ''

  let blogDetail = blog
  try {
    blogDetail = await blogRepo.getBlogById(blog.id)
  } catch (error: any) {
    errorMessage.value = error.response?.data?.detail || 'Error al cargar el artículo'
    isLoading.value = false
    return
  } finally {
    isLoading.value = false
  }

  form.value = {
    title: blogDetail.title,
    slug: blogDetail.slug,
    excerpt: blogDetail.excerpt ?? '',
    content: blogDetail.content,
    category: blogDetail.category ?? '',
    public_id: blogDetail.public_id ?? '',
    read_time: blogDetail.read_time ?? 5,
    date: formatDateTimeLocal(blogDetail.date),
    language: blogDetail.language,
    enable: blogDetail.enable
  }
  contentFileName.value = ''
  contentViewMode.value = 'preview'

  isModalOpen.value = true
}

// Cerrar modal
function closeModal() {
  isModalOpen.value = false
}

// Guardar Formulario (Crear o Actualizar)
async function handleSaveBlog() {
  if (!form.value.title || !form.value.slug || !form.value.content || !form.value.language) {
    showToast('error', 'Por favor complete todos los campos obligatorios.')
    return
  }

  isSaving.value = true
  errorMessage.value = ''
  try {
    // Formatear fecha para el backend
    const payload = {
      ...form.value,
      date: form.value.date ? new Date(form.value.date).toISOString() : null,
      excerpt: form.value.excerpt || null,
      category: form.value.category || null,
      public_id: form.value.public_id || null,
      read_time: form.value.read_time ? Number(form.value.read_time) : null
    }

    if (modalMode.value === 'create') {
      const savedBlog = await blogRepo.createBlog(payload)
      blogs.value = [savedBlog, ...blogs.value]
      showToast('success', 'Artículo creado correctamente')
    } else {
      if (!activeBlogId.value) return
      const savedBlog = await blogRepo.updateBlog({
        ...payload,
        id: activeBlogId.value
      })
      blogs.value = blogs.value.map((blog) =>
        blog.id === savedBlog.id ? savedBlog : blog
      )
      showToast('success', 'Artículo actualizado correctamente')
    }

    closeModal()
    await loadBlogs()
  } catch (error: any) {
    errorMessage.value = error.response?.data?.detail || 'Ocurrió un error al guardar el artículo'
  } finally {
    isSaving.value = false
  }
}

// Eliminar post del blog
async function handleDeleteBlog(blog: Blog) {
  if (!window.confirm(`¿Está seguro de eliminar el artículo "${blog.title}"? Esta acción no se puede deshacer.`)) {
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  try {
    await blogRepo.deleteBlog(blog.id)
    showToast('success', 'Artículo eliminado con éxito')
    loadBlogs()
  } catch (error: any) {
    errorMessage.value = error.response?.data?.detail || 'Error al intentar eliminar el artículo'
  } finally {
    isLoading.value = false
  }
}

// Cambiar de página
function setPage(page: number) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
}
</script>

<template>
  <div class="space-y-6">
    <!-- Mensajes de Estado Flotantes -->
    <div
      v-if="successMessage"
      class="fixed top-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 shadow-xl transition-all duration-300"
    >
      <svg class="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span class="text-sm font-medium">{{ successMessage }}</span>
    </div>

    <div
      v-if="errorMessage"
      class="fixed top-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 shadow-xl transition-all duration-300"
    >
      <svg class="h-5 w-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span class="text-sm font-medium">{{ errorMessage }}</span>
    </div>

    <!-- Encabezado Principal -->
    <section class="rounded-2xl border border-[#d8e5fb] bg-white p-6 shadow-lg shadow-brasper-indigoStrong/10">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brasper-indigoStrong">Publicaciones</p>
          <h1 class="text-2xl font-semibold text-[#232b4d]">Gestión de Blog</h1>
          <p class="mt-1 text-sm text-[#667085]">
            Crea, edita y administra los artículos del blog corporativo en múltiples idiomas.
          </p>
        </div>
        <button
          type="button"
          @click="openCreateModal"
          class="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brasper-indigoStrong to-brasper-indigoDark px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:scale-[1.02] hover:shadow-lg hover:shadow-brasper-indigoStrong/20 active:scale-[0.98]"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Artículo
        </button>
      </div>
    </section>

    <!-- Filtros de búsqueda -->
    <section class="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5">
        <!-- Búsqueda -->
        <div class="relative md:col-span-2">
          <label class="block text-xs font-semibold text-neutral-500 uppercase mb-1.5">Buscar</label>
          <div class="relative">
            <input
              v-model="searchFilter"
              type="text"
              placeholder="Buscar por título o extracto..."
              class="w-full rounded-xl border border-neutral-300 bg-neutral-50 py-2 pl-9 pr-4 text-sm outline-none transition focus:border-brasper-indigoStrong focus:bg-white"
            />
            <svg class="absolute left-3 top-2.5 h-4.5 w-4.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <!-- Categorías -->
        <div>
          <label class="block text-xs font-semibold text-neutral-500 uppercase mb-1.5">Categoría</label>
          <select
            v-model="categoryFilter"
            class="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm outline-none transition focus:border-brasper-indigoStrong focus:bg-white"
          >
            <option value="">Todas</option>
            <option v-for="cat in uniqueCategories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>

        <!-- Idioma -->
        <div>
          <label class="block text-xs font-semibold text-neutral-500 uppercase mb-1.5">Idioma</label>
          <select
            v-model="languageFilter"
            class="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm outline-none transition focus:border-brasper-indigoStrong focus:bg-white"
          >
            <option value="">Todos</option>
            <option value="es">Español (ES)</option>
            <option value="pr">Portugués (PR)</option>
            <option value="en">Inglés (EN)</option>
          </select>
        </div>

        <!-- Estado -->
        <div>
          <label class="block text-xs font-semibold text-neutral-500 uppercase mb-1.5">Estado</label>
          <select
            v-model="statusFilter"
            class="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm outline-none transition focus:border-brasper-indigoStrong focus:bg-white"
          >
            <option value="">Todos</option>
            <option value="enabled">Habilitados</option>
            <option value="disabled">Deshabilitados</option>
          </select>
        </div>
      </div>
    </section>

    <!-- Tabla Principal -->
    <div class="overflow-hidden rounded-2xl border border-[#d8e5fb] bg-white shadow-lg shadow-brasper-indigoStrong/10">
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-16 gap-3">
        <svg class="h-10 w-10 animate-spin text-brasper-indigoStrong" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span class="text-sm font-medium text-neutral-500">Cargando artículos...</span>
      </div>

      <div v-else-if="filteredBlogs.length === 0" class="py-16 text-center text-neutral-500">
        <svg class="mx-auto h-12 w-12 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 4a2 2 0 00-2-2m2 2a2 2 0 11-4 0m4 0v8a2 2 0 01-2 2h-1m-4-7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        <h3 class="mt-4 text-lg font-semibold text-neutral-700">No se encontraron artículos</h3>
        <p class="mt-1 text-sm text-neutral-500">Intenta cambiar los términos de búsqueda o crear una nueva publicación.</p>
      </div>

      <template v-else>
        <div class="overflow-x-auto">
          <table class="w-full table-auto text-left">
            <thead class="border-b border-neutral-200/90 bg-neutral-50 text-xs font-bold uppercase tracking-wider text-neutral-600">
              <tr>
                <th class="px-6 py-4">Portada</th>
                <th class="px-6 py-4">Título / Slug</th>
                <th class="px-6 py-4">Categoría</th>
                <th class="px-6 py-4">Idioma</th>
                <th class="px-6 py-4">Fecha</th>
                <th class="px-6 py-4">Estado</th>
                <th class="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-200/90 text-sm text-neutral-700">
              <tr
                v-for="blog in filteredBlogs"
                :key="blog.id"
                class="transition hover:bg-neutral-50/50"
              >
                <!-- Portada -->
                <td class="px-6 py-4">
                  <div class="h-10 w-16 overflow-hidden rounded-lg bg-neutral-100 border border-neutral-200">
                    <img
                      v-if="blog.public_id"
                      :src="getCloudinaryUrl(blog.public_id)"
                      alt="Cover"
                      class="h-full w-full object-cover"
                    />
                    <div v-else class="flex h-full w-full items-center justify-center text-[10px] font-bold text-neutral-400 uppercase">
                      Sin Foto
                    </div>
                  </div>
                </td>

                <!-- Título y Slug -->
                <td class="px-6 py-4 max-w-xs md:max-w-md">
                  <div class="font-semibold text-neutral-800 line-clamp-1">{{ blog.title }}</div>
                  <div class="text-xs text-neutral-500 font-mono line-clamp-1">/{{ blog.slug }}</div>
                </td>

                <!-- Categoría -->
                <td class="px-6 py-4">
                  <span class="rounded-lg bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-600 uppercase">
                    {{ blog.category || 'Sin Categoría' }}
                  </span>
                </td>

                <!-- Idioma -->
                <td class="px-6 py-4 uppercase font-bold text-xs">
                  <span
                    class="inline-block rounded px-2 py-0.5"
                    :class="{
                      'bg-sky-100 text-sky-800': blog.language === 'es',
                      'bg-emerald-100 text-emerald-800': blog.language === 'pr',
                      'bg-purple-100 text-purple-800': blog.language === 'en'
                    }"
                  >
                    {{ getLanguageBadgeLabel(blog.language) }}
                  </span>
                </td>

                <!-- Fecha -->
                <td class="px-6 py-4 text-xs font-mono text-neutral-600">
                  {{ blog.date ? new Date(blog.date).toLocaleDateString() : 'Borrador' }}
                </td>

                <!-- Estado -->
                <td class="px-6 py-4">
                  <span
                    class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold"
                    :class="blog.enable ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'"
                  >
                    <span class="h-1.5 w-1.5 rounded-full" :class="blog.enable ? 'bg-emerald-500' : 'bg-neutral-400'" />
                    {{ blog.enable ? 'Habilitado' : 'Deshabilitado' }}
                  </span>
                </td>

                <!-- Acciones -->
                <td class="px-6 py-4 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      @click="openEditModal(blog)"
                      class="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-brasper-indigoStrong"
                      title="Editar artículo"
                    >
                      <svg class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      @click="handleDeleteBlog(blog)"
                      class="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-rose-50 hover:text-rose-600"
                      title="Eliminar artículo"
                    >
                      <svg class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Controles de Paginación -->
        <div class="flex items-center justify-between border-t border-neutral-200/90 bg-neutral-50 px-6 py-4">
          <span class="text-xs text-neutral-500">
            Mostrando página {{ currentPage }} de {{ totalPages || 1 }} ({{ totalItems }} artículos en total)
          </span>
          <div class="flex items-center gap-2">
            <button
              type="button"
              :disabled="currentPage <= 1"
              @click="setPage(currentPage - 1)"
              class="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 disabled:hover:bg-white"
            >
              Anterior
            </button>
            <button
              type="button"
              :disabled="currentPage >= totalPages"
              @click="setPage(currentPage + 1)"
              class="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 disabled:hover:bg-white"
            >
              Siguiente
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- MODAL DE DETALLE / FORMULARIO CRUD -->
    <div
      v-if="isModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="relative flex flex-col w-full max-w-6xl h-[90vh] rounded-3xl bg-white shadow-2xl overflow-hidden transition-all duration-300 scale-100"
      >
        <!-- Modal Header -->
        <div class="flex items-center justify-between border-b border-neutral-200 px-8 py-5">
          <div>
            <h2 class="text-xl font-bold text-neutral-800">
              {{ modalMode === 'create' ? 'Crear Nuevo Artículo' : 'Editar Artículo' }}
            </h2>
            <p class="text-xs text-neutral-500 mt-1">Completa los metadatos y el cuerpo de la publicación.</p>
          </div>
          <button
            type="button"
            @click="closeModal"
            class="rounded-xl p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
          >
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Modal Body (Split Layout: Configuración a la izquierda, Contenido a la derecha) -->
        <div class="flex-1 overflow-y-auto p-8 bg-neutral-50">
          <div class="grid grid-cols-1 gap-8 lg:grid-cols-12 h-full">
            <!-- Sección Configuración (Izquierda) -->
            <div class="space-y-5 lg:col-span-5 bg-white rounded-2xl border border-neutral-200 p-6">
              <h3 class="text-sm font-bold text-neutral-800 border-b pb-2 mb-4 uppercase tracking-wider text-brasper-indigoStrong">
                Metadatos y Configuración
              </h3>

              <!-- Título -->
              <div>
                <label class="block text-xs font-bold text-neutral-600 mb-1.5">Título <span class="text-rose-500">*</span></label>
                <input
                  v-model="form.title"
                  type="text"
                  required
                  placeholder="Ingrese el título del artículo..."
                  class="w-full rounded-xl border border-neutral-300 px-3.5 py-2 text-sm outline-none transition focus:border-brasper-indigoStrong focus:ring-2 focus:ring-brasper-indigoStrong/15"
                />
              </div>

              <!-- Slug -->
              <div>
                <label class="block text-xs font-bold text-neutral-600 mb-1.5">Ruta URL (Slug) <span class="text-rose-500">*</span></label>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-sm text-neutral-400 font-mono select-none">/</span>
                  <input
                    v-model="form.slug"
                    type="text"
                    required
                    @input="handleSlugInput"
                    placeholder="ej-mi-articulo-nuevo"
                    class="w-full rounded-xl border border-neutral-300 pl-6 pr-3.5 py-2 text-sm font-mono outline-none transition focus:border-brasper-indigoStrong focus:ring-2 focus:ring-brasper-indigoStrong/15"
                  />
                </div>
              </div>

              <!-- Categoría e Idioma -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-bold text-neutral-600 mb-1.5">Categoría</label>
                  <input
                    v-model="form.category"
                    type="text"
                    placeholder="ej. Finanzas"
                    class="w-full rounded-xl border border-neutral-300 px-3.5 py-2 text-sm outline-none transition focus:border-brasper-indigoStrong"
                  />
                </div>
                <div>
                  <label class="block text-xs font-bold text-neutral-600 mb-1.5">Idioma <span class="text-rose-500">*</span></label>
                  <select
                    v-model="form.language"
                    required
                    class="w-full rounded-xl border border-neutral-300 px-3.5 py-2 text-sm outline-none transition focus:border-brasper-indigoStrong"
                  >
                    <option value="es">Español (ES)</option>
                    <option value="pr">Portugués (PR)</option>
                    <option value="en">Inglés (EN)</option>
                  </select>
                  <p class="mt-1 text-[10px] leading-snug text-neutral-500">
                    Cambia la clasificación del artículo; el contenido debe subirse en ese idioma.
                  </p>
                </div>
              </div>

              <!-- Tiempo de lectura y Fecha -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-bold text-neutral-600 mb-1.5">Lectura (minutos)</label>
                  <input
                    v-model.number="form.read_time"
                    type="number"
                    min="1"
                    class="w-full rounded-xl border border-neutral-300 px-3.5 py-2 text-sm outline-none transition focus:border-brasper-indigoStrong"
                  />
                </div>
                <div>
                  <label class="block text-xs font-bold text-neutral-600 mb-1.5">Fecha del artículo</label>
                  <input
                    v-model="form.date"
                    type="datetime-local"
                    class="w-full rounded-xl border border-neutral-300 px-3.5 py-2 text-sm outline-none transition focus:border-brasper-indigoStrong"
                  />
                </div>
              </div>

              <!-- Extracto / Resumen -->
              <div>
                <label class="block text-xs font-bold text-neutral-600 mb-1.5">Extracto o Resumen corto</label>
                <textarea
                  v-model="form.excerpt"
                  rows="2"
                  placeholder="Una breve descripción para los listados del blog..."
                  class="w-full resize-none rounded-xl border border-neutral-300 px-3.5 py-2 text-sm outline-none transition focus:border-brasper-indigoStrong"
                />
              </div>

              <!-- Imagen de Portada (Carga directa a Cloudinary) -->
              <div>
                <label class="block text-xs font-bold text-neutral-600 mb-1.5">Imagen de Portada (Cloudinary)</label>
                <div class="mt-1 flex flex-col gap-3 rounded-xl border-2 border-dashed border-neutral-300 p-4 text-center">
                  <!-- Visualización de la miniatura -->
                  <div v-if="form.public_id" class="relative group mx-auto h-28 w-44 overflow-hidden rounded-xl border border-neutral-200 shadow-sm bg-neutral-100">
                    <img :src="getCloudinaryUrl(form.public_id)" class="h-full w-full object-cover" />
                    <button
                      type="button"
                      @click="form.public_id = ''"
                      class="absolute top-1.5 right-1.5 bg-black/75 hover:bg-black text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      title="Quitar imagen"
                    >
                      <svg class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div v-else class="text-neutral-400 py-3">
                    <svg class="mx-auto h-9 w-9 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p class="text-xs mt-1">Soporta PNG, JPG o WEBP</p>
                  </div>

                  <!-- Botón de subir / Spinner -->
                  <div class="flex items-center justify-center">
                    <label class="cursor-pointer relative">
                      <span
                        class="inline-block rounded-xl border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-50"
                        :class="{'pointer-events-none opacity-50': isUploadingCover}"
                      >
                        {{ isUploadingCover ? 'Cargando...' : (form.public_id ? 'Cambiar Imagen' : 'Seleccionar Imagen') }}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        @change="handleCoverUpload"
                        class="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <!-- Estado (Habilitado / Borrador) -->
              <div class="flex items-center justify-between rounded-xl bg-neutral-50 p-3.5 border border-neutral-200">
                <div>
                  <span class="text-sm font-semibold text-neutral-700">Estado del artículo</span>
                  <p class="text-[11px] text-neutral-500 mt-0.5">Define si es visible públicamente.</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="form.enable" class="sr-only peer" />
                  <div class="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brasper-indigoStrong"></div>
                </label>
              </div>
            </div>

            <!-- Sección Contenido e Herramienta Imagen (Derecha) -->
            <div class="space-y-5 lg:col-span-7 flex flex-col h-full">
              <!-- Cargador y vista del contenido -->
              <div class="flex-1 bg-white rounded-2xl border border-neutral-200 p-6 flex flex-col min-h-[460px]">
                <div class="flex flex-wrap items-start justify-between gap-4 border-b pb-3 mb-4">
                  <div>
                    <h3 class="text-sm font-bold text-neutral-800 uppercase tracking-wider text-brasper-indigoStrong">
                      Cuerpo del Artículo <span class="text-rose-500">*</span>
                    </h3>
                    <p class="mt-1 text-xs text-neutral-500">
                      Carga un archivo y revisa cómo se verá antes de guardar.
                    </p>
                  </div>

                  <div class="flex items-center gap-2">
                    <div class="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-1">
                      <button
                        type="button"
                        class="rounded-md px-3 py-1.5 text-xs font-bold transition"
                        :class="contentViewMode === 'preview' ? 'bg-white text-brasper-indigoStrong shadow-sm' : 'text-neutral-500 hover:text-neutral-800'"
                        @click="contentViewMode = 'preview'"
                      >
                        Vista
                      </button>
                      <button
                        type="button"
                        class="rounded-md px-3 py-1.5 text-xs font-bold transition"
                        :class="contentViewMode === 'html' ? 'bg-white text-brasper-indigoStrong shadow-sm' : 'text-neutral-500 hover:text-neutral-800'"
                        @click="contentViewMode = 'html'"
                      >
                        HTML
                      </button>
                    </div>
                  </div>
                </div>

                <div class="mb-4 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-4">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div class="min-w-0">
                      <p class="text-sm font-semibold text-neutral-700">
                        {{ contentFileName || 'Subir cuerpo del artículo' }}
                      </p>
                      <p class="mt-0.5 text-xs text-neutral-500">
                        Soporta DOCX, HTML, HTM, TXT o Markdown. El contenido cargado reemplaza el cuerpo actual.
                      </p>
                    </div>
                    <label class="cursor-pointer">
                      <span
                        class="inline-flex items-center gap-2 rounded-xl bg-brasper-indigoStrong px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brasper-indigoDark"
                        :class="{ 'pointer-events-none opacity-60': isImportingContent }"
                      >
                        <svg
                          class="h-4 w-4"
                          :class="{ 'animate-spin': isImportingContent }"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        {{ isImportingContent ? 'Procesando...' : 'Seleccionar Archivo' }}
                      </span>
                      <input
                        type="file"
                        accept=".docx,.html,.htm,.txt,.md,.markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html,text/plain,text/markdown"
                        class="hidden"
                        @change="handleContentFileUpload"
                      />
                    </label>
                  </div>
                </div>

                <iframe
                  v-if="contentViewMode === 'preview'"
                  title="Vista previa del artículo"
                  sandbox=""
                  :srcdoc="contentPreviewHtml"
                  class="min-h-[320px] flex-1 w-full rounded-xl border border-neutral-300 bg-white"
                />

                <textarea
                  v-else
                  v-model="form.content"
                  required
                  placeholder="El HTML del artículo aparecerá aquí al subir el archivo. También puedes ajustar el código manualmente."
                  class="flex-1 w-full p-4 rounded-xl border border-neutral-300 text-sm font-mono outline-none focus:border-brasper-indigoStrong focus:ring-2 focus:ring-brasper-indigoStrong/15 resize-none min-h-[320px]"
                />
              </div>

            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="flex items-center justify-end gap-3 border-t border-neutral-200 px-8 py-5">
          <button
            type="button"
            @click="closeModal"
            class="rounded-xl border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            @click="handleSaveBlog"
            :disabled="isSaving"
            class="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brasper-indigoStrong to-brasper-indigoDark px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          >
            <svg v-if="isSaving" class="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ isSaving ? 'Guardando...' : 'Guardar Artículo' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Transiciones para barras de desplazamiento en imágenes */
.overflow-x-auto {
  scrollbar-width: thin;
  scrollbar-color: #3F51B5 rgba(0, 0, 0, 0.05);
}
</style>
