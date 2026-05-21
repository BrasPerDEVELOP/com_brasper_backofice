<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { useTransactionsStore } from "@modules/transacciones/presentation/controllers/use_transactions_store_controller";
import { useCuentasBancariasStore } from "@modules/cuentas-bancarias/presentation/controllers/use_cuentas_bancarias_store_controller";
import { useCuponesStore } from "@modules/cupones/presentation/controllers/use_cupones_store_controller";
import { useComisionesStore } from "@modules/comisiones/presentation/controllers/use_comisiones_store_controller";
import { useTasasStore } from "@modules/tasas/presentation/controllers/use_tasas_store_controller";
import { useAuthStore } from "@modules/auth/presentation/controllers/use_auth_store_controller";
import { fetchUsers } from "@modules/auth/infrastructure/adapters/users_management_api_adapter";
import { BlogApiAdapter } from "@modules/blog/infrastructure/adapters/blog_api_adapter";
import type { Blog } from "@modules/blog/domain/models";
import { HomeBannerApiAdapter } from "@modules/home-banner/infrastructure/adapters";
import type { HomeBanner } from "@modules/home-banner/domain/models";
import type { Transaction } from "@modules/transacciones/domain/models";
import { TRANSACTION_STATUS_LABELS } from "@modules/transacciones/domain/models";

const transactionsStore = useTransactionsStore();
const cuentasStore = useCuentasBancariasStore();
const cuponesStore = useCuponesStore();
const comisionesStore = useComisionesStore();
const tasasStore = useTasasStore();
const authStore = useAuthStore();
const blogRepo = new BlogApiAdapter();
const homeBannerRepo = new HomeBannerApiAdapter();

const loading = ref(true);
const usersTotal = ref<number | null>(null);
const usersLoadError = ref<string | null>(null);
const marketingBlogs = ref<Blog[]>([]);
const marketingBlogsTotal = ref(0);
const marketingBanner = ref<HomeBanner | null>(null);
const marketingLoadError = ref<string | null>(null);

const isMarketingDashboard = computed(
  () => (authStore.user?.role ?? "").toLowerCase() === "marketing",
);

function statusOf(t: Transaction): string {
  return (t.status ?? "").toLowerCase();
}

const transactions = computed(() => transactionsStore.transactions);

const txByStatus = computed(() => {
  const map: Record<string, number> = {};
  for (const t of transactions.value) {
    const s = statusOf(t) || "sin_estado";
    map[s] = (map[s] ?? 0) + 1;
  }
  return map;
});

/** En verificación: estado nuevo + legado pendiente */
const inVerificationCount = computed(
  () =>
    (txByStatus.value.verification ?? 0) + (txByStatus.value.pending ?? 0),
);
/** Cerrada según API (no confundir con `verified` intermedio) */
const completedCount = computed(() => txByStatus.value.completed ?? 0);
const verifiedIntermediateCount = computed(
  () =>
    (txByStatus.value.verified ?? 0) +
    (txByStatus.value.checked ?? 0),
);
const failedCount = computed(() => txByStatus.value.failed ?? 0);

function isVolumeStatus(s: string): boolean {
  return s === "completed" || s === "checked";
}

const volumeOriginCompleted = computed(() =>
  transactions.value
    .filter((t) => isVolumeStatus(statusOf(t)))
    .reduce((acc, t) => acc + (Number(t.origin_amount) || 0), 0),
);

const volumeDestCompleted = computed(() =>
  transactions.value
    .filter((t) => isVolumeStatus(statusOf(t)))
    .reduce((acc, t) => acc + (Number(t.destination_amount) || 0), 0),
);

const ms7d = 7 * 24 * 60 * 60 * 1000;
const transactionsLast7Days = computed(() => {
  const cutoff = Date.now() - ms7d;
  return transactions.value.filter((t) => {
    const raw = t.created_at ?? t.send_date;
    if (!raw) return false;
    const ms = new Date(raw).getTime();
    return Number.isFinite(ms) && ms >= cutoff;
  }).length;
});

