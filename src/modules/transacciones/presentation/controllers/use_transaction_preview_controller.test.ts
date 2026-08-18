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
    // Sin la cuenta en los catálogos, la etiqueta sale del snapshot `bank_name`
    // de la transacción; el id nunca se muestra como nombre de banco.
    expect(summary.rows[0]?.bankLabel).toBe("Banco do Brasil - 001");
    expect(summary.rows[0]?.bankLabel).not.toBe("acc-legacy");
  });

  it("expone cuenta, CCI y PIX completos como identificadores separados", () => {
    const cuentasStore = useCuentasBancariasStore();
    cuentasStore.bankAccounts = [{
      id: "acc-1",
      bank_id: "bank-1",
      account_number: "001108310200148558",
      cci_number: "01183100020014855899",
      pix_key: "10066160987",
      document_number: "75425055",
      account_holder_type: "natural",
      bank_country: "pe",
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
      { label: "DNI", value: "75425055" },
    ]);
  });

  it("identifica RUC, CPF y CNPJ según el tipo y país de la cuenta", () => {
    const cuentasStore = useCuentasBancariasStore();
    cuentasStore.bankAccounts = [
      {
        id: "ruc",
        bank_id: "bank-1",
        account_holder_type: "juridica",
        bank_country: "pe",
        ruc_number: "20123456789",
      },
      {
        id: "cpf",
        bank_id: "bank-1",
        account_holder_type: "natural",
        bank_country: "br",
        cpf: "12345678901",
      },
      {
        id: "cnpj",
        bank_id: "bank-1",
        account_holder_type: "legal",
        bank_country: "br",
        ruc_number: "12345678000199",
      },
    ] as never;

    const { buildPreviewDestinations } = useTransactionPreviewController();
    const summary = buildPreviewDestinations({
      ...(baseTransaction as Record<string, unknown>),
      destination_amount: 30,
      destinations: ["ruc", "cpf", "cnpj"].map((bank_account_id) => ({
        bank_account_id,
        amount: 10,
      })),
    } as unknown as Transaction);

    expect(summary.rows.map((row) => row.identifiers.at(-1))).toEqual([
      { label: "RUC", value: "20123456789" },
      { label: "CPF", value: "12345678901" },
      { label: "CNPJ", value: "12345678000199" },
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

  describe("cuentas que este operador no tiene en sus catálogos", () => {
    it("usa el bank_name de la transacción en vez de mostrar el UUID de la cuenta", () => {
      // Escenario real: la fila llegó por WebSocket a un operador que nunca
      // cargó esa cuenta, así que `bankAccounts` está vacío.
      const { buildPreviewDestinations } = useTransactionPreviewController();
      const summary = buildPreviewDestinations({
        ...(baseTransaction as Record<string, unknown>),
        destination_amount: 500,
        destinations: [],
        bank_account_destination_id: "c5ad991e-0010-4788-bdbe-6ad1a3ec1a9b",
        bank_name: "C.C.P.Vale do Itajaí e Lit.Catarinense",
      } as unknown as Transaction);

      expect(summary.rows.length).toBe(1);
      expect(summary.rows[0].bankLabel).toBe(
        "C.C.P.Vale do Itajaí e Lit.Catarinense",
      );
      expect(summary.rows[0].bankLabel).not.toContain("c5ad991e");
    });

    it("nunca muestra un UUID: sin snapshot ni catálogo cae en raya", () => {
      const { buildPreviewDestinations } = useTransactionPreviewController();
      const summary = buildPreviewDestinations({
        ...(baseTransaction as Record<string, unknown>),
        destination_amount: 500,
        destinations: [],
        bank_account_destination_id: "c5ad991e-0010-4788-bdbe-6ad1a3ec1a9b",
        bank_name: null,
      } as unknown as Transaction);

      expect(summary.rows[0].bankLabel).toBe("—");
    });

    it("no usa el snapshot cuando hay reparto entre varias cuentas", () => {
      // El snapshot describe una sola cuenta destino: aplicarlo a un reparto
      // etiquetaría cuentas distintas con el mismo banco.
      const { buildPreviewDestinations } = useTransactionPreviewController();
      const summary = buildPreviewDestinations({
        ...(baseTransaction as Record<string, unknown>),
        destination_amount: 500,
        destinations: [
          { bank_account_id: "acc-x", amount: 300, position: 0 },
          { bank_account_id: "acc-y", amount: 200, position: 1 },
        ],
        bank_name: "Banco del snapshot",
      } as unknown as Transaction);

      expect(summary.rows.length).toBe(2);
      for (const row of summary.rows) {
        expect(row.bankLabel).not.toBe("Banco del snapshot");
      }
    });

    it("prefiere la cuenta real del catálogo cuando sí está cargada", () => {
      const cuentasStore = useCuentasBancariasStore();
      cuentasStore.bankAccounts = [
        { id: "acc-real", bank_id: "bank-1", account_number: "123-456" },
      ] as never;
      cuentasStore.banks = [
        { id: "bank-1", bank: "Nubank", currency: "BRL", company: "BRASPER" },
      ] as never;

      const { buildPreviewDestinations } = useTransactionPreviewController();
      const summary = buildPreviewDestinations({
        ...(baseTransaction as Record<string, unknown>),
        destination_amount: 500,
        destinations: [],
        bank_account_destination_id: "acc-real",
        bank_name: "Nombre viejo del snapshot",
      } as unknown as Transaction);

      expect(summary.rows[0].bankLabel).not.toBe("Nombre viejo del snapshot");
    });
  });
});
