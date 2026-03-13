import { defineStore } from 'pinia'
import type { Coupon } from '../../domain/models'
import type { CouponPayload, CouponUpdatePayload, CuponesRepository } from '../../infrastructure/adapters'
import { CuponesApiAdapter } from '../../infrastructure/adapters'
import { CreateCouponUseCase, GetCouponsUseCase, UpdateCouponUseCase } from '../../application/use_cases'

interface CouponFormInput {
  code: string
  discount_percentage: string | number
  max_uses: string | number
  origin_currency: string
  destination_currency: string
  start_date: string
  end_date: string
  is_active: boolean
}

interface CuponesState {
  coupons: Coupon[]
  isLoading: boolean
  error: string | null
  savingId: string | null
}

function getRepository(): CuponesRepository {
  return new CuponesApiAdapter()
}

function localDateTimeToIso(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}

function toTrimmedString(value: string | number): string {
  return String(value ?? '').trim()
}

function normalizePayload(form: CouponFormInput): CouponPayload | null {
  const code = form.code.trim().toUpperCase()
  const originCurrency = form.origin_currency.trim().toUpperCase()
  const destinationCurrency = form.destination_currency.trim().toUpperCase()
  const discountPercentage = Number(toTrimmedString(form.discount_percentage))
  const maxUses = Number(toTrimmedString(form.max_uses))
  const startDate = localDateTimeToIso(form.start_date)
  const endDate = localDateTimeToIso(form.end_date)

  if (!code || !originCurrency || !destinationCurrency) return null
  if (Number.isNaN(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) return null
  if (Number.isNaN(maxUses) || maxUses < 0) return null
  if (!startDate || !endDate) return null
  if (new Date(startDate).getTime() > new Date(endDate).getTime()) return null

  return {
    code,
    discount_percentage: discountPercentage,
    max_uses: maxUses,
    origin_currency: originCurrency,
    destination_currency: destinationCurrency,
    start_date: startDate,
    end_date: endDate,
    is_active: form.is_active
  }
}

export const useCuponesStore = defineStore('cupones', {
  state: (): CuponesState => ({
    coupons: [],
    isLoading: false,
    error: null,
    savingId: null
  }),

  actions: {
    async loadCoupons() {
      this.isLoading = true
      this.error = null
      try {
        const useCase = new GetCouponsUseCase(getRepository())
        this.coupons = await useCase.execute()
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al cargar cupones'
      } finally {
        this.isLoading = false
      }
    },

    async createCoupon(payload: CouponPayload) {
      this.savingId = 'new'
      this.error = null
      try {
        const useCase = new CreateCouponUseCase(getRepository())
        const created = await useCase.execute(payload)
        this.coupons = [created, ...this.coupons]
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al crear cupón'
      } finally {
        this.savingId = null
      }
    },

    async updateCoupon(payload: CouponUpdatePayload) {
      this.savingId = payload.id
      this.error = null
      try {
        const useCase = new UpdateCouponUseCase(getRepository())
        const updated = await useCase.execute(payload)
        const index = this.coupons.findIndex((coupon) => coupon.id === payload.id)
        if (index >= 0) this.coupons[index] = updated
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al actualizar cupón'
      } finally {
        this.savingId = null
      }
    },

    async validateAndCreateCoupon(form: CouponFormInput): Promise<boolean> {
      const payload = normalizePayload(form)
      if (!payload) {
        this.error = 'Completa un código, monedas válidas, porcentaje entre 0 y 100, usos máximos y un rango de fechas correcto.'
        return false
      }
      await this.createCoupon(payload)
      return !this.error
    },

    async validateAndUpdateCoupon(id: string, form: CouponFormInput): Promise<boolean> {
      const current = this.coupons.find((coupon) => coupon.id === id)
      if (!current) {
        this.error = 'No se encontró el cupón a editar.'
        return false
      }

      const payload = normalizePayload(form)
      if (!payload) {
        this.error = 'Completa un código, monedas válidas, porcentaje entre 0 y 100, usos máximos y un rango de fechas correcto.'
        return false
      }

      await this.updateCoupon({ id: current.id, ...payload })
      return !this.error
    }
  }
})
