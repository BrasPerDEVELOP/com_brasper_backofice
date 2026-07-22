<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter, RouterLink, RouterView } from "vue-router";
import { useAuthStore } from "@modules/auth/presentation/controllers/use_auth_store_controller";
import { Domain } from "@/interface/infrastructure/services";
import { getNavIcon } from "./nav_icons";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const messageBadgeCount = ref(2);
const notifyBadgeCount = ref(2);

const userInitial = computed(() => {
  const email = authStore.user?.email;
  if (!email) return "?";
  return (email[0] ?? "?").toUpperCase();
});

const profileImageUrl = computed(() => {
  const img = authStore.user?.profile_image;
  if (!img) return "";
  return Domain.mediaUrl(img);
});

const navbarImageError = ref(false);
watch(
  () => authStore.user?.profile_image,
  () => {
    navbarImageError.value = false;
  },
);

async function handleLogout() {
  await authStore.logout();
  await router.replace("/");
}

const showSidebar = computed(() => route.path.startsWith("/app"));

const allNavItems = [
  { to: "/app/dashboard", label: "Panel", icon: "chart", permission: "dashboard.view" },
  { to: "/app/metricas", label: "Métricas", icon: "metrics", permission: "metrics.view" },
  { to: "/app/usuarios", label: "Usuarios y cuentas", icon: "users", permissions: ["users.view", "bank_accounts.view"] },
  { to: "/app/transacciones", label: "Transacciones", icon: "transactions", permission: "transactions.view" },
  { to: "/app/contabilidad", label: "Contabilidad", icon: "ledger", permission: "accounting.view" },
  { to: "/app/calculator", label: "Calculadora", icon: "calc", permission: "calculator.view" },
  { to: "/app/cupones", label: "Cupones", icon: "ticket", permission: "coupons.view" },
  { to: "/app/comisiones", label: "Comisiones", icon: "folder", permission: "commissions.view" },
  { to: "/app/tasas", label: "Tasas", icon: "exchange", permission: "rates.view" },
  { to: "/app/cuentas-brasper", label: "Cuentas Brasper", icon: "bank", permission: "company_bank_accounts.view" },
  { to: "/app/home-banner", label: "Banner Home", icon: "image", permission: "home_banner.view" },
  { to: "/app/blog", label: "Blog", icon: "ledger", permission: "blog.view" },
];

const allBottomNavItems = [
  { to: "/app/roles-permisos", label: "Permisos", icon: "settings", permission: "roles.permissions.view" },
];

const navItems = computed(() =>
  allNavItems.filter((item) => {
    if ('permissions' in item && item.permissions) {
      return item.permissions.some((permission) => authStore.hasPermission(permission))
    }
    return 'permission' in item && typeof item.permission === 'string'
      ? authStore.hasPermission(item.permission)
      : false
  })
);

const bottomNavItems = computed(() =>
  allBottomNavItems.filter((item) => authStore.hasPermission(item.permission))
);

const sidebarLogoutButtonClass = [
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all",
  "text-white/90 hover:bg-white/15 hover:text-white",
] as const;

const breadcrumbs = computed(() => {
  const name = (route.name as string) ?? "";
  const meta = (route.meta?.breadcrumb as string) ?? "";
  if (meta) return meta;
  const map: Record<string, string> = {
    dashboard: "Panel > Resumen",
    transacciones: "Operaciones > Transacciones",
    contabilidad: "Operaciones > Contabilidad",
    calculator: "Operaciones > Calculadora",
    cupones: "Operaciones > Cupones",
    comisiones: "Comercial > Comisiones",
    cuentas: "Configuración > Cuentas",
    tasas: "Configuración > Tasas de cambio",
    perfil: "Cuenta > Perfil",
    usuarios: "Cuenta > Usuarios",
    "roles-permisos": "Configuración > Permisos de roles",
  };
  return map[name];
});

const isActive = (to: string | { path: string; query?: Record<string, string> }) => {
  const path = typeof to === "string" ? to.split("?")[0] : to.path;
  return route.path === path || route.path.startsWith(path + "/");
};

const sidebarLinkClass = (to: string) =>
  [
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all",
    isActive(to)
      ? "bg-white/25 text-white shadow-md"
      : "text-white/90 hover:bg-white/15 hover:text-white",
  ] as const;

/** Teleport al body: el nav con overflow-y-auto recorta cualquier tooltip hijo (overflow-x deja de ser visible). */
const sidebarTooltip = ref<{
  label: string;
  top: number;
  left: number;
} | null>(null);

function openSidebarTooltip(e: Event, label: string) {
  const el = e.currentTarget as HTMLElement | null;
  if (!el) return;
  const r = el.getBoundingClientRect();
  sidebarTooltip.value = {
    label,
    top: r.top + r.height / 2,
    left: r.right + 10,
  };
}

function closeSidebarTooltip() {
  sidebarTooltip.value = null;
}

watch(showSidebar, (vis) => {
  if (!vis) closeSidebarTooltip();
});
</script>

