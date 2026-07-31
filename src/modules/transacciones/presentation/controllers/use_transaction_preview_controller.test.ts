import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useTransactionPreviewController } from "./use_transaction_preview_controller";
import type { Transaction } from "../../domain/models";
import { useCuentasBancariasStore } from "@modules/cuentas-bancarias/presentation/controllers/use_cuentas_bancarias_store_controller";

describe("useTransactionPreviewController.buildPreviewSections", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const baseTransaction = {
    id: "t-1",
    code: "PxB-0061",
    status: "verified",
    checked: true,
    origin_amount: 10,
    destination_amount: 12.35,
    operation_number: "123",
    destinations: [
      { bank_account_id: "acc-1", amount: 12.35, position: 0 },
    ],
    bank_id: "bank-1",
    bank_name: "Banco do Brasil - 001",
    company_name: "BRASPER 21",
    social_reason_bank_id: "srb-1",
    send_vouchers: ["transaction_vouchers/send_a.webp"],
    payment_vouchers: [],
    checked_images: ["transaction_vouchers/checked_b.webp"],
    send_voucher: "transaction_vouchers/send_a.webp",
    checked_image: "transaction_vouchers/checked_b.webp",
  } as unknown as Transaction;

  it("incluye el número de operación en el resumen", () => {
    const { buildPreviewSections } = useTransactionPreviewController();
    const sections = buildPreviewSections(baseTransaction);
    const resumen = sections.find((section) => section.id === "resumen");
    expect(
      resumen?.items.find((item) => item.label === "N.º operación")?.value,
    ).toBe("123");
  });

  it("no repite en Otros campos datos ya representados (vouchers, destinos, banco)", () => {
    const { buildPreviewSections } = useTransactionPreviewController();
    const sections = buildPreviewSections(baseTransaction);
    const extra = sections.find((section) => section.id === "extra");
    expect(extra).toBeUndefined();
  });

  it("estructura las cuentas destino con monto y porcentaje del total", () => {
    const { buildPreviewDestinations } = useTransactionPreviewController();
    const summary = buildPreviewDestinations({
      ...(baseTransaction as Record<string, unknown>),
      destination_amount: 100,
      destinations: [
        { bank_account_id: "acc-1", amount: 25, position: 0 },
        { bank_account_id: "acc-2", amount: 75, position: 1 },
      ],
    } as unknown as Transaction);
    expect(summary.rows).toHaveLength(2);
    expect(summary.rows[0]?.shareLabel).toBe("25%");
    expect(summary.rows[1]?.shareLabel).toBe("75%");
    // Sin catálogo cargado, el titular cae a "—" pero la fila existe igual.
    expect(summary.rows[0]?.holderLabel).toBe("—");
    expect(summary.rows[0]?.amountLabel).toBeTruthy();
  });

  it("con una sola cuenta no muestra porcentaje y cae a la cuenta destino legacy", () => {
    const { buildPreviewDestinations } = useTransactionPreviewController();
    const summary = buildPreviewDestinations({
      ...(baseTransaction as Record<string, unknown>),
      destinations: undefined,
      bank_account_destination_id: "acc-legacy",
    } as unknown as Transaction);
    expect(summary.rows).toHaveLength(1);
    expect(summary.rows[0]?.shareLabel).toBeNull();
    expect(summary.rows[0]?.bankLabel).toBe("acc-legacy");
  });

  it("expone cuenta, CCI y PIX completos como identificadores separados", () => {
    const cuentasStore = useCuentasBancariasStore();
    cuentasStore.bankAccounts = [{
      id: "acc-1",
      bank_id: "bank-1",
      account_number: "001108310200148558",
      cci_number: "01183100020014855899",
      pix_key: "10066160987",
      holder_names: "Washington",
      holder_surnames: "Luiz",
    } as never];
    cuentasStore.banks = [{ id: "bank-1", bank: "BBVA", currency: "PEN" } as never];

    const { buildPreviewDestinations } = useTransactionPreviewController();
    const summary = buildPreviewDestinations(baseTransaction);

    expect(summary.rows[0]?.identifiers).toEqual([
      { label: "Cuenta", value: "001108310200148558" },
      { label: "CCI", value: "01183100020014855899" },
      { label: "PIX", value: "10066160987" },
    ]);
  });

  it("conserva Otros campos para claves realmente desconocidas", () => {
    const { buildPreviewSections } = useTransactionPreviewController();
    const sections = buildPreviewSections({
      ...(baseTransaction as Record<string, unknown>),
      campo_nuevo_api: "valor",
    } as unknown as Transaction);
    const extra = sections.find((section) => section.id === "extra");
    expect(extra?.items).toEqual([
      expect.objectContaining({ label: "campo_nuevo_api", value: "valor" }),
    ]);
  });
});
