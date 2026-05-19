import {
  apiClient,
  getApiAuthHeaders,
  triggerUnauthorized
} from '@/interface/api/client'
import { formatApiErrorBody } from '@/interface/api/format_api_error'
import { Domain } from '@/interface/infrastructure/services'
import { env } from '@/interface/config/env'
import type {
  TransactionsRepository,
  CreateTransactionPayload,
  UpdateTransactionPayload,
  GetTransactionsParams
} from './transactions_repository'
import type { Transaction } from '../../domain/models'

function parseOptionalAmount(v: unknown): number | undefined {
  if (v == null || v === '') return undefined
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : undefined
}

function parseTruthyFlag(v: unknown): boolean {
  if (v === true || v === 'true' || v === 1 || v === '1') return true
  return false
}

/** Primer string no vacío entre candidatos (alias de API). */
function firstNonEmptyString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (v == null || v === '') continue
    const s = String(v).trim()
    if (s) return s
  }
  return undefined
}

function appendFileToForm(form: FormData, key: string, file: File): void {
  const name = file.name?.trim() || 'upload'
  form.append(key, file, name)
}

function appendFormValue(form: FormData, key: string, value: unknown): void {
  if (value === undefined) return
  if (value instanceof File) {
    appendFileToForm(form, key, value)
    return
  }
  if (typeof value === 'boolean') {
    form.append(key, value ? 'true' : 'false')
    return
  }
  if (typeof value === 'number') {
    form.append(key, String(value))
    return
  }
  if (typeof value === 'string') {
    form.append(key, value)
    return
  }
  form.append(key, String(value))
}

/** UUID/string o objeto anidado desde el API (evita String(obj) → "[object Object]"). */
function coerceBankAccountId(value: unknown): string | undefined {
  if (value == null || value === '') return undefined
  if (typeof value === 'string' || typeof value === 'number') {
    const s = String(value).trim()
    return s ? s : undefined
  }
  if (typeof value === 'object' && value !== null) {
    const rec = value as Record<string, unknown>
    const id = rec.id ?? rec.uuid ?? rec.account_id ?? rec.bank_account_id
    if (id != null && id !== '') return String(id).trim() || undefined
  }
  return undefined
}

function coerceUserId(value: unknown): string | undefined {
  if (value == null || value === '') return undefined
  if (typeof value === 'string' || typeof value === 'number') {
    const s = String(value).trim()
    return s ? s : undefined
  }
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id: unknown }).id
    if (id != null && id !== '') return String(id).trim() || undefined
  }
  return undefined
}

function extractOriginDestinationIds(o: Record<string, unknown>): {
  origin: string | undefined
  dest: string | undefined
} {
  const origin =
    coerceBankAccountId(o.bank_account_origin_id) ??
    coerceBankAccountId(o.bank_account_origin) ??
    coerceBankAccountId(o.cuenta_origen_id) ??
    coerceBankAccountId(o.cuenta_origen) ??
    coerceBankAccountId(o.origin_bank_account_id) ??
    coerceBankAccountId(o.from_account_id)
  const dest =
    coerceBankAccountId(o.bank_account_destination_id) ??
    coerceBankAccountId(o.bank_account_destination) ??
    coerceBankAccountId(o.cuenta_destino_id) ??
    coerceBankAccountId(o.cuenta_destino) ??
    coerceBankAccountId(o.destination_bank_account_id) ??
    coerceBankAccountId(o.to_account_id)
  return { origin, dest }
}

/**
 * Combina el JSON crudo con el parse normalizado sin pisar campos válidos con `undefined`
 * (p. ej. el detalle GET trae IDs en claves que el parse aún no mapea).
 */
function transactionFromApiRecord(item: Record<string, unknown>): Transaction {
  const parsed = parseTransaction(item)
  const merged: Record<string, unknown> = { ...item }
  for (const [k, v] of Object.entries(parsed)) {
    if (v !== undefined) merged[k] = v
  }
  const { origin, dest } = extractOriginDestinationIds(item)
  const curO = merged.bank_account_origin_id
  const curD = merged.bank_account_destination_id
  if (curO == null || curO === '') {
    if (origin) merged.bank_account_origin_id = origin
  }
  if (curD == null || curD === '') {
    if (dest) merged.bank_account_destination_id = dest
  }
  return merged as Transaction
}

