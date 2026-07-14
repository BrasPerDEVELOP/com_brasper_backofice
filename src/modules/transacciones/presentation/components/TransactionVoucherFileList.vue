<script setup lang="ts">
export interface TransactionVoucherFileEntry {
  id: string;
  label: string;
  /** URL abrible (media persistida u objectURL); vacío si no aplica. */
  href: string;
  /** Miniatura si es imagen; vacío para PDF u otros archivos. */
  thumbSrc: string;
  /** true si ya estaba subido al servidor; false si se agregó en esta sesión. */
  persisted: boolean;
}

defineOptions({ name: "TransactionVoucherFileList" });

defineProps<{
  entries: TransactionVoucherFileEntry[];
  emptyLabel?: string;
}>();

defineEmits<{ remove: [index: number] }>();
</script>

<template>
  <ul v-if="entries.length" class="mt-3 space-y-2">
    <li
      v-for="(entry, idx) in entries"
      :key="entry.id"
      class="overflow-hidden rounded-lg border border-[#e8eef8] bg-[#fbfdff]"
    >
      <a
        v-if="entry.thumbSrc"
        :href="entry.href || entry.thumbSrc"
        target="_blank"
        rel="noopener noreferrer"
        class="block cursor-pointer bg-[#f3f6fb] transition hover:opacity-90"
        :title="`Abrir ${entry.label}`"
      >
        <img
          :src="entry.thumbSrc"
          :alt="entry.label"
          loading="lazy"
          class="max-h-28 w-full object-contain"
        />
      </a>
      <div class="flex items-center justify-between gap-2 px-3 py-2">
        <a
          v-if="entry.href"
          :href="entry.href"
          target="_blank"
          rel="noopener noreferrer"
          class="min-w-0 truncate text-xs font-medium text-brasper-indigoStrong hover:underline"
          :title="entry.label"
        >
          {{ entry.label }}
        </a>
        <span
          v-else
          class="min-w-0 truncate text-xs font-medium text-[#374151]"
          :title="entry.label"
        >
          {{ entry.label }}
        </span>
        <span class="flex shrink-0 items-center gap-2">
          <span
            v-if="!entry.persisted"
            class="rounded-full bg-brasper-cyanLight/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brasper-indigoDark"
          >
            Nuevo
          </span>
          <button
            type="button"
            class="cursor-pointer text-xs font-semibold text-[#dc3545] hover:underline"
            @click="$emit('remove', idx)"
          >
            Quitar
          </button>
        </span>
      </div>
    </li>
  </ul>
  <p
    v-else-if="emptyLabel"
    class="mt-3 rounded-lg border border-dashed border-[#dce3ef] px-3 py-3 text-center text-xs text-[#9ca3af]"
  >
    {{ emptyLabel }}
  </p>
</template>