const couponsActive = computed(
  () => cuponesStore.coupons.filter((c) => c.is_active).length,
);

const marketingPublishedBlogs = computed(
  () => marketingBlogs.value.filter((blog) => blog.enable).length,
);

const marketingDraftBlogs = computed(
  () => marketingBlogs.value.filter((blog) => !blog.enable).length,
);

const marketingRecentBlogs = computed(() =>
  [...marketingBlogs.value]
    .sort((a, b) => new Date(b.updated_at ?? b.created_at ?? b.date ?? 0).getTime() - new Date(a.updated_at ?? a.created_at ?? a.date ?? 0).getTime())
    .slice(0, 5),
);

const marketingLanguageRows = computed(() => {
  const labels: Record<string, string> = { es: "Español", en: "Inglés", pr: "Portugués" };
  const counts = marketingBlogs.value.reduce<Record<string, number>>((acc, blog) => {
    const key = blog.language || "sin_idioma";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([key, n]) => ({ key, n, label: labels[key] ?? key.toUpperCase() }))
    .sort((a, b) => b.n - a.n);
});

const marketingCategoryRows = computed(() => {
  const counts = marketingBlogs.value.reduce<Record<string, number>>((acc, blog) => {
    const key = blog.category || "Sin categoría";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([label, n]) => ({ label, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 6);
});

const statusBreakdown = computed(() => {
  const entries = Object.entries(txByStatus.value).filter(
    ([k]) => k !== "sin_estado",
  );
  const labeled = entries.map(([key, n]) => ({
    key,
    n,
    label:
      key in TRANSACTION_STATUS_LABELS
        ? TRANSACTION_STATUS_LABELS[
            key as keyof typeof TRANSACTION_STATUS_LABELS
          ]
        : key,
  }));
  labeled.sort((a, b) => b.n - a.n);
  return labeled;
});

const totalForBreakdown = computed(() =>
  statusBreakdown.value.reduce((s, x) => s + x.n, 0),
);

function formatMoney(n: number): string {
  return n.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatInt(n: number): string {
  return n.toLocaleString("es");
}

function formatDate(value?: string | null): string {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

onMounted(async () => {
  loading.value = true;
  usersLoadError.value = null;
  marketingLoadError.value = null;

  if (isMarketingDashboard.value) {
    const [blogsResult, couponsResult, bannerResult] = await Promise.allSettled([
      blogRepo.listBlogs(0, 100),
      cuponesStore.loadCoupons(),
      homeBannerRepo.getBanner(),
    ]);

    if (blogsResult.status === "fulfilled") {
      marketingBlogs.value = blogsResult.value.items;
      marketingBlogsTotal.value = blogsResult.value.total;
    } else {
      marketingLoadError.value = "No se pudieron cargar los artículos del blog.";
    }

    if (couponsResult.status === "rejected") {
      marketingLoadError.value = [marketingLoadError.value, "No se pudieron cargar los cupones."]
        .filter(Boolean)
        .join(" ");
    }

    if (bannerResult.status === "fulfilled") {
      marketingBanner.value = bannerResult.value;
    } else {
      marketingLoadError.value = [marketingLoadError.value, "No se pudo cargar el banner home."]
        .filter(Boolean)
        .join(" ");
    }

    loading.value = false;
    return;
  }

  await Promise.all([
    transactionsStore.loadTransactions(),
    cuentasStore.loadBankAccounts(),
    cuentasStore.loadBanks(true),
    cuentasStore.loadClientUsers(true),
    cuponesStore.loadCoupons(),
    comisionesStore.loadCommissions(),
    tasasStore.loadTaxRates(),
  ]);
  if (authStore.hasPermission("users.view")) {
    try {
      const users = await fetchUsers();
      usersTotal.value = users.length;
    } catch (e) {
      usersLoadError.value =
        e instanceof Error ? e.message : "No se pudo cargar el listado de usuarios";
      usersTotal.value = null;
    }
  }
  loading.value = false;
});
</script>

<template>
  <div
    class="dashboard-surface relative -mx-2 -mt-2 overflow-hidden rounded-2xl px-2 pb-10 pt-2 sm:-mx-0 sm:mt-0 sm:px-0 sm:pt-0"
  >
    <div
      class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_120%_80%_at_100%_-20%,rgba(64,196,255,0.18),transparent_50%),radial-gradient(ellipse_80%_50%_at_0%_100%,rgba(63,81,181,0.12),transparent_45%)]"
      aria-hidden="true"
    />

    <!-- Hero -->
    <div
      class="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-brasper-indigoDark via-brasper-indigoStrong to-brasper-cyan/90 p-8 shadow-[0_25px_50px_-12px_rgba(40,53,147,0.45)] ring-1 ring-white/20 sm:p-10"
    >
      <div
        class="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brasper-cyanLight/30 blur-3xl"
        aria-hidden="true"
      />
      <div
        class="pointer-events-none absolute -bottom-20 left-1/4 h-48 w-96 rounded-full bg-white/10 blur-2xl"
        aria-hidden="true"
      />
      <div class="relative">
        <div class="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white/95 ring-1 ring-white/25 backdrop-blur-sm">
          BrasPer · Panel
        </div>
        <h1
          class="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-white drop-shadow-sm sm:text-4xl"
        >
          {{ isMarketingDashboard ? "Resumen de marketing" : "Resumen operativo" }}
        </h1>
        <p class="mt-3 max-w-xl text-sm leading-relaxed text-white/85">
          {{
            isMarketingDashboard
              ? "Datos reales de publicaciones, cupones y banner principal para revisar el contenido visible."
              : "KPIs en vivo: transacciones, cuentas, cupones, tasas, comisiones y usuarios — mismos datos que el resto del backoffice."
          }}
        </p>
        <RouterLink
          v-if="!loading && !isMarketingDashboard"
          to="/app/transacciones"
          class="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brasper-indigoDark shadow-lg shadow-black/20 transition hover:scale-[1.02] hover:bg-brasper-cyanLight hover:text-brasper-indigoDark active:scale-[0.98]"
        >
          Ir a transacciones
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </RouterLink>
      </div>
    </div>

    <div
      v-if="loading"
      class="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-2xl border border-white/60 bg-white/70 p-10 shadow-inner backdrop-blur-md"
    >
      <div
        class="h-12 w-12 animate-spin rounded-full border-[3px] border-brasper-indigoStrong/20 border-t-brasper-cyan"
      />
      <p class="text-sm font-medium text-brasper-indigoDark">Sincronizando indicadores…</p>
    </div>

    <template v-else>
      <template v-if="isMarketingDashboard">
        <div class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brasper-indigoStrong/80">
          Marketing
        </div>
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <RouterLink
            to="/app/blog"
            class="group relative overflow-hidden rounded-2xl border border-white/80 bg-white/90 p-6 shadow-lg shadow-brasper-indigoStrong/10 ring-1 ring-brasper-indigoStrong/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brasper-indigoStrong/20"
          >
            <p class="text-xs font-bold uppercase tracking-wider text-[#64748b]">Artículos totales</p>
            <p class="mt-2 bg-gradient-to-br from-brasper-indigoDark to-brasper-indigoStrong bg-clip-text text-4xl font-bold tabular-nums text-transparent">
              {{ formatInt(marketingBlogsTotal) }}
            </p>
            <p class="mt-2 text-xs font-medium text-brasper-indigoStrong/70">Ir a blog →</p>
          </RouterLink>

          <div class="rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-100/90 via-emerald-50 to-white p-6 shadow-lg shadow-emerald-500/15 ring-1 ring-emerald-400/20">
            <p class="text-xs font-bold uppercase tracking-wider text-emerald-900/80">Publicados</p>
            <p class="mt-2 text-4xl font-bold tabular-nums text-emerald-950">
              {{ formatInt(marketingPublishedBlogs) }}
            </p>
            <p class="mt-2 text-xs font-medium text-emerald-800/70">Visibles en la web pública</p>
          </div>

          <div class="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-100/90 via-amber-50 to-white p-6 shadow-lg shadow-amber-500/15 ring-1 ring-amber-400/20">
            <p class="text-xs font-bold uppercase tracking-wider text-amber-900/80">Borradores</p>
            <p class="mt-2 text-4xl font-bold tabular-nums text-amber-950">
              {{ formatInt(marketingDraftBlogs) }}
            </p>
            <p class="mt-2 text-xs font-medium text-amber-800/70">No visibles públicamente</p>
          </div>

          <RouterLink
            to="/app/cupones"
            class="rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-100/90 via-violet-50 to-white p-6 shadow-lg shadow-violet-500/15 ring-1 ring-violet-400/20 transition duration-300 hover:-translate-y-1 hover:shadow-xl"
          >
            <p class="text-xs font-bold uppercase tracking-wider text-violet-900/80">Cupones activos</p>
            <p class="mt-2 text-4xl font-bold tabular-nums text-violet-950">
              {{ formatInt(couponsActive) }}
            </p>
            <p class="mt-2 text-xs font-medium text-violet-800/70">de {{ formatInt(cuponesStore.coupons.length) }} cupones</p>
          </RouterLink>
        </div>

        <div class="mt-8 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div class="rounded-2xl border border-slate-200/90 bg-white/95 p-7 shadow-lg shadow-slate-200/50 ring-1 ring-slate-100">
            <div class="flex items-center justify-between gap-4">
              <h2 class="text-base font-bold text-slate-900">Últimos artículos actualizados</h2>
              <RouterLink to="/app/blog" class="text-sm font-semibold text-brasper-indigoStrong hover:underline">
                Gestionar
              </RouterLink>
            </div>
            <ul v-if="marketingRecentBlogs.length > 0" class="mt-5 divide-y divide-slate-100">
              <li
                v-for="blog in marketingRecentBlogs"
                :key="blog.id"
                class="flex items-start justify-between gap-4 py-3"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-slate-800">{{ blog.title }}</p>
                  <p class="mt-1 text-xs text-slate-500">
                    /{{ blog.slug }} · {{ formatDate(blog.updated_at ?? blog.created_at ?? blog.date) }}
                  </p>
                </div>
                <span
                  class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
                  :class="blog.enable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'"
                >
                  {{ blog.enable ? "Publicado" : "Borrador" }}
                </span>
              </li>
            </ul>
            <p v-else class="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
              No hay artículos para mostrar.
            </p>
          </div>

          <div class="space-y-5">
            <div class="rounded-2xl border border-slate-200/90 bg-white/95 p-7 shadow-lg shadow-slate-200/50 ring-1 ring-slate-100">
              <h2 class="text-base font-bold text-slate-900">Banner home</h2>
              <p class="mt-3 text-sm text-slate-600">
                Estado:
                <span
                  class="font-bold"
                  :class="marketingBanner?.enable ? 'text-emerald-700' : 'text-amber-700'"
                >
                  {{ marketingBanner?.enable ? "Activo" : "Inactivo" }}
                </span>
              </p>
              <p class="mt-2 text-xs text-slate-500">
                Versiones cargadas:
                {{ formatInt([marketingBanner?.banner_es, marketingBanner?.banner_pr, marketingBanner?.banner_en].filter(Boolean).length) }}/3
              </p>
              <RouterLink to="/app/home-banner" class="mt-4 inline-flex text-sm font-semibold text-brasper-indigoStrong hover:underline">
                Revisar banner →
              </RouterLink>
            </div>

            <div class="rounded-2xl border border-slate-200/90 bg-white/95 p-7 shadow-lg shadow-slate-200/50 ring-1 ring-slate-100">
              <h2 class="text-base font-bold text-slate-900">Idiomas y categorías</h2>
              <ul class="mt-4 space-y-3 text-sm">
                <li
                  v-for="row in marketingLanguageRows"
                  :key="row.key"
                  class="flex justify-between rounded-xl bg-slate-50 px-4 py-2"
                >
                  <span class="text-slate-600">{{ row.label }}</span>
                  <span class="font-bold text-slate-900">{{ formatInt(row.n) }}</span>
                </li>
              </ul>
              <div class="mt-4 flex flex-wrap gap-2">
                <span
                  v-for="row in marketingCategoryRows"
                  :key="row.label"
                  class="rounded-full bg-brasper-cyanLight/30 px-3 py-1 text-xs font-semibold text-brasper-indigoDark"
                >
                  {{ row.label }} · {{ formatInt(row.n) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <p
          v-if="marketingLoadError || cuponesStore.error"
          class="mt-8 rounded-xl border border-red-300/80 bg-gradient-to-r from-red-50 to-white px-5 py-4 text-sm font-medium text-red-900 shadow-md shadow-red-100"
        >
          Algunos datos pueden estar incompletos:
          {{ [marketingLoadError, cuponesStore.error].filter(Boolean).join(" · ") }}
        </p>
      </template>

      <template v-else>
      <div class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brasper-indigoStrong/80">
        Operación
      </div>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <RouterLink
          to="/app/transacciones"
          class="group relative overflow-hidden rounded-2xl border border-white/80 bg-white/90 p-6 shadow-lg shadow-brasper-indigoStrong/10 ring-1 ring-brasper-indigoStrong/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brasper-indigoStrong/20"
        >
          <div
            class="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-brasper-cyanLight/40 to-brasper-indigoStrong/20 blur-2xl transition group-hover:scale-110"
          />
          <div class="relative flex items-start justify-between gap-3">
            <div
              class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brasper-indigoStrong to-brasper-indigoDark text-white shadow-md shadow-brasper-indigoStrong/40"
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span class="rounded-full bg-brasper-cyanLight/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brasper-indigoDark opacity-0 transition group-hover:opacity-100">Ver →</span>
          </div>
          <p class="relative mt-4 text-xs font-bold uppercase tracking-wider text-[#64748b]">
            Transacciones
          </p>
          <p class="relative mt-1 bg-gradient-to-br from-brasper-indigoDark to-brasper-indigoStrong bg-clip-text text-4xl font-bold tabular-nums text-transparent">
            {{ formatInt(transactions.length) }}
          </p>
        </RouterLink>

        <div
          class="relative overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-100/90 via-amber-50 to-white p-6 shadow-lg shadow-amber-500/15 ring-1 ring-amber-400/20"
        >
          <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p class="mt-4 text-xs font-bold uppercase tracking-wider text-amber-900/80">
            En verificación
          </p>
          <p class="mt-1 text-4xl font-bold tabular-nums text-amber-950">
            {{ formatInt(inVerificationCount) }}
          </p>
          <p class="mt-1 text-xs font-medium text-amber-800/70">
            <code class="rounded bg-amber-100/80 px-1 text-[10px]">verification</code>
            + pendiente (legado)
          </p>
        </div>

        <div
          class="relative overflow-hidden rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-100/90 via-violet-50 to-white p-6 shadow-lg shadow-violet-500/15 ring-1 ring-violet-400/20"
        >
          <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 text-white shadow-lg shadow-violet-500/30">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p class="mt-4 text-xs font-bold uppercase tracking-wider text-violet-900/80">
            Verificado (revisión)
          </p>
          <p class="mt-1 text-4xl font-bold tabular-nums text-violet-950">
            {{ formatInt(verifiedIntermediateCount) }}
          </p>
          <p class="mt-1 text-xs font-medium text-violet-800/70">
            Checklist OK, cierre incompleto
          </p>
        </div>

        <div
          class="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-100/90 via-emerald-50 to-white p-6 shadow-lg shadow-emerald-500/15 ring-1 ring-emerald-400/20"
        >
          <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
            <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          </div>
          <p class="mt-4 text-xs font-bold uppercase tracking-wider text-emerald-900/80">
            Finalizadas
          </p>
          <p class="mt-1 text-4xl font-bold tabular-nums text-emerald-950">
            {{ formatInt(completedCount) }}
          </p>
          <p class="mt-1 text-xs font-medium text-emerald-800/70">
            Estado <code class="rounded bg-emerald-100/80 px-1 text-[10px]">completed</code>
          </p>
        </div>

        <div
          class="relative overflow-hidden rounded-2xl border border-rose-200/70 bg-gradient-to-br from-rose-50 to-white p-6 shadow-lg shadow-rose-500/10 ring-1 ring-rose-200/40"
        >
          <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 to-red-600 text-white shadow-md">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p class="mt-4 text-xs font-bold uppercase tracking-wider text-rose-900/80">
            Fallidas
          </p>
          <p class="mt-1 text-4xl font-bold tabular-nums text-rose-950">
            {{ formatInt(failedCount) }}
          </p>
        </div>
      </div>

      <div class="mt-10 mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brasper-indigoStrong/80">
        Volumen y ritmo
      </div>
      <div class="grid gap-5 lg:grid-cols-2">
        <div
          class="relative overflow-hidden rounded-2xl border border-brasper-indigoStrong/15 bg-gradient-to-br from-white via-brasper-cyanLight/10 to-white p-8 shadow-xl shadow-brasper-indigoStrong/10 ring-1 ring-brasper-cyan/20"
        >
          <div class="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-gradient-to-br from-brasper-cyanLight/50 to-transparent blur-2xl" aria-hidden="true" />
          <div class="relative flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-brasper-indigoStrong text-white shadow-md">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 class="text-base font-bold text-brasper-indigoDark">
                Volumen liquidado
              </h2>
              <p class="text-xs text-[#64748b]">
                Suma en <code class="rounded bg-slate-100 px-1 text-[10px]">completed</code> (y legado
                <code class="rounded bg-slate-100 px-1 text-[10px]">checked</code>)
              </p>
            </div>
          </div>
          <dl class="relative mt-6 grid gap-6 sm:grid-cols-2">
            <div class="rounded-xl bg-white/80 p-4 shadow-inner ring-1 ring-brasper-indigoStrong/10">
              <dt class="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">Origen</dt>
              <dd class="mt-2 bg-gradient-to-r from-brasper-indigoDark to-brasper-indigoStrong bg-clip-text text-2xl font-bold tabular-nums text-transparent sm:text-3xl">
                {{ formatMoney(volumeOriginCompleted) }}
              </dd>
            </div>
            <div class="rounded-xl bg-white/80 p-4 shadow-inner ring-1 ring-brasper-indigoStrong/10">
              <dt class="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">Destino</dt>
              <dd class="mt-2 bg-gradient-to-r from-brasper-cyan to-brasper-indigoStrong bg-clip-text text-2xl font-bold tabular-nums text-transparent sm:text-3xl">
                {{ formatMoney(volumeDestCompleted) }}
              </dd>
            </div>
          </dl>
        </div>

        <div
          class="relative overflow-hidden rounded-2xl border border-violet-200/50 bg-gradient-to-br from-violet-600 via-brasper-indigoStrong to-brasper-indigoDark p-8 text-white shadow-xl shadow-violet-900/30"
        >
          <div class="absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-brasper-cyanLight/25 blur-3xl" aria-hidden="true" />
          <div class="relative flex items-start gap-4">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30">
              <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 class="text-lg font-bold">Últimos 7 días</h2>
              <p class="mt-1 text-sm text-white/80">
                Movimientos con fecha reciente (creado o envío)
              </p>
            </div>
          </div>
          <p class="relative mt-6 text-5xl font-black tabular-nums tracking-tight drop-shadow-md sm:text-6xl">
            {{ formatInt(transactionsLast7Days) }}
          </p>
          <p class="relative mt-2 text-sm font-medium text-white/75">operaciones en ventana móvil</p>
        </div>
      </div>

      <div class="mt-10 mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brasper-indigoStrong/80">
        Configuración
      </div>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RouterLink
          to="/app/cuentas"
          class="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-md transition duration-300 hover:-translate-y-0.5 hover:border-brasper-cyan/50 hover:shadow-lg"
        >
          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-brasper-indigoStrong transition group-hover:bg-brasper-cyanLight/40">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p class="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">
            Cuentas bancarias
          </p>
          <p class="mt-1 text-3xl font-bold tabular-nums text-slate-900">
            {{ formatInt(cuentasStore.bankAccounts.length) }}
          </p>
        </RouterLink>

        <RouterLink
          to="/app/cupones"
          class="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-md transition duration-300 hover:-translate-y-0.5 hover:border-brasper-cyan/50 hover:shadow-lg"
        >
          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-brasper-indigoStrong transition group-hover:bg-brasper-cyanLight/40">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>
          <p class="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">
            Cupones activos
          </p>
          <p class="mt-1 text-3xl font-bold tabular-nums text-slate-900">
            {{ formatInt(couponsActive) }}
          </p>
          <p class="text-xs font-medium text-brasper-indigoStrong/70">
            de {{ formatInt(cuponesStore.coupons.length) }} en total
          </p>
        </RouterLink>

        <RouterLink
          to="/app/tasas"
          class="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-md transition duration-300 hover:-translate-y-0.5 hover:border-brasper-cyan/50 hover:shadow-lg"
        >
          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-brasper-indigoStrong transition group-hover:bg-brasper-cyanLight/40">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <p class="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">
            Pares de tasa
          </p>
          <p class="mt-1 text-3xl font-bold tabular-nums text-slate-900">
            {{ formatInt(tasasStore.taxRates.length) }}
          </p>
        </RouterLink>

        <RouterLink
          to="/app/comisiones"
          class="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-md transition duration-300 hover:-translate-y-0.5 hover:border-brasper-cyan/50 hover:shadow-lg"
        >
          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-brasper-indigoStrong transition group-hover:bg-brasper-cyanLight/40">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <p class="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">
            Comisiones
          </p>
          <p class="mt-1 text-3xl font-bold tabular-nums text-slate-900">
            {{ formatInt(comisionesStore.commissions.length) }}
          </p>
        </RouterLink>
      </div>

      <div class="mt-8 grid gap-5 lg:grid-cols-2">
        <div
          class="rounded-2xl border border-slate-200/90 bg-white/95 p-7 shadow-lg shadow-slate-200/50 ring-1 ring-slate-100"
        >
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-brasper-cyan shadow-[0_0_8px_rgba(41,182,246,0.8)]" />
            <h2 class="text-base font-bold text-slate-900">Catálogo y usuarios</h2>
          </div>
          <ul class="mt-5 space-y-4 text-sm">
            <li class="flex items-center justify-between gap-4 rounded-xl bg-slate-50/80 px-4 py-3 ring-1 ring-slate-100">
              <span class="font-medium text-slate-600">Bancos en catálogo</span>
              <span class="text-lg font-bold tabular-nums text-brasper-indigoDark">{{
                formatInt(cuentasStore.banks.length)
              }}</span>
            </li>
            <li class="flex items-center justify-between gap-4 rounded-xl bg-slate-50/80 px-4 py-3 ring-1 ring-slate-100">
              <span class="font-medium text-slate-600">Clientes</span>
              <RouterLink
                to="/app/usuarios"
                class="text-lg font-bold tabular-nums text-brasper-indigoStrong underline-offset-2 hover:underline"
              >
                {{ formatInt(cuentasStore.clientUsers.length) }}
              </RouterLink>
            </li>
            <li class="flex items-center justify-between gap-4 rounded-xl bg-slate-50/80 px-4 py-3 ring-1 ring-slate-100">
              <span class="font-medium text-slate-600">Usuarios totales</span>
              <span
                v-if="usersTotal != null"
                class="text-lg font-bold tabular-nums text-brasper-indigoDark"
                >{{ formatInt(usersTotal) }}</span
              >
              <span v-else class="text-sm text-amber-600">—</span>
            </li>
          </ul>
          <p
            v-if="usersLoadError"
            class="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900"
          >
            {{ usersLoadError }}
          </p>
        </div>

        <div
          class="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 p-7 shadow-lg shadow-slate-200/50 ring-1 ring-slate-100"
        >
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-brasper-indigoStrong shadow-[0_0_8px_rgba(63,81,181,0.6)]" />
            <h2 class="text-base font-bold text-slate-900">Distribución por estado</h2>
          </div>
          <p class="mt-1 text-xs text-slate-500">
            Campo <code class="rounded-md bg-slate-200/60 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">status</code> por transacción
          </p>
          <ul v-if="totalForBreakdown > 0" class="mt-5 space-y-3">
            <li
              v-for="row in statusBreakdown"
              :key="row.key"
              class="flex items-center gap-3"
            >
              <span class="w-[7.5rem] shrink-0 text-xs font-semibold text-slate-600">{{ row.label }}</span>
              <div class="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200/90 shadow-inner">
                <div
                  class="h-full rounded-full bg-gradient-to-r shadow-sm transition-all duration-500"
                  :class="{
                    'from-amber-400 via-amber-500 to-orange-500':
                      row.key === 'pending' || row.key === 'verification',
                    'from-violet-400 via-violet-500 to-purple-600': row.key === 'verified',
                    'from-emerald-400 via-emerald-500 to-teal-600': row.key === 'completed',
                    'from-rose-400 via-red-500 to-red-700': row.key === 'failed',
                    'from-sky-400 via-sky-500 to-indigo-500': row.key === 'checked',
                    'from-slate-400 via-slate-500 to-slate-600': row.key === 'cancelled',
                    'from-brasper-cyanLight via-brasper-indigo to-brasper-indigoDark':
                      ![
                        'pending',
                        'verification',
                        'verified',
                        'completed',
                        'failed',
                        'checked',
                        'cancelled',
                      ].includes(row.key),
                  }"
                  :style="{
                    width: `${Math.max(8, Math.round((row.n / totalForBreakdown) * 100))}%`,
                  }"
                />
              </div>
              <span class="w-9 shrink-0 text-right text-sm font-bold tabular-nums text-slate-800">{{
                row.n
              }}</span>
            </li>
          </ul>
          <p v-else class="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
            Sin datos de estado para graficar.
          </p>
        </div>
      </div>

      <p
        v-if="
          transactionsStore.error ||
          cuentasStore.error ||
          cuponesStore.error ||
          comisionesStore.error ||
          tasasStore.error
        "
        class="mt-8 rounded-xl border border-red-300/80 bg-gradient-to-r from-red-50 to-white px-5 py-4 text-sm font-medium text-red-900 shadow-md shadow-red-100"
      >
        Algunos datos pueden estar incompletos:
        {{
          [
            transactionsStore.error,
            cuentasStore.error,
            cuponesStore.error,
            comisionesStore.error,
            tasasStore.error,
          ]
            .filter(Boolean)
            .join(" · ")
        }}
      </p>
      </template>
    </template>
  </div>
</template>

<style scoped>
.dashboard-surface {
  animation: dashboard-fade 0.45s ease-out;
}
@keyframes dashboard-fade {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
