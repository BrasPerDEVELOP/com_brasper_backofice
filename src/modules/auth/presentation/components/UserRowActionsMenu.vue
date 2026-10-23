<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import { ChevronDown, FileDown, KeyRound, Landmark, Pencil, Trash2 } from '@lucide/vue'
import type { UserListItem } from '../../infrastructure/adapters/users_management_api_adapter'

const props = defineProps<{
  user: UserListItem
  open: boolean
  deleting: boolean
  canUpdate: boolean
  canDelete: boolean
  canResetPassword: boolean
  canViewAccounts: boolean
}>()

const emit = defineEmits<{
  toggle: []
  close: []
  edit: []
  resetPassword: []
  viewAccounts: []
  exportExcel: []
  delete: []
}>()

type Action = 'edit' | 'resetPassword' | 'viewAccounts' | 'exportExcel' | 'delete'
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const menu = useTemplateRef<HTMLDivElement>('menu')
const position = shallowRef({
  top: '0px',
  left: '0px',
  maxHeight: 'none',
  visibility: 'hidden' as 'hidden' | 'visible'
})
const menuId = computed(() => `user-actions-${props.user.id}`)
const actions = computed(() =>
  [
    { id: 'edit' as Action, label: 'Editar usuario', icon: Pencil, visible: props.canUpdate },
    {
      id: 'viewAccounts' as Action,
      label: 'Ver cuentas bancarias',
      icon: Landmark,
      visible:
        props.canViewAccounts &&
        ['client', 'cliente'].includes((props.user.role ?? '').toLowerCase())
    },
    { id: 'exportExcel' as Action, label: 'Exportar Excel', icon: FileDown, visible: true },
    {
      id: 'resetPassword' as Action,
      label: 'Restablecer contraseña',
      icon: KeyRound,
      visible: props.canResetPassword
    },
    { id: 'delete' as Action, label: 'Eliminar usuario', icon: Trash2, visible: props.canDelete }
  ].filter((action) => action.visible)
)

function close(restoreFocus = false) {
  if (restoreFocus) trigger.value?.focus({ preventScroll: true })
  emit('close')
}

function choose(action: Action) {
  close(true)
  // Explicit event names preserve the typed contract with the directory table.
  switch (action) {
    case 'edit':
      emit('edit')
      break
    case 'viewAccounts':
      emit('viewAccounts')
      break
    case 'exportExcel':
      emit('exportExcel')
      break
    case 'resetPassword':
      emit('resetPassword')
      break
    case 'delete':
      emit('delete')
      break
  }
}

function items() {
  return Array.from(
    menu.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []
  )
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' || event.key === 'Tab') {
    if (event.key === 'Escape') event.preventDefault()
    close(true)
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const buttons = items()
  if (!buttons.length) return
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const index =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
  buttons[index]?.focus()
}

watch(
  () => props.open,
  async (open, _, onCleanup) => {
    if (!open) return
    position.value = { ...position.value, visibility: 'hidden' }
    const outside = (event: Event) => {
      const target = event.target as Node | null
      if (!menu.value?.contains(target) && !trigger.value?.contains(target)) close()
    }
    const scrolled = (event: Event) => {
      if (!menu.value?.contains(event.target as Node | null)) close()
    }
    const resized = () => close()
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    window.addEventListener('scroll', scrolled, true)
    window.addEventListener('resize', resized)
    onCleanup(() => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
      window.removeEventListener('scroll', scrolled, true)
      window.removeEventListener('resize', resized)
    })
    await nextTick()
    if (!props.open || !trigger.value || !menu.value) return
    const anchor = trigger.value.getBoundingClientRect()
    const width = menu.value.getBoundingClientRect().width
    const gap = 8
    const below = window.innerHeight - anchor.bottom - gap * 2
    const above = anchor.top - gap * 2
    const height = menu.value.scrollHeight
    const useAbove = height > below && above > below
    const maxHeight = Math.max(0, useAbove ? above : below)
    position.value = {
      top: `${useAbove ? Math.max(gap, anchor.top - gap - Math.min(height, maxHeight)) : anchor.bottom + gap}px`,
      left: `${Math.max(gap, Math.min(anchor.right - width, window.innerWidth - width - gap))}px`,
      maxHeight: `${maxHeight}px`,
      visibility: 'visible'
    }
    await nextTick()
    if (props.open) items()[0]?.focus({ preventScroll: true })
  }
)
</script>

<template>
  <button
    ref="trigger"
    type="button"
    class="inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brasper-indigoStrong focus-visible:ring-offset-2 disabled:opacity-50"
    :class="
      open
        ? 'border-brasper-indigoStrong bg-[#eef2ff] text-brasper-indigoDark'
        : 'border-[#e5e7eb] bg-white text-[#475569] hover:border-[#c7d2fe] hover:bg-[#eef2ff] hover:text-brasper-indigoDark'
    "
    :aria-label="`Acciones de ${user.name || user.email || 'usuario'}`"
    aria-haspopup="menu"
    :aria-expanded="open"
    :aria-controls="open ? menuId : undefined"
    :disabled="deleting"
    @click.stop="emit('toggle')"
    @keydown.down.prevent.stop="!open && emit('toggle')"
  >
    {{ deleting ? 'Eliminando…' : 'Acciones' }}
    <ChevronDown :size="14" aria-hidden="true" :class="open ? 'rotate-180' : ''" />
  </button>
  <Teleport to="body">
    <div
      v-if="open"
      :id="menuId"
      ref="menu"
      role="menu"
      :aria-label="`Acciones de ${user.name || user.email || 'usuario'}`"
      class="fixed z-40 w-64 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-[#e2e8f0] bg-white p-1.5 text-sm text-[#334155] shadow-xl shadow-[#0f172a]/15"
      :style="position"
      @click.stop
      @keydown="onKeydown"
    >
      <div class="mb-1 border-b border-[#f1f5f9] px-2.5 pb-2 pt-1.5">
        <p class="truncate text-xs font-semibold text-[#334155]">{{ user.name || 'Usuario' }}</p>
        <p v-if="user.email && user.email !== '-'" class="mt-0.5 truncate text-xs text-[#64748b]">
          {{ user.email }}
        </p>
      </div>
      <template v-for="action in actions" :key="action.id">
        <div
          v-if="action.id === 'delete'"
          role="separator"
          class="my-1 border-t border-[#f1f5f9]"
        />
        <button
          type="button"
          role="menuitem"
          tabindex="-1"
          class="flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm outline-none transition"
          :class="
            action.id === 'delete'
              ? 'text-[#dc3545] hover:bg-[#fef2f2] focus:bg-[#fef2f2]'
              : 'hover:bg-[#f1f5f9] focus:bg-[#eef2ff] focus:text-brasper-indigoDark'
          "
          :disabled="action.id === 'delete' && deleting"
          @click="choose(action.id)"
        >
          <component :is="action.icon" :size="16" class="shrink-0" aria-hidden="true" />
          {{ action.label }}
        </button>
      </template>
    </div>
  </Teleport>
</template>
