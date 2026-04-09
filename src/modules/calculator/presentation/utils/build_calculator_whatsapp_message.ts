import type { CalculatorResult, CurrencyCode } from '../../domain/models'
import { formatCurrency, formatRate } from './calculator_format'

export function buildCalculatorWhatsappMessage(
  result: CalculatorResult,
  currencyFrom: CurrencyCode,
  currencyTo: CurrencyCode,
  language: 'es' | 'pt'
): string {
  const from = currencyFrom.toUpperCase()
  const to = currencyTo.toUpperCase()
  if (language === 'pt') {
    return [
      'Perfeito, os detalhes para seu envio Brasper de hoje e o seguinte:',
      ` *Valor a Enviar:* ${formatCurrency(result.amountSend, currencyFrom)} (${from})`,
      ` Taxa de Cambio: ${formatRate(result.rate)}`,
      ` *Custo de envio:* ${formatCurrency(result.commission, currencyFrom)} (${from})`,
      ` Neto por converter: ${formatCurrency(result.totalToSend, currencyFrom)} (${from})`,
      ` *Total a Receber:* ${formatCurrency(result.amountReceive, currencyTo)} (${to})`,
      `Resumo: Para seu envio de ${formatCurrency(result.amountSend, currencyFrom)} (${from}), chegara direto na sua conta de destino ${formatCurrency(result.amountReceive, currencyTo)} (${to})`
    ].join('\n')
  }

  return [
    'Hola, estos son los detalles de mi envio:',
    ` *Monto a Enviar:* ${formatCurrency(result.amountSend, currencyFrom)} (${from})`,
    ` Tipo de Cambio: ${formatRate(result.rate)}`,
    ` *Comision de envio:* ${formatCurrency(result.commission, currencyFrom)} (${from})`,
    ` Neto a convertir: ${formatCurrency(result.totalToSend, currencyFrom)} (${from})`,
    ` *Total a Recibir:* ${formatCurrency(result.amountReceive, currencyTo)} (${to})`,
    `Resumen: Para su envio de ${formatCurrency(result.amountSend, currencyFrom)} (${from}), recibira directo en su cuenta de destino ${formatCurrency(result.amountReceive, currencyTo)} (${to})`
  ].join('\n')
}
