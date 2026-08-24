<script setup lang="ts">
import { nextTick, ref, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    interactive?: boolean
    disabled?: boolean
  }>(),
  {
    interactive: false,
    disabled: false
  }
)

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const trigger = ref<HTMLElement | null>(null)
const visible = ref(false)
const tooltipId = `app-tooltip-${useId()}`
const position = ref({ left: 0, top: 0, below: false })

async function show() {
  if (props.disabled) return
  visible.value = true
  await nextTick()
  const rect = trigger.value?.getBoundingClientRect()
  if (!rect) return
  position.value = {
    left: rect.left + rect.width / 2,
    top: rect.top,
    below: rect.top < 56
  }
}

function hide() {
  visible.value = false
}
</script>

<template>
  <span
    ref="trigger"
    class="inline-flex"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <button
      v-if="interactive"
      type="button"
      class="inline-flex items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brasper-indigoStrong focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
      :aria-label="label"
      :aria-describedby="tooltipId"
      :disabled="disabled"
      @click="emit('click', $event)"
    >
      <slot />
    </button>
    <span
      v-else
      class="inline-flex items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brasper-indigoStrong focus-visible:ring-offset-1"
      role="img"
      tabindex="0"
      :aria-label="label"
      :aria-describedby="tooltipId"
    >
      <slot />
    </span>
  </span>

  <Teleport to="body">
    <span
      v-if="visible"
      :id="tooltipId"
      role="tooltip"
      class="pointer-events-none fixed z-[100] max-w-64 rounded-md bg-[#111827] px-2.5 py-1.5 text-center text-xs font-medium leading-4 text-white shadow-lg"
      :style="{
        left: `${position.left}px`,
        top: `${position.top + (position.below ? 8 : -8)}px`,
        transform: position.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
      }"
    >
      {{ label }}
    </span>
  </Teleport>
</template>
