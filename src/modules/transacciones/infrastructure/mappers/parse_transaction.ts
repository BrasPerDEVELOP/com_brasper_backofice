import type {
  Transaction,
  TransactionDestination,
  TransactionDestinationAccountSnapshot
} from '../../domain/models'

/**
 * Etiquetas del envío. El API devuelve `tag_ids`; se acepta también `tags` con
 * objetos por si un endpoint las expande, para no depender de una sola forma.
 */
function parseTagIds(value: unknown): string[] | undefined {
  if (value == null) return undefined
  // `transactionFromApiRecord` mezcla el registro crudo, así que si aquí
  // devolviéramos undefined ante un string, ese string llegaría al modelo como
  // `tag_ids` y `.map` reventaría. Por eso se normaliza también el texto.
  let list: unknown[]
  if (Array.isArray(value)) {
    list = value
  } else if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(trimmed)
        list = Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        list = trimmed.split(',')
      }
    } else {
      list = trimmed.split(',')
    }
  } else {
    // Cualquier otra cosa (número, objeto) es basura: se trata como «sin
    // etiquetas» en vez de dejar que el valor crudo sobreviva al merge.
    return []
  }
  const ids = list
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (item && typeof item === 'object') {
        const id = (item as Record<string, unknown>).id
        return id != null ? String(id).trim() : ''
      }
      return ''
    })
    .filter((id) => id !== '')
  return Array.from(new Set(ids))
}

function parseUserDocumentField(
  o: Record<string, unknown>,
  nestedKey: 'document_type' | 'document_number',
  flatKey: 'user_document_type' | 'user_document_number'
): string | null | undefined {
  const nested =
    o.user && typeof o.user === 'object' && !Array.isArray(o.user)
      ? (o.user as Record<string, unknown>)
      : null
  const raw = nested?.[nestedKey] ?? o[flatKey]
  if (raw == null) return nested ? null : undefined
  const text = String(raw).trim()
  return text || null
}

function parseDestinations(value: unknown): TransactionDestination[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.flatMap((item, index) => {
    if (item == null || typeof item !== 'object') return []
    const record = item as Record<string, unknown>
    const bankAccountId = coerceBankAccountId(
      record.bank_account_id ?? record.bank_account ?? record.account_id
    )
    const amount = parseOptionalAmount(record.amount)
    if (!bankAccountId || amount == null) return []
    const bankAccount = parseDestinationAccount(record.bank_account)
    return [{
      id: record.id != null ? String(record.id) : undefined,
      bank_account_id: bankAccountId,
      amount,
      position: Number.isFinite(Number(record.position)) ? Number(record.position) : index,
      ...(bankAccount ? { bank_account: bankAccount } : {})
    }]
  })
}

function parseDestinationAccount(
  value: unknown
): TransactionDestinationAccountSnapshot | undefined {
  if (value == null || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const hasSnapshotFields = [
    'bank_id',
    'account_holder_type',
    'bank_country',
    'account_number',
    'cci_number',
    'pix_key',
    'bank_name'
  ].some((field) => record[field] != null)
  if (!hasSnapshotFields) return undefined
  const optionalString = (field: unknown): string | null | undefined => {
    if (field == null) return field as null | undefined
    return String(field)
  }
  const id = coerceBankAccountId(record.id)
  if (!id) return undefined
  return {
    id,
    bank_id: optionalString(record.bank_id) ?? undefined,
    account_holder_type: optionalString(record.account_holder_type) ?? undefined,
    bank_country: optionalString(record.bank_country) ?? undefined,
    holder_names: optionalString(record.holder_names),
    holder_surnames: optionalString(record.holder_surnames),
    document_number: optionalString(record.document_number),
    business_name: optionalString(record.business_name),
    ruc_number: optionalString(record.ruc_number),
    account_number: optionalString(record.account_number),
    cci_number: optionalString(record.cci_number),
    pix_key: optionalString(record.pix_key),
    cpf: optionalString(record.cpf),
    bank_name: optionalString(record.bank_name),
    bank_currency: optionalString(record.bank_currency)
  }
}

function parseOptionalAmount(v: unknown): number | undefined {
  if (v == null || v === '') return undefined
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : undefined
}

function parseTruthyFlag(v: unknown): boolean {
  if (v === true || v === 'true' || v === 1 || v === '1') return true
  return false
}

export function normalizeAttachmentValues(value: unknown): Array<string | File> {
  if (value == null || value === '') return []
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeAttachmentValues(item))
  }
  if (value instanceof File) return [value]
  if (typeof value === 'string') {
    const s = value.trim()
    return s ? [s] : []
  }
  return []
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

export function attachmentStrings(...vals: unknown[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of normalizeAttachmentValues(vals)) {
    if (typeof item !== 'string') continue
    const s = item.trim()
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
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
export function transactionFromApiRecord(item: Record<string, unknown>): Transaction {
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

export function parseTransaction(item: unknown): Transaction {
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
  const checkedImageValues = attachmentStrings(
    o.checked_image,
    o.checked_images,
    o.checked_image_files,
    o.checkedImage,
    o.checked_image_url,
    o.verification_image,
    o.imagen_verificacion,
    o.checklist_image,
    o.imagen_checklist,
    o.verify_image
  )
  const checked_image = checkedImageValues.length > 1 ? checkedImageValues : checkedImageValues[0]
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
    destinations: parseDestinations(o.destinations),
    user_id: coerceUserId(o.user_id) ?? coerceUserId(o.user),
    user_document_type: parseUserDocumentField(o, 'document_type', 'user_document_type'),
    user_document_number: parseUserDocumentField(o, 'document_number', 'user_document_number'),
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
    social_reason_bank_id: (() => {
      const hasExactField = Object.prototype.hasOwnProperty.call(
        o,
        'social_reason_bank_id'
      )
      const raw = hasExactField ? o.social_reason_bank_id : o.social_reason_bank
      if (raw === null) return null
      return coerceBankAccountId(raw)
    })(),
    send_date: o.send_date != null ? String(o.send_date) : undefined,
    payment_date: o.payment_date != null ? String(o.payment_date) : undefined,
    billing_date: o.billing_date != null ? String(o.billing_date) : undefined,
    send_voucher: (() => {
      const values = attachmentStrings(o.send_voucher, o.send_vouchers, o.send_voucher_files)
      return values.length > 1 ? values : values[0]
    })(),
    payment_voucher: (() => {
      const values = attachmentStrings(o.payment_voucher, o.payment_vouchers, o.payment_voucher_files)
      return values.length > 1 ? values : values[0]
    })(),
    checked_image,
    created_at: o.created_at != null ? String(o.created_at) : undefined,
    created_by: o.created_by != null ? String(o.created_by) : undefined,
    updated_at: o.updated_at != null ? String(o.updated_at) : undefined,
    checked: transactionChecked,
    tag_ids: parseTagIds(o.tag_ids ?? o.tags),
    accounting_percentage: parseOptionalAmount(o.accounting_percentage),
    comision_final_interna: comisionFinalInterna ?? resultado,
    impuesto_final_interno: impuestoFinalInterno,
    venta_final: ventaFinal,
    fecha_emision: fechaEmision,
    observaciones,
    dias_atraso: diasAtraso
  }
}
