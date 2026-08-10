<script setup lang="ts">
/**
 * Configuración > Etiquetas.
 *
 * Ventas usa las etiquetas al registrar envíos; aquí solo se administra el
 * catálogo. Dos reglas que la UI hace explícitas porque no son obvias:
 * - «Cuenta como cliente nuevo» es exclusivo: marcarlo en una lo quita de la otra.
 * - Desactivar no es borrar: una etiqueta inactiva deja de ofrecerse al
 *   registrar, pero sigue visible en los envíos que ya la tenían.
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '@modules/auth/presentation/controllers/use_auth_store_controller'
import { useTagsStore } from '../controllers/use_tags_store_controller'
import {
  TAG_COLOR_KEYS,
  tagColorStyle,
  type TagColorKey,
  type TransactionTag
} from '../../domain/models'
import { ConfirmDialog } from '@interface/widgets'

defineOptions({ name: 'EtiquetasView' })

const authStore = useAuthStore()
const tagsStore = useTagsStore()

const canCreate = computed(() => authStore.hasPermission('tags.create'))
const canUpdate = computed(() => authStore.hasPermission('tags.update'))
const canDelete = computed(() => authStore.hasPermission('tags.delete'))

const showModal = ref(false)
const editingId = ref<string | null>(null)
const formError = ref('')

const form = reactive({
  label: '',
  color: 'amber' as TagColorKey,
  active: true,
  counts_as_new_client: false
})

const showDeleteConfirm = ref(false)
const pendingDelete = ref<TransactionTag | null>(null)
const deleting = ref(false)

const modalTitle = computed(() =>
  editingId.value ? 'Editar etiqueta' : 'Nueva etiqueta'
)

const previewStyle = computed(() => {
  const c = tagColorStyle(form.color)
  return { background: c.bg, color: c.fg, borderColor: c.bd }
})

function chipStyle(tag: TransactionTag) {
  const c = tagColorStyle(tag.color)
  return { background: c.bg, color: c.fg, borderColor: c.bd }
}

function swatchStyle(color: TagColorKey) {
  const c = tagColorStyle(color)
  return { background: c.bg, boxShadow: `inset 0 0 0 1px ${c.bd}` }
}

function openCreate() {
  editingId.value = null
  formError.value = ''
  form.label = ''
  form.color = 'amber'
  form.active = true
  form.counts_as_new_client = false
  showModal.value = true
}

function openEdit(tag: TransactionTag) {
  editingId.value = tag.id
  formError.value = ''
  form.label = tag.label
  form.color = tag.color
  form.active = tag.active
  form.counts_as_new_client = tag.counts_as_new_client
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingId.value = null
}

async function submit() {
  const label = form.label.trim()
  if (!label) {
    formError.value = 'El nombre es obligatorio.'
    return
  }
  formError.value = ''
  try {
    if (editingId.value) {
      await tagsStore.updateTag({
        id: editingId.value,
        label,
        color: form.color,
        active: form.active,
        counts_as_new_client: form.counts_as_new_client
      })
    } else {
      await tagsStore.createTag({
        label,
        color: form.color,
        active: form.active,
        counts_as_new_client: form.counts_as_new_client,
        position: tagsStore.tags.length
      })
    }
    closeModal()
  } catch {
    // El store ya dejó el mensaje; el modal sigue abierto para corregir.
    formError.value = tagsStore.error ?? 'No se pudo guardar la etiqueta.'
  }
}

function askDelete(tag: TransactionTag) {
  pendingDelete.value = tag
  showDeleteConfirm.value = true
}

const deleteMessage = computed(() =>
  pendingDelete.value
    ? `Se quitará «${pendingDelete.value.label}» del catálogo y de las transacciones que la tengan. ` +
      'Si solo quieres dejar de ofrecerla al registrar, desactívala en vez de borrarla.'
    : ''
)

async function confirmDelete() {
  const tag = pendingDelete.value
  if (!tag) return
  deleting.value = true
  try {
    await tagsStore.deleteTag(tag.id)
    showDeleteConfirm.value = false
    pendingDelete.value = null
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  void tagsStore.loadTags(true)
})
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-[#232b4d]">Etiquetas</h1>
        <p class="mt-1 text-sm text-[#6b7280]">
          Catálogo que ventas aplica a las transacciones.
        </p>
      </div>
      <button
        v-if="canCreate"
        type="button"
        class="inline-flex items-center gap-2 rounded-lg bg-brasper-indigoStrong px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        @click="openCreate"
      >
        + Nueva etiqueta
      </button>
    </div>

    <div
      v-if="tagsStore.error && !showModal"
      class="rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]"
    >
      {{ tagsStore.error }}
    </div>

    <div
      v-if="!tagsStore.newClientTag && tagsStore.hasLoadedOnce && tagsStore.tags.length"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      Ninguna etiqueta está marcada como «cuenta como cliente nuevo», así que el
      indicador de clientes nuevos del día quedará en cero.
    </div>

    <div class="overflow-x-auto rounded-xl border border-[#e5e7eb] bg-white">
      <table class="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr class="bg-[#dbeafe]">
            <th class="px-4 py-3 font-semibold text-brasper-indigoDark">Etiqueta</th>
            <th class="px-4 py-3 text-center font-semibold text-brasper-indigoDark">
              Cuenta como cliente nuevo
            </th>
            <th class="px-4 py-3 text-center font-semibold text-brasper-indigoDark">
              Activa
            </th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="tagsStore.isLoading && !tagsStore.tags.length">
            <td colspan="4" class="px-4 py-10 text-center text-[#9ca3af]">
              Cargando etiquetas…
            </td>
          </tr>
          <tr v-else-if="!tagsStore.tags.length">
            <td colspan="4" class="px-4 py-10 text-center text-[#9ca3af]">
              Todavía no hay etiquetas.
            </td>
          </tr>
          <tr
            v-for="tag in tagsStore.tags"
            :key="tag.id"
            class="border-t border-[#e5e7eb] transition hover:bg-[#f9fafb]"
          >
            <td class="px-4 py-3">
              <span
                class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                :style="chipStyle(tag)"
              >
                {{ tag.label }}
              </span>
            </td>
            <td class="px-4 py-3 text-center">
              <span v-if="tag.counts_as_new_client" class="text-amber-700">★ Sí</span>
              <span v-else class="text-[#9ca3af]">—</span>
            </td>
            <td class="px-4 py-3 text-center">
              <span v-if="tag.active">Sí</span>
              <span v-else class="text-[#9ca3af]">No</span>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-right">
              <button
                v-if="canUpdate"
                type="button"
                class="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs text-[#374151] transition hover:bg-[#f9fafb]"
                @click="openEdit(tag)"
              >
                Editar
              </button>
              <button
                v-if="canDelete"
                type="button"
                class="ml-2 rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs text-[#b91c1c] transition hover:bg-[#fef2f2]"
                @click="askDelete(tag)"
              >
                Borrar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-xs text-[#6b7280]">
      Solo una etiqueta puede contar como «cliente nuevo»: al marcarla en una, se
      desmarca de la otra. Desactivar no borra — la etiqueta deja de ofrecerse al
      registrar, pero sigue visible en los envíos que ya la tenían.
    </p>

    <!-- Modal crear / editar -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
        @click.self="closeModal"
      >
        <div class="w-full max-w-md rounded-2xl bg-white shadow-xl">
          <div class="border-b border-[#eef2f7] px-6 py-4">
            <h2 class="text-lg font-semibold text-[#232b4d]">{{ modalTitle }}</h2>
          </div>
          <form class="space-y-5 px-6 py-5" @submit.prevent="submit">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-[#374151]">
                Nombre <span class="text-[#dc2626]">*</span>
              </label>
              <input
                v-model="form.label"
                type="text"
                maxlength="60"
                placeholder="Cliente nuevo"
                class="w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
              />
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-[#374151]">Color</label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="color in TAG_COLOR_KEYS"
                  :key="color"
                  type="button"
                  class="h-7 w-7 rounded-lg border-2 transition"
                  :class="form.color === color ? 'border-[#232b4d]' : 'border-transparent'"
                  :style="swatchStyle(color)"
                  :title="color"
                  :aria-pressed="form.color === color"
                  @click="form.color = color"
                />
              </div>
            </div>

            <label class="flex items-start gap-3 text-sm text-[#374151]">
              <input
                v-model="form.counts_as_new_client"
                type="checkbox"
                class="mt-0.5 h-4 w-4 rounded border-[#d1d5db]"
              />
              <span>
                Cuenta como «cliente nuevo» en los indicadores del día
                <span class="mt-0.5 block text-xs text-[#6b7280]">
                  Solo una etiqueta puede tenerlo; se le quitará a la que lo tenga hoy.
                </span>
              </span>
            </label>

            <label class="flex items-start gap-3 text-sm text-[#374151]">
              <input
                v-model="form.active"
                type="checkbox"
                class="mt-0.5 h-4 w-4 rounded border-[#d1d5db]"
              />
              <span>
                Activa
                <span class="mt-0.5 block text-xs text-[#6b7280]">
                  Si la desactivas deja de ofrecerse al registrar, pero no se borra
                  de los envíos que ya la tienen.
                </span>
              </span>
            </label>

            <div>
              <span class="text-xs text-[#6b7280]">Se verá así: </span>
              <span
                class="ml-1 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                :style="previewStyle"
              >
                {{ form.label.trim() || 'Etiqueta' }}
                <span v-if="form.counts_as_new_client"> ★</span>
              </span>
            </div>

            <p v-if="formError" class="text-sm text-[#dc3545]">{{ formError }}</p>

            <div class="flex justify-end gap-2 pt-1">
              <button
                type="button"
                class="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm text-[#374151] transition hover:bg-[#f9fafb]"
                @click="closeModal"
              >
                Cancelar
              </button>
              <button
                type="submit"
                class="rounded-lg bg-brasper-indigoStrong px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                :disabled="tagsStore.isSaving"
              >
                {{ tagsStore.isSaving ? 'Guardando…' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <ConfirmDialog
      v-model="showDeleteConfirm"
      title="Eliminar etiqueta"
      :message="deleteMessage"
      confirm-text="Eliminar"
      :loading="deleting"
      @confirm="confirmDelete"
    />
  </div>
</template>
