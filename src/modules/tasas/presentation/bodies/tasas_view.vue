<template>
  <div :class="compact ? 'space-y-4' : 'space-y-6'">
    <section
      :class="
        compact
          ? 'rounded-xl border border-[#d8e5fb] bg-white p-4 shadow-md shadow-brasper-indigoStrong/10'
          : 'rounded-2xl border border-[#d8e5fb] bg-white p-6 shadow-lg shadow-brasper-indigoStrong/10'
      "
    >
      <div class="mb-4">
        <p
          :class="
            compact
              ? 'text-[10px] font-semibold uppercase tracking-[0.18em] text-brasper-indigoStrong'
              : 'text-xs font-semibold uppercase tracking-[0.2em] text-brasper-indigoStrong'
          "
        >
          Configuración
        </p>
        <h1
          :class="
            compact
              ? 'text-xl font-semibold text-[#232b4d]'
              : 'text-2xl font-semibold text-[#232b4d]'
          "
        >
          Tasas de Cambio
        </h1>
      </div>

      <div v-if="tasasStore.isLoading" class="mt-4 text-[#666]">
        Cargando tasas...
      </div>
      <template v-else>
        <p
          v-if="tasasStore.error"
          class="mt-2 rounded-lg bg-[#dc3545]/10 px-3 py-2 text-sm text-[#dc3545]"
        >
          {{ tasasStore.error }}
        </p>
        <div :class="compact ? 'mt-3 space-y-2' : 'mt-4 space-y-3'">
          <div
            v-for="rate in tasasStore.taxRates"
            :key="rate.id"
            :class="
              compact
                ? 'rounded-lg border border-[#dbe7fb] bg-[#fbfdff] p-2.5'
                : 'rounded-xl border border-[#dbe7fb] bg-[#fbfdff] p-3'
            "
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex min-w-0 items-center gap-2">
                <label
                  :class="
                    compact
                      ? 'min-w-[4.5rem] text-xs font-medium text-[#333]'
                      : 'min-w-[6rem] text-sm font-medium text-[#333]'
                  "
                >
                  {{ rate.coin_a }}-{{ rate.coin_b }}
                </label>
                <input
                  :value="draftTaxes[rate.id] ?? String(rate.tax)"
                  type="number"
                  inputmode="decimal"
                  step="0.000001"
                  min="0"
                  :class="
                    compact
                      ? 'w-24 rounded-md border border-[#cfdbef] bg-white px-2 py-1 text-xs text-[#333] outline-none focus:border-brasper-indigoStrong focus:ring-2 focus:ring-brasper-indigoStrong/20'
                      : 'w-32 rounded-lg border border-[#cfdbef] bg-white px-3 py-1.5 text-sm text-[#333] outline-none focus:border-brasper-indigoStrong focus:ring-2 focus:ring-brasper-indigoStrong/20'
                  "
                  @input="
                    draftTaxes[rate.id] = (
                      $event.target as HTMLInputElement
                    ).value
                  "
                />
              </div>

              <div
                :class="
                  compact
                    ? 'flex items-center gap-1.5 whitespace-nowrap'
                    : 'flex items-center gap-2 whitespace-nowrap'
                "
              >
                <button
                  type="button"
                  :class="
                    compact
                      ? 'rounded-md border border-[#bcd7ff] bg-[#eef5ff] px-2.5 py-1 text-xs font-medium text-brasper-indigoStrong hover:bg-[#e2eeff]'
                      : 'rounded-lg border border-[#bcd7ff] bg-[#eef5ff] px-3 py-1.5 text-sm font-medium text-brasper-indigoStrong hover:bg-[#e2eeff]'
                  "
                  @click="toggleHistory(rate.id)"
                >
                  {{
                    expandedHistoryId === rate.id
                      ? "Ocultar historial"
                      : "Historial"
                  }}
                </button>
                <button
                  v-if="canUpdateRate"
                  type="button"
                  :class="
                    compact
                      ? 'rounded-md bg-gradient-to-r from-brasper-cyanLight to-brasper-indigoStrong px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60'
                      : 'rounded-lg bg-gradient-to-r from-brasper-cyanLight to-brasper-indigoStrong px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60'
                  "
                  :disabled="tasasStore.savingId === rate.id"
                  @click="saveRate(rate.id, rate.coin_a, rate.coin_b)"
                >
                  {{
                    tasasStore.savingId === rate.id ? "Guardando..." : "Guardar"
                  }}
                </button>
              </div>
            </div>
            <div
              v-if="expandedHistoryId === rate.id"
              class="mt-4 rounded-xl border border-[#dbe7fb] bg-white p-3"
            >
              <div
                v-if="tasasStore.loadingHistoryId === rate.id"
                class="text-sm text-slate-600"
              >
                Cargando historial...
              </div>
              <div
                v-else-if="getHistoryEntries(rate.id).length === 0"
                class="text-sm text-slate-600"
              >
                Sin cambios registrados.
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="entry in getHistoryEntries(rate.id)"
                  :key="String(entry.id)"
                  class="rounded border border-slate-200 bg-white p-3"
                >
                  <div
                    class="mb-2 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div class="text-xs text-slate-600">
                      <span
                        class="rounded bg-slate-100 px-2 py-1 font-semibold text-slate-700"
                      >
                        {{ formatHistoryValue(entry.action) }}
                      </span>
                      <span class="ml-2"
                        >por {{ formatHistoryValue(entry.changed_by) }}</span
                      >
                    </div>
                    <div class="text-xs text-slate-500">
                      {{ formatHistoryDate(entry.changed_at) }}
                    </div>
                  </div>

                  <div class="mb-3 flex flex-wrap gap-1">
                    <span
                      v-for="field in getChangedFields(entry)"
                      :key="`${entry.id}-field-${field}`"
                      class="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
                    >
                      {{ field }}
                    </span>
                  </div>

                  <div class="grid gap-2 sm:grid-cols-2">
                    <div
                      v-for="field in getChangedFields(entry)"
                      :key="`${entry.id}-diff-${field}`"
                      class="rounded border border-slate-100 p-2 text-xs"
                    >
                      <div class="font-semibold text-slate-700">
                        {{ field }}
                      </div>
                      <div class="mt-1 text-slate-500">
                        Antes:
                        {{ formatHistoryValue(getBeforeData(entry)[field]) }}
                      </div>
                      <div class="text-slate-700">
                        Después:
                        {{ formatHistoryValue(getAfterData(entry)[field]) }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useTasasStore } from "../controllers/use_tasas_store_controller";