function parseTransaction(item: unknown): Transaction {
  if (item == null || typeof item !== 'object') return {}
  const o = item as Record<string, unknown>
  const resultado =
    parseOptionalAmount(o.resultado_comision) ??
    parseOptionalAmount(o.commission_result)
  const totalSend =
    parseOptionalAmount(o.total_a_enviar) ?? parseOptionalAmount(o.total_to_send)
  const taxAmount =
    parseOptionalAmount(o.tax_amount) ??
    parseOptionalAmount(o.tipo_cambio) ??
    parseOptionalAmount(o.rate)
  const { origin: originFromFlat, dest: destFromFlat } =
    extractOriginDestinationIds(o)
  const legacySingle = coerceBankAccountId(o.bank_account_id)

  const comisionFinalInterna =
    parseOptionalAmount(o.comision_final_interna) ??
    parseOptionalAmount(o.comision_final_interno) ??
    parseOptionalAmount(o.comision_final)
  const impuestoFinalInterno =
    parseOptionalAmount(o.impuesto_final_interno) ??
    parseOptionalAmount(o.impuesto_final) ??
    parseOptionalAmount(o.impuesto_interno) ??
    parseOptionalAmount(o.impuesto)
  let ventaFinal =
    parseOptionalAmount(o.venta_final) ??
    parseOptionalAmount(o.venta_total) ??
    parseOptionalAmount(o.venta)
  if (
    ventaFinal == null &&
    comisionFinalInterna != null &&
    impuestoFinalInterno != null
  ) {
    ventaFinal =
      Math.round((comisionFinalInterna + impuestoFinalInterno) * 100) / 100
  }

  const fechaEmisionRaw = o.fecha_emision ?? o.fecha_de_emision ?? o.issue_date
  const fechaEmision =
    fechaEmisionRaw != null && String(fechaEmisionRaw).trim()
      ? String(fechaEmisionRaw)
      : undefined

  const observacionesRaw = o.observaciones ?? o.observations ?? o.notes
  const observaciones =
    observacionesRaw != null && String(observacionesRaw).trim()
      ? String(observacionesRaw).trim()
      : undefined

  let diasAtraso: number | undefined
  const diasRaw = o.dias_atraso ?? o.dias_de_atraso ?? o.delay_days
  if (diasRaw != null && diasRaw !== '') {
    const n = typeof diasRaw === 'number' ? diasRaw : Number(diasRaw)
    if (Number.isFinite(n)) diasAtraso = Math.trunc(n)
  }

  const couponRaw = o.coupon_id
  const coupon_id =
    couponRaw == null || couponRaw === ''
      ? undefined
      : String(couponRaw)
  const couponDiscountCodeRaw = o.coupon_discount_code
  const coupon_discount_code =
    couponDiscountCodeRaw == null || couponDiscountCodeRaw === ''
      ? undefined
      : String(couponDiscountCodeRaw).trim()
  const checked_image = firstNonEmptyString(
    o.checked_image,
    o.checkedImage,
    o.checked_image_url,
    o.verification_image,
    o.imagen_verificacion,
    o.checklist_image,
    o.imagen_checklist,
    o.verify_image
  )
  const operationNumberRaw = o.operation_number ?? o.numero_operacion
  const operation_number =
    operationNumberRaw == null || operationNumberRaw === ''
      ? undefined
      : String(operationNumberRaw).trim()

  const statusRaw = o.status ?? o.estado ?? o.transaction_status ?? o.state
  const transactionStatus =
    statusRaw != null && String(statusRaw).trim()
      ? String(statusRaw).trim()
      : undefined
  const transactionChecked =
    parseTruthyFlag(o.checked) ||
    parseTruthyFlag(o.is_checked) ||
    parseTruthyFlag(o.is_verified) ||
    parseTruthyFlag(o.verified) ||
    parseTruthyFlag(o.has_checked_image)

  return {
    id: o.id != null ? String(o.id) : undefined,
    bank_account_id: legacySingle,
    bank_account_origin_id: originFromFlat,
    bank_account_destination_id: destFromFlat,
    user_id: coerceUserId(o.user_id) ?? coerceUserId(o.user),
    agent_id:
      coerceUserId(o.agent_id) ??
      coerceUserId(o.agent) ??
      coerceUserId(o.user_id) ??
      coerceUserId(o.user),
    tax_rate_id: o.tax_rate_id != null ? String(o.tax_rate_id) : undefined,
    commission_id: o.commission_id != null ? String(o.commission_id) : undefined,
    status: transactionStatus,
    origin_amount: typeof o.origin_amount === 'number' ? o.origin_amount : Number(o.origin_amount) || 0,
    destination_amount:
      typeof o.destination_amount === 'number' ? o.destination_amount : Number(o.destination_amount) || 0,
    code: o.code != null ? String(o.code) : undefined,
    operation_number,
    resultado_comision: resultado,
    commission_result: parseOptionalAmount(o.commission_result) ?? resultado,
    total_a_enviar: totalSend,
    total_to_send: parseOptionalAmount(o.total_to_send) ?? totalSend,
    tax_amount: taxAmount,
    coupon_id,
    coupon_discount_code,
    coupon_origin_amount: parseOptionalAmount(o.coupon_origin_amount),
    coupon_destination_amount: parseOptionalAmount(o.coupon_destination_amount),
    coupon_discount_percentage: parseOptionalAmount(o.coupon_discount_percentage),
    coupon_discount_commission: parseOptionalAmount(o.coupon_discount_commission),
    coupon_discount_total_to_send: parseOptionalAmount(o.coupon_discount_total_to_send),
    bank_id:
      o.bank_id != null && String(o.bank_id).trim()
        ? String(o.bank_id).trim()
        : undefined,
    bank_name:
      o.bank_name != null && String(o.bank_name).trim()
        ? String(o.bank_name).trim()
        : undefined,
    company_name: (() => {
      const raw =
        o.company_name ??
        o.razon_social ??
        o.business_name ??
        o['razón_social']
      return raw != null && String(raw).trim()
        ? String(raw).trim()
        : undefined
    })(),
    send_date: o.send_date != null ? String(o.send_date) : undefined,
    payment_date: o.payment_date != null ? String(o.payment_date) : undefined,
    send_voucher: o.send_voucher != null ? String(o.send_voucher) : undefined,
    payment_voucher: o.payment_voucher != null ? String(o.payment_voucher) : undefined,
    checked_image,
    created_at: o.created_at != null ? String(o.created_at) : undefined,
    created_by: o.created_by != null ? String(o.created_by) : undefined,
    updated_at: o.updated_at != null ? String(o.updated_at) : undefined,
    checked: transactionChecked,
    comision_final_interna: comisionFinalInterna ?? resultado,
    impuesto_final_interno: impuestoFinalInterno,
    venta_final: ventaFinal,
    fecha_emision: fechaEmision,
    observaciones,
    dias_atraso: diasAtraso
  }
}

