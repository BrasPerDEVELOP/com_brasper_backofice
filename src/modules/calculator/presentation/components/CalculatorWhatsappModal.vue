<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1225]/60 px-4 backdrop-blur-[2px]"
  >
    <div
      class="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl shadow-[#0b1225]/30"
    >
      <div
        class="border-b border-[#e8edf7] bg-gradient-to-r from-[#f7f9ff] to-white px-5 py-4"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <div
              class="flex h-9 w-9 items-center justify-center rounded-full bg-brasper-indigoStrong/10 text-brasper-indigoStrong"
            >
              <svg
                class="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5l-2 2V6a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-5l-2 2-2-2z"
                />
              </svg>
            </div>
            <div>
              <h3 class="text-lg font-semibold text-[#1b2540]">
                Mensaje para WhatsApp
              </h3>
              <p class="text-xs text-[#667085]">
                Revisa y copia el texto antes de enviarlo.
              </p>
            </div>
          </div>
          <button
            type="button"
            class="rounded-lg p-1.5 text-[#667085] transition hover:bg-[#eef2ff] hover:text-[#3f51b5]"
            aria-label="Cerrar modal"
            @click="emit('close')"
          >
            <svg
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      <div class="px-5 py-4">
        <div class="mb-3 flex items-center justify-between gap-3">
          <span
            class="text-xs font-medium uppercase tracking-[0.16em] text-[#667085]"
            >Idioma del mensaje</span
          >
          <div
            class="inline-flex rounded-lg border border-[#d5deef] bg-white p-1"
          >
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-xs font-semibold transition"
              :class="
                language === 'es'
                  ? 'bg-brasper-indigoStrong text-white'
                  : 'text-[#475467] hover:bg-[#f2f4f7]'
              "
              @click="emit('language', 'es')"
            >
              Espanol
            </button>
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-xs font-semibold transition"
              :class="
                language === 'pt'
                  ? 'bg-brasper-indigoStrong text-white'
                  : 'text-[#475467] hover:bg-[#f2f4f7]'
              "
              @click="emit('language', 'pt')"
            >
              Portugues
            </button>
          </div>
        </div>
        <textarea
          :value="message"
          class="min-h-[240px] w-full resize-none rounded-xl border border-[#d5deef] bg-[#fbfcff] p-4 text-[15px] leading-relaxed text-[#344054] focus:outline-none"
          @input="
            emit('update:message', ($event.target as HTMLTextAreaElement).value)
          "
        />
        <div class="mt-3 flex items-center justify-between">
          <span class="text-xs text-[#98a2b3]"
            >Puedes editar este mensaje antes de copiarlo.</span
          >
          <span
            v-if="copyFeedback"
            class="text-xs font-medium text-brasper-indigoStrong"
            >{{ copyFeedback }}</span
          >
        </div>
      </div>

      <div
        class="flex justify-end gap-2 border-t border-[#e8edf7] bg-[#fafbff] px-5 py-4"
      >
        <button
          type="button"
          class="rounded-lg border border-[#d0d5dd] px-4 py-2 text-sm font-medium text-[#344054] transition hover:bg-white"
          @click="emit('close')"
        >
          Cerrar
        </button>
        <button
          type="button"
          class="rounded-lg bg-gradient-to-r from-brasper-cyan to-brasper-indigoStrong px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brasper-indigoStrong/20 transition hover:opacity-95"
          @click="emit('copy')"
        >
          Copiar mensaje
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean;
  message: string;
  language: "es" | "pt";
  copyFeedback: string;
}>();

const emit = defineEmits<{
  close: [];
  copy: [];
  language: [value: "es" | "pt"];
  "update:message": [value: string];
}>();
</script>
