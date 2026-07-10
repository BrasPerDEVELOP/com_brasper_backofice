import { describe, it, expect } from 'vitest'
import {
  getTransactionStatusLabel,
  getTransactionStatusRowBadgeClass,
  useTransactionStatusLabels
} from './use_transaction_status_labels'

describe('getTransactionStatusLabel', () => {
  it('devuelve "-" cuando no hay estado', () => {
    expect(getTransactionStatusLabel(undefined)).toBe('-')
    expect(getTransactionStatusLabel('')).toBe('-')
  })

  it('traduce estados conocidos al label del dominio', () => {
    expect(getTransactionStatusLabel('completed')).toBe('Finalizada')
    expect(getTransactionStatusLabel('verified')).toBe('Verificado')
  })

  it('normaliza el estado antes de buscar el label (case-insensitive)', () => {
    expect(getTransactionStatusLabel('COMPLETED')).toBe('Finalizada')
  })

  it('devuelve el estado crudo si no está en el catálogo', () => {
    expect(getTransactionStatusLabel('estado_desconocido')).toBe('estado_desconocido')
  })
})

describe('getTransactionStatusRowBadgeClass', () => {
  it('mapea cada estado a sus clases de badge', () => {
    expect(getTransactionStatusRowBadgeClass('pending')).toContain('amber')
    expect(getTransactionStatusRowBadgeClass('verification')).toContain('amber')
    expect(getTransactionStatusRowBadgeClass('verified')).toContain('violet')
    expect(getTransactionStatusRowBadgeClass('completed')).toContain('emerald')
    expect(getTransactionStatusRowBadgeClass('failed')).toContain('red')
    expect(getTransactionStatusRowBadgeClass('checked')).toContain('sky')
    expect(getTransactionStatusRowBadgeClass('cancelled')).toContain('gray')
  })

  it('usa el badge por defecto para estados desconocidos o vacíos', () => {
    expect(getTransactionStatusRowBadgeClass('otro')).toContain('brasper-indigoDark')
    expect(getTransactionStatusRowBadgeClass(undefined)).toContain('brasper-indigoDark')
  })
})

describe('useTransactionStatusLabels', () => {
  it('expone los helpers puros', () => {
    const { getStatusLabel, statusRowBadgeClass } = useTransactionStatusLabels()
    expect(getStatusLabel('completed')).toBe('Finalizada')
    expect(statusRowBadgeClass('completed')).toContain('emerald')
  })
})