function parseTransactions(data: unknown): Transaction[] {
  if (!Array.isArray(data)) {
    if (data != null && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
      return ((data as { data: unknown[] }).data).map((row) =>
        transactionFromApiRecord(row as Record<string, unknown>),
      )
    }
    return []
  }
  return data.map((row) =>
    transactionFromApiRecord(row as Record<string, unknown>),
  )
}

export class TransactionsApiAdapter implements TransactionsRepository {
  private endpoint(path: string): string {
    const p = path.replace(/^\/+/, '')
    return p ? Domain.apiPath(`transactions/${p}`) : Domain.apiPath('transactions/')
  }

  async getTransactions(params?: GetTransactionsParams): Promise<Transaction[]> {
    let url = this.endpoint('')
    const search = new URLSearchParams()
    if (params?.status?.trim()) search.set('status', params.status.trim())
    if (params?.user_id?.trim()) search.set('user_id', params.user_id.trim())
    if (params?.bank_account_origin_id?.trim())
      search.set('bank_account_origin_id', params.bank_account_origin_id.trim())
    if (params?.bank_account_destination_id?.trim())
      search.set('bank_account_destination_id', params.bank_account_destination_id.trim())
    if (params?.bank_account_id?.trim()) search.set('bank_account_id', params.bank_account_id.trim())
    if (params?.created_at_from?.trim()) search.set('created_at_from', params.created_at_from.trim())
    if (params?.created_at_to?.trim()) search.set('created_at_to', params.created_at_to.trim())
    const qs = search.toString()
    if (qs) url += (url.includes('?') ? '&' : '?') + qs
    const response = await apiClient.get<unknown>(url)
    const raw = response.data
    const data = Array.isArray(raw)
      ? raw
      : (raw != null && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data))
        ? (raw as { data: unknown[] }).data
        : []
    return parseTransactions(data)
  }

  async getTransactionById(id: string): Promise<Transaction | null> {
    const url = this.endpoint(`${id}`)
    try {
      const response = await apiClient.get<unknown>(url)
      const raw = response.data
      const obj = raw != null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
      const item = (obj.data ?? obj) as Record<string, unknown>
      return transactionFromApiRecord(item)
    } catch {
      return null
    }
  }

  async createTransaction(payload: CreateTransactionPayload): Promise<Transaction> {
    const formData = new FormData()
    if (payload.bank_account_origin?.trim()) {
      formData.append('bank_account_origin', payload.bank_account_origin.trim())
    }
    formData.append('bank_account_destination', payload.bank_account_destination)
    formData.append('user_id', payload.user_id)
    if (payload.agent_id != null && payload.agent_id !== '') {
      formData.append('agent_id', payload.agent_id)
    }
    formData.append('tax_rate_id', payload.tax_rate_id)
    formData.append('commission_id', payload.commission_id)
    formData.append('origin_amount', String(payload.origin_amount))
    formData.append('destination_amount', String(payload.destination_amount))
    formData.append('code', payload.code)
    if (payload.operation_number?.trim()) {
      formData.append('operation_number', payload.operation_number.trim())
    }
    if (payload.status?.trim()) {
      formData.append('status', payload.status.trim())
    }
    if (payload.checked != null) {
      formData.append('checked', payload.checked ? 'true' : 'false')
    }
    if (payload.resultado_comision != null) {
      formData.append('resultado_comision', String(payload.resultado_comision))
      formData.append('commission_result', String(payload.resultado_comision))
    }
    if (payload.total_a_enviar != null) {
      formData.append('total_a_enviar', String(payload.total_a_enviar))
      formData.append('total_to_send', String(payload.total_a_enviar))
    }
    if (payload.tax_amount != null) {
      formData.append('tax_amount', String(payload.tax_amount))
    }
    if (payload.send_voucher instanceof File)
      appendFileToForm(formData, 'send_voucher', payload.send_voucher)
    else if (typeof payload.send_voucher === 'string' && payload.send_voucher)
      formData.append('send_voucher', payload.send_voucher)
    if (payload.payment_voucher instanceof File)
      appendFileToForm(formData, 'payment_voucher', payload.payment_voucher)
    else if (typeof payload.payment_voucher === 'string' && payload.payment_voucher)
      formData.append('payment_voucher', payload.payment_voucher)
    if (payload.checked_image instanceof File)
      appendFileToForm(formData, 'checked_image', payload.checked_image)
    else if (typeof payload.checked_image === 'string' && payload.checked_image)
      formData.append('checked_image', payload.checked_image)
    if (payload.coupon_id != null && String(payload.coupon_id).trim())
      formData.append('coupon_id', String(payload.coupon_id).trim())
    if (payload.coupon_discount_code?.trim())
      formData.append('coupon_discount_code', payload.coupon_discount_code.trim())
    if (payload.coupon_origin_amount != null)
      formData.append('coupon_origin_amount', String(payload.coupon_origin_amount))
    if (payload.coupon_destination_amount != null)
      formData.append('coupon_destination_amount', String(payload.coupon_destination_amount))
    if (payload.coupon_discount_percentage != null)
      formData.append('coupon_discount_percentage', String(payload.coupon_discount_percentage))
    if (payload.coupon_discount_commission != null)
      formData.append('coupon_discount_commission', String(payload.coupon_discount_commission))
    if (payload.coupon_discount_total_to_send != null)
      formData.append('coupon_discount_total_to_send', String(payload.coupon_discount_total_to_send))
    if (payload.bank_id?.trim()) {
      formData.append('bank_id', payload.bank_id.trim())
    }
    if (payload.bank_name != null) {
      formData.append('bank_name', String(payload.bank_name))
    }
    if (payload.company_name != null) {
      formData.append('company_name', String(payload.company_name))
    }

    /**
     * `fetch` + FormData evita que axios 1.x deje `Content-Type: application/json`
     * y corrompa el multipart (400 del servidor al subir archivos).
     */
    const res = await fetch(Domain.apiUrl(this.endpoint('')), {
      method: 'POST',
      body: formData,
      headers: getApiAuthHeaders()
    })

    const ct = res.headers.get('content-type') ?? ''
    let raw: unknown = null
    if (ct.includes('application/json')) {
      raw = await res.json().catch(() => null)
    } else {
      const text = await res.text().catch(() => '')
      if (text) {
        try {
          raw = JSON.parse(text)
        } catch {
          raw = text
        }
      }
    }

    if (res.status === 401) {
      triggerUnauthorized()
      throw new Error('Sesión expirada o no autorizado')
    }

    if (!res.ok) {
      const msg =
        formatApiErrorBody(raw) ?? `Error al crear transacción (${res.status})`
      throw new Error(msg)
    }

    const obj = raw != null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const item = (obj.data ?? obj) as Record<string, unknown>
    return transactionFromApiRecord(item)
  }

  async updateTransaction(id: string, payload: UpdateTransactionPayload): Promise<Transaction> {
    // Backend espera PUT /transactions/ con id en el body (no PUT /transactions/{id}/)
    const url = this.endpoint('')
    const body: Record<string, unknown> = { id: id.trim() }
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined) continue
      body[key] = value
    }
    if (body.resultado_comision != null) {
      body.commission_result = body.resultado_comision
    }
    if (body.total_a_enviar != null) {
      body.total_to_send = body.total_a_enviar
    }
    /**
     * El servidor recalcula `status`, pero permitimos enviar estados terminales
     * explícitos desde UI cuando el flujo operativo ya los determinó.
     */
    if (
      body.status !== undefined &&
      typeof body.status === 'string' &&
      !['failed', 'completed'].includes(body.status.toLowerCase().trim())
    ) {
      delete body.status
    }
    const hasFileUpload = Object.values(body).some((value) => value instanceof File)
    const requestPayload = hasFileUpload
      ? (() => {
          const form = new FormData()
          for (const [key, value] of Object.entries(body)) {
            appendFormValue(form, key, value)
          }
          return form
        })()
      : body

    const response = await apiClient.put<unknown>(url, requestPayload)
    const raw = response.data
    const obj = raw != null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const item = (obj.data ?? obj) as Record<string, unknown>
    return transactionFromApiRecord(item)
  }

  async deleteTransaction(id: string): Promise<void> {
    const url = this.endpoint(`${id}/`)
    await apiClient.delete(url)
  }

  async importFromExcel(file: File): Promise<unknown> {
    const path = env.transactionsImportPath
    const url = path ? Domain.apiPath(path) : this.endpoint('import/')
    const ext = file.name.toLowerCase().split('.').pop() ?? ''
    let payload: { items: unknown[] }

    if (ext === 'json') {
      const { jsonFileToImportPayload } = await import('../utils/excel_to_import_json')
      payload = await jsonFileToImportPayload(file)
    } else if (ext === 'xlsx' || ext === 'xls') {
      try {
        const { excelBrasperToImportPayload } = await import('../utils/excel_brasper_format')
        payload = await excelBrasperToImportPayload(file)
      } catch (e) {
        const msg = e instanceof Error ? e.message : ''
        if (msg.includes('formato Brasper')) {
          const { excelToImportJson } = await import('../utils/excel_to_import_json')
          payload = await excelToImportJson(file)
        } else {
          throw e
        }
      }
    } else {
      throw new Error('Formato no soportado. Use .json, .xlsx o .xls')
    }

    const response = await apiClient.post(url, payload)
    return response.data
  }
}