import { useAuthStore } from "@modules/auth/presentation/controllers/use_auth_store_controller";

withDefaults(
  defineProps<{
    compact?: boolean;
  }>(),
  {
    compact: false,
  },
);

const tasasStore = useTasasStore();
const authStore = useAuthStore();
const canUpdateRate = computed(() => authStore.hasPermission("rates.update"));
const expandedHistoryId = ref<string | null>(null);
const draftTaxes = ref<Record<string, string>>({});

async function saveRate(
  id: string,
  coinA: string,
  coinB: string,
): Promise<void> {
  if (!canUpdateRate.value) return;
  const parsedTax = Number(draftTaxes.value[id] ?? "");
  const ok = await tasasStore.validateAndUpdateTaxRate(
    id,
    parsedTax,
    coinA,
    coinB,
  );
  if (ok) {
    draftTaxes.value[id] = String(parsedTax);
  }
}

function getHistoryEntries(taxRateId: string): Array<Record<string, unknown>> {
  return tasasStore.historyByTaxRateId[taxRateId] ?? [];
}

function formatHistoryValue(value: unknown): string {
  if (value == null) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function toObject(value: unknown): Record<string, unknown> {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function getChangedFields(entry: Record<string, unknown>): string[] {
  const value = entry.changed_fields;
  if (!Array.isArray(value)) return [];
  return value.map((field) => String(field));
}

function getBeforeData(
  entry: Record<string, unknown>,
): Record<string, unknown> {
  return toObject(entry.before_data);
}

function getAfterData(entry: Record<string, unknown>): Record<string, unknown> {
  return toObject(entry.after_data);
}

function formatHistoryDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

async function toggleHistory(taxRateId: string): Promise<void> {
  if (expandedHistoryId.value === taxRateId) {
    expandedHistoryId.value = null;
    return;
  }
  expandedHistoryId.value = taxRateId;
  await tasasStore.loadTaxRateHistory(taxRateId);
}

onMounted(() => {
  tasasStore.loadTaxRates();
});

watch(
  () => tasasStore.taxRates,
  (rates) => {
    for (const rate of rates) {
      if (!(rate.id in draftTaxes.value)) {
        draftTaxes.value[rate.id] = String(rate.tax);
      }
    }
  },
  { immediate: true, deep: true },
);
</script>