<template>
  <div class="min-h-screen bg-[#f5f7fa]">
    <header
      v-if="showSidebar"
      class="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-neutral-200/90 bg-white px-4 shadow-sm sm:px-6 lg:px-8"
    >
      <div class="flex min-w-0 flex-1 items-center gap-4 lg:gap-8">
        <RouterLink
          to="/app/dashboard"
          class="flex shrink-0 items-center gap-3"
        >
          <img
            src="/assets/logos/logo_completo.png"
            alt="Brasper"
            class="h-9 w-auto max-w-[140px] object-contain"
          />
        </RouterLink>
        <div
          class="hidden min-w-0 items-center gap-2 text-sm text-neutral-600 md:flex"
        >
          
          <span class="truncate font-medium text-neutral-700">{{
            breadcrumbs
          }}</span>
        </div>
      </div>
      <div class="flex items-center gap-1 sm:gap-2">
        <button
          type="button"
          class="relative flex h-10 w-10 items-center justify-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
          title="Calendario"
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
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </button>
        <RouterLink
          to="/app/cupones"
          class="relative flex h-10 w-10 items-center justify-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
          title="Mensajes"
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
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span
            v-if="messageBadgeCount > 0"
            class="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brasper-indigoStrong px-1 text-[10px] font-bold leading-none text-white"
            >{{ messageBadgeCount > 9 ? "9+" : messageBadgeCount }}</span
          >
        </RouterLink>
        <button
          type="button"
          class="relative flex h-10 w-10 items-center justify-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
          title="Notificaciones"
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
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span
            v-if="notifyBadgeCount > 0"
            class="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brasper-indigoStrong px-1 text-[10px] font-bold leading-none text-white"
            >{{ notifyBadgeCount > 9 ? "9+" : notifyBadgeCount }}</span
          >
        </button>
        <RouterLink
          to="/app/perfil"
          class="ml-1 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-200/90 bg-gradient-to-br from-brasper-cyanLight/25 to-brasper-indigoStrong/20 text-sm font-bold text-brasper-indigoDark ring-offset-2 transition hover:ring-2 hover:ring-brasper-indigoStrong/35"
          title="Mi perfil"
          aria-label="Ir a mi perfil"
        >
          <img
            v-if="profileImageUrl && !navbarImageError"
            :src="profileImageUrl"
            :alt="authStore.user?.name ?? 'Perfil'"
            class="h-full w-full object-cover"
            @error="navbarImageError = true"
          />
          <span v-else>{{ userInitial }}</span>
        </RouterLink>
      </div>
    </header>

    <aside
      v-if="showSidebar"
      class="fixed bottom-6 left-3 top-[5.25rem] z-20 flex w-[3.75rem] flex-col rounded-2xl bg-gradient-to-b from-brasper-indigoStrong to-brasper-indigoDark py-4 shadow-lg shadow-brasper-indigoDark/35"
      aria-label="Navegación principal"
    >
      <nav class="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto px-2">
        <div
          v-for="item in navItems"
          :key="item.to"
          class="flex w-full justify-center"
        >
          <RouterLink
            :to="item.to"
            :aria-label="item.label"
            :class="sidebarLinkClass(item.to)"
            @mouseenter="openSidebarTooltip($event, item.label)"
            @mouseleave="closeSidebarTooltip"
            @focus="openSidebarTooltip($event, item.label)"
            @blur="closeSidebarTooltip"
          >
            <component :is="getNavIcon(item.icon)" class="h-5 w-5 shrink-0" />
          </RouterLink>
        </div>
      </nav>
      <div class="mx-3 my-3 h-px shrink-0 bg-white/35" />
      <div class="flex flex-col items-center gap-1 px-2 pb-1">
        <div
          v-for="item in bottomNavItems"
          :key="item.to + item.icon"
          class="flex w-full justify-center"
        >
          <RouterLink
            :to="item.to"
            :aria-label="item.label"
            :class="sidebarLinkClass(item.to)"
            @mouseenter="openSidebarTooltip($event, item.label)"
            @mouseleave="closeSidebarTooltip"
            @focus="openSidebarTooltip($event, item.label)"
            @blur="closeSidebarTooltip"
          >
            <component :is="getNavIcon(item.icon)" class="h-5 w-5 shrink-0" />
          </RouterLink>
        </div>
        <div class="flex w-full justify-center">
          <button
            type="button"
            :class="sidebarLogoutButtonClass"
            aria-label="Cerrar sesión"
            @click="handleLogout"
            @mouseenter="openSidebarTooltip($event, 'Cerrar sesión')"
            @mouseleave="closeSidebarTooltip"
            @focus="openSidebarTooltip($event, 'Cerrar sesión')"
            @blur="closeSidebarTooltip"
          >
            <component :is="getNavIcon('logout')" class="h-5 w-5 shrink-0" />
          </button>
        </div>
      </div>
    </aside>

    <Teleport to="body">
      <div
        v-if="sidebarTooltip"
        role="tooltip"
        class="pointer-events-none fixed z-[9999] whitespace-nowrap rounded-lg bg-neutral-900/95 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg ring-1 ring-white/15"
        :style="{
          top: `${sidebarTooltip.top}px`,
          left: `${sidebarTooltip.left}px`,
          transform: 'translateY(-50%)',
        }"
      >
        {{ sidebarTooltip.label }}
      </div>
    </Teleport>

    <main
      :class="[
        'min-h-screen transition-[margin] duration-300',
        showSidebar ? 'ml-[5.25rem] pt-16' : 'ml-0 pt-0',
      ]"
    >
      <div class="p-8 lg:p-10">
        <RouterView />
      </div>
    </main>
  </div>
</template>
