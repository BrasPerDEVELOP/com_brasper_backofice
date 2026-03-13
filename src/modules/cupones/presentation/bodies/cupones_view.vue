<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue'
import CouponCreateForm from '../components/CouponCreateForm.vue'
import CouponList from '../components/CouponList.vue'
import { useCuponesStore } from '../controllers/use_cupones_store_controller'

interface CouponFormModel {
  code: string
  discount_percentage: string
  max_uses: string
  origin_currency: string
  destination_currency: string
  start_date: string
  end_date: string
  is_active: boolean
}

const cuponesStore = useCuponesStore()
const createFormRef = useTemplateRef<InstanceType<typeof CouponCreateForm>>('createFormRef')

async function handleCreate(payload: CouponFormModel): Promise<void> {
  const ok = await cuponesStore.validateAndCreateCoupon(payload)
  if (ok) createFormRef.value?.resetForm()
}

async function handleUpdate(id: string, payload: CouponFormModel): Promise<void> {
  await cuponesStore.validateAndUpdateCoupon(id, payload)
}

onMounted(() => {
  cuponesStore.loadCoupons()
})
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-2xl border border-[#d8e5fb] bg-white p-6 shadow-lg shadow-[#007bff]/5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#066ac9]">Operaciones</p>
          <h1 class="text-2xl font-semibold text-[#232b4d]">Cupones</h1>
          <p class="mt-2 max-w-2xl text-sm text-[#667085]">
            Administra códigos promocionales y su vigencia para las transacciones.
          </p>
        </div>
      </div>

      <p
        v-if="cuponesStore.error"
        class="mt-4 rounded-lg bg-[#dc3545]/10 px-3 py-2 text-sm text-[#dc3545]"
      >
        {{ cuponesStore.error }}
      </p>
    </section>

    <div v-if="cuponesStore.isLoading" class="rounded-2xl border border-[#d8e5fb] bg-white px-6 py-8 text-[#666] shadow-lg shadow-[#007bff]/5">
      Cargando cupones...
    </div>

    <template v-else>
      <CouponCreateForm
        ref="createFormRef"
        :currency-options="cuponesStore.currencyOptions"
        :is-saving="cuponesStore.savingId === 'new'"
        @submit="handleCreate"
      />
      <CouponList
        :coupons="cuponesStore.coupons"
        :currency-options="cuponesStore.currencyOptions"
        :saving-id="cuponesStore.savingId"
        @save="handleUpdate"
      />
    </template>
  </div>
</template>
