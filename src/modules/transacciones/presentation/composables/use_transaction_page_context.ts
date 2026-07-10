/**
 * Fase C1 (H3) — Facade multi-store para `transacciones_view`.
 *
 * Encapsula la instanciación de los stores de dominio que la vista de
 * transacciones orquesta (transacciones, cuentas, tasas, comisiones,
 * calculadora), para reducir el acoplamiento directo de la vista a múltiples
 * stores ajenos. No cambia comportamiento: son las mismas instancias Pinia.
 *
 * El store de auth se mantiene aparte (los permisos son transversales).
 */
import { useTransactionsStore } from '../controllers/use_transactions_store_controller'
import { useCuentasBancariasStore } from '@modules/cuentas-bancarias/presentation/controllers/use_cuentas_bancarias_store_controller'
import { useTasasStore } from '@modules/tasas/presentation/controllers/use_tasas_store_controller'
import { useComisionesStore } from '@modules/comisiones/presentation/controllers/use_comisiones_store_controller'
import { useCalculatorStore } from '@modules/calculator/presentation/controllers/use_calculator_store_controller'

export function useTransactionPageContext() {
  const transactionsStore = useTransactionsStore()
  const cuentasStore = useCuentasBancariasStore()
  const tasasStore = useTasasStore()
  const comisionesStore = useComisionesStore()
  const calculatorStore = useCalculatorStore()

  return {
    transactionsStore,
    cuentasStore,
    tasasStore,
    comisionesStore,
    calculatorStore
  }
}
