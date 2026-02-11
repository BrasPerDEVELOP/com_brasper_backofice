import { useState, useEffect, useCallback, useRef } from "react";
import CurrencyRow from "./CurrencyRow";
import CommissionDetails from "./CommissionDetails";
import TermsAndConditions from "./TermsAndConditions";
// import CouponSection from "./CouponSection";
import api from "../../services/api";
import WhatsAppButton from "./WhatsAppButton";
import { useLocation } from "react-router-dom";
import { useLocale } from "../../context/LocaleProvider";
import "../../styles/calculator.css";

// Constantes globales
const API_AUTO_COUPONS_URL =
  "https://pro.brasper.site/api/v1/transactions/coupons/automatic/";

const currencies = [
  {
    code: "PEN",
    name: "Soles Peruanos",
    flag: "🇵🇪",
    image: "/flags/peru.svg",
  },
  {
    code: "USD",
    name: "Dólares Estadounidenses",
    flag: "🇺🇸",
    image: "/flags/peru.svg", // You might want to create usa.svg for consistency
  },
  {
    code: "BRL",
    name: "Reales Brasileños",
    flag: "🇧🇷",
    image: "/flags/bra.svg", // You might want to create bra.svg for consistency
  },
];

const currencyOptions = {
  PEN: ["BRL", "USD"],
  USD: ["BRL"],
  BRL: ["PEN", "USD"],
};

// Normaliza números provenientes de la API con distintos formatos regionales
// Soporta: "1.234,56" (EU), "1,234.56" (US), "1234,56", "1234.56"
const toNumberLocale = (value) => {
  if (value === null || value === undefined) return 0;
  const str = String(value).trim();
  if (str === "") return 0;
  const hasComma = str.includes(",");
  const hasDot = str.includes(".");
  if (hasComma && hasDot) {
    const lastComma = str.lastIndexOf(",");
    const lastDot = str.lastIndexOf(".");
    // El separador decimal suele ser el último símbolo entre coma/punto
    if (lastDot > lastComma) {
      // Formato tipo "1,234.56" → quitar comas (miles), dejar punto (decimal)
      return Number(str.replace(/,/g, ""));
    }
    // Formato tipo "1.234,56" → quitar puntos (miles), convertir coma a punto (decimal)
    return Number(str.replace(/\./g, "").replace(",", "."));
  }
  if (hasComma) {
    // "1234,56" o "1,234" (asumir coma decimal si no hay punto)
    return Number(str.replace(/\./g, "").replace(",", "."));
  }
  // "1234.56" o "1.234" (asumir punto decimal si no hay coma; remover posibles comas residuales)
  return Number(str.replace(/,/g, ""));
};

const getMaxAmount = (from, to) => {
  if (from === "BRL" && to === "PEN") return 30000;
  if (from === "PEN" && to === "BRL") return 35000;
  if (from === "BRL" && to === "USD") return 30000;
  if (from === "USD" && to === "BRL") return 10000;
  //return 10000;
};

const getMinAmount = (from, to) => {
  if (from === "USD" && to === "BRL") return 20;
  return 100;
};

import PropTypes from "prop-types";

const Calculator = ({ updateDetails }) => {
  // Estados y hooks
  const { t, locale } = useLocale();
  const [amountSend, setAmountSend] = useState("");
  const [amountReceive, setAmountReceive] = useState("");
  const [fromCurrency, setFromCurrency] = useState("PEN");
  const [toCurrency, setToCurrency] = useState("BRL");

  const [commission, setCommission] = useState(0);
  const [commissionWithoutCoupon, setCommissionWithoutCoupon] = useState(0);
  const [commissionRateDisplay, setCommissionRateDisplay] = useState(0);
  const [totalToSend, setTotalToSend] = useState(0);
  const [totalToSendWithoutCoupon, setTotalToSendWithoutCoupon] = useState(0);
  const [_finalDifference, setFinalDifference] = useState(0);
  const [exchangeRate, setExchangeRate] = useState(0);
  const [editingReceiveAmount, setEditingReceiveAmount] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [exchangeRates, setExchangeRates] = useState({});
  const [cachedRates, setCachedRates] = useState({});
  const [commissionRates, setCommissionRates] = useState({});

  const [_coupons, setCoupons] = useState([]);
  const [couponDiscount, _setCouponDiscount] = useState(0); // Ejemplo: 0.20 = 20%
  // Descuento forzado por variable (por ejemplo, query param ?discount=15 o env VITE_DEFAULT_DISCOUNT)
  const [variableDiscount, setVariableDiscount] = useState(0);
  // Reglas de cupones automáticos vigentes para el par actual
  const [autoDiscountRules, setAutoDiscountRules] = useState([]);
  // Valor de recibir sin cupón para mostrar diferencia
  const [receiveWithoutCoupon, setReceiveWithoutCoupon] = useState("");
  // Monto a enviar SIN descuento (para mostrar tachado cuando se edita "recibe")
  const [sendWithoutCoupon, setSendWithoutCoupon] = useState("");
  // const [showInput, setShowInput] = useState(true);
  // const [couponMessage, setCouponMessage] = useState("");
  // const [isLoading, setIsLoading] = useState(false);

  const maxAmount = getMaxAmount(fromCurrency, toCurrency);
  const minAmount = getMinAmount(fromCurrency, toCurrency);
  const location = useLocation();
  const prevPairRef = useRef({ from: fromCurrency, to: toCurrency });
  // Hook para detectar escritura
  const useTyping = (value, delay = 1000) => {
    const [isTyping, setIsTyping] = useState(false);
    useEffect(() => {
      if (value) setIsTyping(true);
      const handler = setTimeout(() => setIsTyping(false), delay);
      return () => clearTimeout(handler);
    }, [value, delay]);
    return isTyping;
  };

  const isTypingSend = useTyping(amountSend, 1000);
  const isTypingReceive = useTyping(amountReceive, 1000);
  const isTypingExchangeRate = useTyping(exchangeRate, 1000);

  // Funciones para Fetch de API
  const fetchCoupons = async () => {
    try {
      const response = await api.get("transactions/coupons/");
      setCoupons(response.data);
    } catch (error) {
      console.error("Error fetching coupons:", error);
    }
  };

  // API auxiliar disponible si se requiere en el futuro

  // API auxiliar disponible si se requiere en el futuro

  const fetchExchangeRates = async () => {
    try {
      const { data } = await api.get("coin/exchange-rates/");
      const formattedRates = {};
      data.forEach((rate) => {
        const baseCurrency =
          rate.base_currency === 1
            ? "PEN"
            : rate.base_currency === 2
            ? "BRL"
            : "USD";
        const targetCurrency =
          rate.target_currency === 1
            ? "PEN"
            : rate.target_currency === 2
            ? "BRL"
            : "USD";
        formattedRates[`${baseCurrency}-${targetCurrency}`] = rate.rate;
      });
      setExchangeRates(formattedRates);
      setCachedRates(formattedRates);
    } catch (error) {
      console.error("Error al obtener las tasas de cambio:", error);
      setErrorMessage("Error al cargar las tasas de cambio.");
    }
  };

  const fetchCommissionRates = async () => {
    try {
      const { data } = await api.get("coin/commissions/");
      const formattedCommissionRates = {};
      data.forEach((commissionItem) => {
        const baseCurrency =
          commissionItem.base_currency === 1
            ? "PEN"
            : commissionItem.base_currency === 2
            ? "BRL"
            : "USD";
        const targetCurrency =
          commissionItem.target_currency === 1
            ? "PEN"
            : commissionItem.target_currency === 2
            ? "BRL"
            : "USD";
        const key = `${baseCurrency}-${targetCurrency}`;
        if (!formattedCommissionRates[key]) {
          formattedCommissionRates[key] = [];
        }
        formattedCommissionRates[key].push({
          min: toNumberLocale(commissionItem.range_details.min_amount),
          max: toNumberLocale(commissionItem.range_details.max_amount),
          rate: toNumberLocale(commissionItem.commission_percentage) / 100,
        });
      });
      for (const key in formattedCommissionRates) {
        formattedCommissionRates[key].sort((a, b) => a.min - b.min);
      }
      setCommissionRates(formattedCommissionRates);
    } catch (error) {
      console.error("Error al obtener las tasas de comisión:", error);
      setErrorMessage("Error al cargar las tasas de comisión.");
    }
  };

  // Cargar datos de API al montar el componente
  useEffect(() => {
    fetchCoupons();
    fetchExchangeRates();
    fetchCommissionRates();
  }, []);

  // Actualizar las tasas de cambio cada segundo usando las tasas cacheadas
  useEffect(() => {
    const interval = setInterval(() => {
      setExchangeRates((prevRates) => ({ ...prevRates, ...cachedRates }));
    }, 1000);
    return () => clearInterval(interval);
  }, [cachedRates]);

  const [couponApplied, setCouponApplied] = useState(false);
  // Descuento efectivo: se toma el mayor entre cupón y variable
  const effectiveDiscount = Math.min(
    1,
    Math.max(couponDiscount || 0, variableDiscount || 0)
  );
  // Lógica de Cupón (deshabilitada temporalmente junto al input)
  // const handleApplyCoupon = async (codeFromView) => { /* ... */ };

  // Sincroniza el estado visual (tachado) con el descuento efectivo
  useEffect(() => {
    setCouponApplied(effectiveDiscount > 0);
  }, [effectiveDiscount]);

  // Función para calcular la comisión según el rango
  const calculateCommissionRate = useCallback(
    (amount, currencyPair) => {
      const rates = commissionRates[currencyPair];
      if (!rates) return 0.03;
      for (let i = 0; i < rates.length; i++) {
        const { min, max, rate } = rates[i];
        if (amount >= min && amount <= max) {
          return rate;
        }
      }
      return rates[rates.length - 1].rate;
    },
    [commissionRates]
  );

  // Selecciona el descuento automático aplicable considerando la moneda de mínimo
  const getAutoDiscountFor = useCallback(
    (sendAmount, receiveAmount) => {
      if (!autoDiscountRules.length) return 0;
      const applicable = autoDiscountRules.filter((r) => {
        if (r.minimum_amount == null) return true;
        const minCurrency = r.minimum_amount_currency || fromCurrency;
        if (minCurrency === fromCurrency) {
          return sendAmount >= r.minimum_amount;
        }
        if (minCurrency === toCurrency) {
          return receiveAmount >= r.minimum_amount;
        }
        // Fallback: comparar por envío
        return sendAmount >= r.minimum_amount;
      });
      const maxPct = applicable.reduce(
        (m, r) => Math.max(m, Number(r.discount_percentage || 0)),
        0
      );
      return Math.min(1, Math.max(0, maxPct / 100));
    },
    [autoDiscountRules, fromCurrency, toCurrency]
  );

  // Función de Cálculo
  const calculate = useCallback(
    (amount, isReceiveAmount = false) => {
      const key = `${fromCurrency}-${toCurrency}`;
      const rate = exchangeRates[key];
      if (!rate) {
        setCommission("0");
        setCommissionRateDisplay("0%"); // Changed to string
        setTotalToSend(0);
        setExchangeRate("N/A");
        setErrorMessage("Tipo de cambio no disponible");
        return;
      }
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount)) return;
      let commissionRateValue;
      let amountSendCalc;

      if (isReceiveAmount) {
        // CUANDO EL USUARIO INGRESA "MONTO A RECIBIR"
        // Estimar monto a enviar considerando comisión dependiente del monto y cupón
        let estimateSend = parsedAmount / rate;
        let iterations = 0;
        while (iterations < 5) {
          const currentRate = calculateCommissionRate(estimateSend, key);
          const autoDisc = getAutoDiscountFor(estimateSend, parsedAmount);
          const discount = Math.min(
            1,
            Math.max(couponDiscount || 0, autoDisc || 0)
          );
          const effectiveMultiplier = 1 - currentRate * (1 - discount);
          const nextEstimate = parsedAmount / (rate * effectiveMultiplier);
          if (Math.abs(nextEstimate - estimateSend) < 0.01) {
            estimateSend = nextEstimate;
            break;
          }
          estimateSend = nextEstimate;
          iterations += 1;
        }
        amountSendCalc = estimateSend;

        if (amountSendCalc < minAmount || amountSendCalc > maxAmount) {
          setErrorMessage(`¡Para montos mayores o menores, contáctanos!`);
          return;
        }

        if (amountSendCalc < 20) {
          setCommission("0");
          setCommissionRateDisplay("0%");
          setTotalToSend(0);
          setExchangeRate(rate.toFixed(2));
          setErrorMessage("¡Para montos mayores o menores, contáctanos!");
          return;
        } else {
          setErrorMessage("");
        }

        // Comisión con el monto final
        commissionRateValue = calculateCommissionRate(amountSendCalc, key);
        setCommissionRateDisplay(`${(commissionRateValue * 100).toFixed(2)}%`);
        const autoDiscFinal = getAutoDiscountFor(amountSendCalc, parsedAmount);
        const discountFinal = Math.min(
          1,
          Math.max(couponDiscount || 0, autoDiscFinal || 0)
        );
        setVariableDiscount(autoDiscFinal);
        setCouponApplied(discountFinal > 0);

        // Cálculos sin cupón
        const baseCommissionAmount = amountSendCalc * commissionRateValue;
        // Nota: no establecemos aquí los valores "sin cupón" definitivos porque
        // para comparar con el escenario sin descuento correcto necesitamos
        // el envío requerido SIN descuento (sendWithoutCoupon). Eso se calcula
        // unas líneas más abajo y allí actualizamos los estados "sin cupón".
        // Sin embargo, para mantener la paridad con "envía → recibe" cuando
        // comparamos con el mismo envío, actualizamos también el total sin cupón.
        const totalToSendWithoutCouponCalcSameSend =
          amountSendCalc - baseCommissionAmount;
        setCommissionWithoutCoupon(baseCommissionAmount.toFixed(2));
        setTotalToSendWithoutCoupon(
          totalToSendWithoutCouponCalcSameSend.toFixed(2)
        );

        // Cálculos con cupón
        const discountedCommission = baseCommissionAmount * (1 - discountFinal);
        const totalToSendCalc = amountSendCalc - discountedCommission;

        // Actualizar estados con cupón
        setCommission(discountedCommission.toFixed(2));
        setTotalToSend(totalToSendCalc.toFixed(2));
        setExchangeRate(rate.toFixed(3));

        // Guardar recibido con cupón para comparar luego
        const receivedWithCoupon = totalToSendCalc * rate;
        // Diferencia en moneda destino considerando el MISMO envío:
        // comparar lo que se recibiría sin descuento (mismo envío) vs con descuento
        const receivedWithoutCouponSameSend =
          totalToSendWithoutCouponCalcSameSend * rate;
        const differenceCalcSameSend =
          receivedWithCoupon - receivedWithoutCouponSameSend;
        setFinalDifference(differenceCalcSameSend.toFixed(2));
        setReceiveWithoutCoupon(receivedWithoutCouponSameSend.toFixed(2));

        // Actualizar el monto a enviar
        setAmountSend(amountSendCalc.toFixed(2));

        // Calcular el monto a enviar SIN descuento que lograría el mismo recibido
        let estimateNoDisc = amountSendCalc; // buena semilla
        let iterNoDisc = 0;
        while (iterNoDisc < 10) {
          const rateNoDisc = calculateCommissionRate(estimateNoDisc, key);
          const nextNoDisc = parsedAmount / (rate * (1 - rateNoDisc));
          if (Math.abs(nextNoDisc - estimateNoDisc) < 0.01) {
            estimateNoDisc = nextNoDisc;
            break;
          }
          estimateNoDisc = nextNoDisc;
          iterNoDisc += 1;
        }
        setSendWithoutCoupon(estimateNoDisc.toFixed(2));

        // Con el envío SIN descuento calculado, ahora sí calculamos su comisión
        const commissionRateNoDisc = calculateCommissionRate(
          estimateNoDisc,
          key
        );
        const baseCommissionNoDisc = estimateNoDisc * commissionRateNoDisc;
        const totalToSendWithoutCouponCalc =
          estimateNoDisc - baseCommissionNoDisc;

        // Actualizar estados "sin cupón" basados en sendWithoutCoupon
        setCommissionWithoutCoupon(baseCommissionNoDisc.toFixed(2));
        setTotalToSendWithoutCoupon(totalToSendWithoutCouponCalc.toFixed(2));

        // Nota: no recalculamos aquí finalDifference porque ya se estableció
        // para el caso de MISMO envío (que es el comparativo que mostramos al usuario).
      } else {
        // ----------------------------------------
        // CUANDO EL USUARIO INGRESA "MONTO A ENVIAR"
        // ----------------------------------------
        if (parsedAmount < 20) {
          setCommission("0");
          setCommissionRateDisplay("0%"); // Changed to string
          setTotalToSend(0);
          setExchangeRate(rate.toFixed(2));
          setErrorMessage("¡Para montos mayores o menores, contáctanos!");
          return;
        } else {
          if (parsedAmount < minAmount || parsedAmount > maxAmount) {
            setErrorMessage(`¡Para montos mayores o menores, contáctanos!`);
            setAmountReceive("");
            return;
          }
          setErrorMessage("");
        }

        // Cálculo de comisión sin cupón
        commissionRateValue = calculateCommissionRate(parsedAmount, key);
        setCommissionRateDisplay((commissionRateValue * 100).toFixed(2) + "%");
        // Para el chequeo por moneda destino, estimamos lo que se recibiría SIN descuento
        const receiveNoDiscount =
          (parsedAmount - parsedAmount * commissionRateValue) * rate;
        const autoDisc = getAutoDiscountFor(parsedAmount, receiveNoDiscount);
        const discountToApply = Math.min(
          1,
          Math.max(couponDiscount || 0, autoDisc || 0)
        );
        setVariableDiscount(autoDisc);
        setCouponApplied(discountToApply > 0);

        const baseCommissionAmount = parsedAmount * commissionRateValue;
        setCommissionWithoutCoupon(baseCommissionAmount.toFixed(2));
        const totalWithoutCoupon = parsedAmount - baseCommissionAmount;

        // Cálculos con cupón
        const discountedCommission =
          baseCommissionAmount * (1 - discountToApply);
        const total = parsedAmount - discountedCommission;
        const received = total * rate; // lo que se recibe con cupón

        // Actualizar estados con cupón
        setCommission(discountedCommission.toFixed(2));
        setTotalToSend(total.toFixed(2));
        setExchangeRate(rate.toFixed(3));
        setAmountReceive(received.toFixed(2));

        // Actualizar estados sin cupón
        setTotalToSendWithoutCoupon(totalWithoutCoupon.toFixed(2));

        // -------- CAMBIO IMPORTANTE AQUÍ --------
        // Monto que se recibiría sin cupón
        const receivedWithoutCoupon = totalWithoutCoupon * rate;

        // La diferencia debe ser en la moneda destino (lo que recibe):
        const differenceCalc = received - receivedWithoutCoupon;
        setFinalDifference(differenceCalc.toFixed(2));
        setReceiveWithoutCoupon(receivedWithoutCoupon.toFixed(2));
        // ----------------------------------------
      }
    },
    [
      fromCurrency,
      toCurrency,
      exchangeRates,
      calculateCommissionRate,
      // effectiveDiscount is derived from couponDiscount/variableDiscount, which we set inside calculate
      couponDiscount,
      minAmount,
      maxAmount,
      getAutoDiscountFor,
    ]
  );

  const resetCalculations = () => {
    setCommission("0");
    setCommissionWithoutCoupon("0");
    setCommissionRateDisplay("0%");
    setTotalToSend("0");
    setTotalToSendWithoutCoupon("0");
    setExchangeRate("0");
    setErrorMessage("");
    setSendWithoutCoupon("");
  };

  // Actualizar cálculos y detalles según cambios en los montos y monedas
  useEffect(() => {
    const hasAvailableDiscount =
      couponApplied ||
      autoDiscountRules.length > 0 ||
      (couponDiscount && couponDiscount > 0);

    // Si hay cupón aplicado y estamos editando desde receiveWithoutCoupon,
    // NO ejecutar este useEffect porque el cálculo se hace desde calculateFromReceiveWithoutCoupon
    // Esto evita que los cambios en amountSend/amountReceive (que vienen del cálculo) disparen recálculos
    // IMPORTANTE: Cuando hay cupón, NO ejecutar calculate automáticamente para evitar que los inputs se borren mutuamente
    if (hasAvailableDiscount && !editingReceiveAmount) {
      // NO hacer nada - dejar que calculateFromReceiveWithoutCoupon y los handlers manejen todo
      // Esto evita que cuando el usuario borra en un input, el otro se borre también
      return;
    }

    // Comportamiento normal cuando NO hay cupón
    if (editingReceiveAmount) {
      if (amountReceive !== "" && !isNaN(parseFloat(amountReceive))) {
        calculate(amountReceive, true);
      } else {
        resetCalculations();
        // Solo resetear amountSend si NO hay cupón
        if (!hasAvailableDiscount) {
          setAmountSend("");
        }
      }
    } else {
      if (amountSend !== "" && !isNaN(parseFloat(amountSend))) {
        calculate(amountSend);
      } else {
        resetCalculations();
        // Solo resetear amountReceive si NO hay cupón
        if (!hasAvailableDiscount) {
          setAmountReceive("");
        }
      }
    }
  }, [
    amountSend,
    amountReceive,
    fromCurrency,
    toCurrency,
    editingReceiveAmount,
    exchangeRates,
    calculate,
    couponApplied,
    autoDiscountRules,
    couponDiscount,
    receiveWithoutCoupon,
  ]);

  useEffect(() => {
    if (isTypingSend && !isNaN(parseFloat(amountSend))) {
      updateDetails?.({
        key: "sendAmount",
        value: amountSend,
        currency: fromCurrency,
      });
    }
    if (isTypingReceive && !isNaN(parseFloat(amountReceive))) {
      updateDetails?.({
        key: "receiveAmount",
        value: amountReceive,
        currency: toCurrency,
      });
    }
  }, [
    isTypingSend,
    isTypingReceive,
    amountSend,
    amountReceive,
    fromCurrency,
    toCurrency,
    updateDetails,
  ]);

  useEffect(() => {
    if (isTypingExchangeRate && exchangeRate) {
      updateDetails?.({ key: "exchangeRate", value: exchangeRate });
      updateDetails?.({ key: "totalToSend", value: totalToSend });
      updateDetails?.({ key: "commission", value: commission });
    }
  }, [
    isTypingExchangeRate,
    exchangeRate,
    totalToSend,
    commission,
    updateDetails,
  ]);

  // Recalcula cuando cambia el descuento del cupón para evitar usar un estado obsoleto
  useEffect(() => {
    if (!effectiveDiscount && !couponApplied) return;

    // Si hay descuentos disponibles y estamos editando desde receiveWithoutCoupon, no ejecutar
    const hasAvailableDiscount =
      couponApplied ||
      autoDiscountRules.length > 0 ||
      (couponDiscount && couponDiscount > 0);
    if (hasAvailableDiscount && !editingReceiveAmount) {
      return; // El cálculo se hace desde calculateFromReceiveWithoutCoupon
    }

    if (editingReceiveAmount) {
      if (amountReceive !== "" && !isNaN(parseFloat(amountReceive))) {
        calculate(amountReceive, true);
      }
    } else {
      if (amountSend !== "" && !isNaN(parseFloat(amountSend))) {
        calculate(amountSend);
      }
    }
  }, [
    effectiveDiscount,
    couponApplied,
    editingReceiveAmount,
    amountSend,
    amountReceive,
    calculate,
    autoDiscountRules,
    couponDiscount,
  ]);

  // Lee descuento automático desde backend y mantiene reglas filtradas por par y fechas
  useEffect(() => {
    let cancelled = false;
    const fetchAutoDiscount = async () => {
      let data = [];
      try {
        const resp = await api.get(API_AUTO_COUPONS_URL);
        data = Array.isArray(resp.data) ? resp.data : [];
      } catch {
        data = [];
      }

      const now = new Date();
      const parseDate = (v) => (v ? new Date(v) : null);
      const normalizeCode = (codeOrId, isSource) => {
        if (typeof codeOrId === "string") return codeOrId;
        if (codeOrId === 1) return "PEN";
        if (codeOrId === 2) return "BRL";
        if (codeOrId === 3) return "USD";
        return isSource ? fromCurrency : toCurrency;
      };
      const normalizeCodeLoose = (codeOrId, fallbackCode) => {
        if (typeof codeOrId === "string") return codeOrId;
        if (codeOrId === 1) return "PEN";
        if (codeOrId === 2) return "BRL";
        if (codeOrId === 3) return "USD";
        return fallbackCode;
      };

      const candidates = data
        .filter((c) => !c?.type || String(c.type).toLowerCase() === "automatic")
        .filter((c) => c?.is_active !== false)
        .filter((c) => {
          const start = parseDate(c.start_date);
          const end = parseDate(c.end_date);
          const startOk = start ? start <= now : true;
          const endOk = end ? now <= end : true;
          return startOk && endOk;
        })
        .filter((c) => {
          const src = normalizeCode(
            c.source_currency_code ?? c.source_currency,
            true
          );
          const dst = normalizeCode(
            c.target_currency_code ?? c.target_currency,
            false
          );
          // Se exige dirección exacta: origen -> destino
          return src === fromCurrency && dst === toCurrency;
        })
        .map((c) => ({
          minimum_amount:
            c.minimum_amount === null || c.minimum_amount === undefined
              ? null
              : Number(String(c.minimum_amount).replace(",", ".")),
          // Si backend provee moneda del mínimo, la guardamos para validar en la moneda correcta
          minimum_amount_currency: normalizeCodeLoose(
            c.minimum_amount_currency ??
              c.min_amount_currency ??
              c.amount_currency ??
              null,
            fromCurrency
          ),
          discount_percentage: Number(
            String(c.discount_percentage ?? 0).replace(",", ".")
          ),
        }));

      if (!cancelled) setAutoDiscountRules(candidates);
    };

    fetchAutoDiscount();
    return () => {
      cancelled = true;
    };
  }, [fromCurrency, toCurrency]);

  const handleAmountChange = (e) => {
    const value = e.target.value;
    const hasAvailableDiscount =
      couponApplied ||
      autoDiscountRules.length > 0 ||
      (couponDiscount && couponDiscount > 0);

    setAmountSend(value);
    setEditingReceiveAmount(false);

    if (hasAvailableDiscount) {
      // Si hay cupón y el usuario borra amountSend, NO resetear receiveWithoutCoupon ni amountReceive
      if (value === "") {
        // Solo limpiar los cálculos, pero NO tocar receiveWithoutCoupon ni amountReceive
        setCommission("0");
        setCommissionWithoutCoupon("0");
        setCommissionRateDisplay("0%");
        setTotalToSend("0");
        setTotalToSendWithoutCoupon("0");
        setExchangeRate("0");
        setErrorMessage("");
        setFinalDifference("0");
        // NO resetear amountReceive ni receiveWithoutCoupon - dejar que el usuario los edite independientemente
      } else if (value !== "" && !isNaN(parseFloat(value))) {
        // Si hay un valor válido, calcular normalmente (esto actualizará receiveWithoutCoupon y amountReceive)
        calculate(value);
      }
    }
    // Si no hay cupón, el useEffect se encargará del cálculo
  };

  const handleAmountReceiveChange = (e) => {
    const value = e.target.value;
    // Si hay cupón aplicado o hay descuentos disponibles, el input es para el monto sin descuento
    const hasAvailableDiscount =
      couponApplied ||
      autoDiscountRules.length > 0 ||
      (couponDiscount && couponDiscount > 0);

    if (hasAvailableDiscount) {
      // En modo descuento: el monto ingresado es el que el destinatario quiere RECIBIR con descuento aplicado
      setAmountReceive(value);
      setEditingReceiveAmount(true);

      if (value !== "" && !isNaN(parseFloat(value))) {
        // Calcular resolviendo el envío necesario para alcanzar ese recibido con descuento
        calculate(value, true);
      } else {
        // Si está vacío, limpiar cálculos dependientes pero NO tocar amountSend
        setCommission("0");
        setCommissionWithoutCoupon("0");
        setCommissionRateDisplay("0%");
        setTotalToSend("0");
        setTotalToSendWithoutCoupon("0");
        setExchangeRate("0");
        setErrorMessage("");
        setFinalDifference("0");
        setSendWithoutCoupon("");
      }
    } else {
      // Sin cupón, comportamiento normal
      setAmountReceive(value);
      setEditingReceiveAmount(true);
    }
  };

  // Función que calcula desde el monto sin descuento
  const _calculateFromReceiveWithoutCoupon = useCallback(
    (receiveWithoutCouponValue) => {
      const key = `${fromCurrency}-${toCurrency}`;
      const rate = exchangeRates[key];
      if (!rate) {
        setCommission("0");
        setCommissionRateDisplay("0%");
        setTotalToSend(0);
        setExchangeRate("N/A");
        setErrorMessage("Tipo de cambio no disponible");
        return;
      }
      const parsedReceiveWithoutCoupon = parseFloat(receiveWithoutCouponValue);
      if (isNaN(parsedReceiveWithoutCoupon)) return;

      // Calcular cuánto debe enviar para recibir ese monto sin descuento
      // receiveWithoutCoupon = (amountSend - commissionWithoutCoupon) * rate
      let estimateSend = parsedReceiveWithoutCoupon / rate;
      let iterations = 0;
      while (iterations < 10) {
        const currentRate = calculateCommissionRate(estimateSend, key);
        const baseCommissionAmount = estimateSend * currentRate;
        const totalWithoutCoupon = estimateSend - baseCommissionAmount;
        const receivedWithoutCoupon = totalWithoutCoupon * rate;

        if (
          Math.abs(receivedWithoutCoupon - parsedReceiveWithoutCoupon) < 0.01
        ) {
          break;
        }
        // Ajustar estimación
        estimateSend = parsedReceiveWithoutCoupon / (rate * (1 - currentRate));
        iterations++;
      }

      if (estimateSend < minAmount || estimateSend > maxAmount) {
        setErrorMessage(`¡Para montos mayores o menores, contáctanos!`);
        setAmountReceive("");
        return;
      }

      if (estimateSend < 20) {
        setCommission("0");
        setCommissionRateDisplay("0%");
        setTotalToSend(0);
        setExchangeRate(rate.toFixed(2));
        setErrorMessage("¡Para montos mayores o menores, contáctanos!");
        return;
      } else {
        setErrorMessage("");
      }

      // Calcular comisión sin cupón
      const commissionRateValue = calculateCommissionRate(estimateSend, key);
      setCommissionRateDisplay((commissionRateValue * 100).toFixed(2) + "%");

      // Para evaluar por moneda destino, calculamos lo que se recibiría SIN descuento
      const receiveNoDiscount =
        (estimateSend - estimateSend * commissionRateValue) * rate;
      const autoDisc = getAutoDiscountFor(estimateSend, receiveNoDiscount);

      const discountToApply = Math.min(
        1,
        Math.max(couponDiscount || 0, autoDisc || 0)
      );
      setVariableDiscount(autoDisc);
      setCouponApplied(discountToApply > 0);

      const baseCommissionAmount = estimateSend * commissionRateValue;
      setCommissionWithoutCoupon(baseCommissionAmount.toFixed(2));
      const totalWithoutCoupon = estimateSend - baseCommissionAmount;

      // Cálculos con cupón
      const discountedCommission = baseCommissionAmount * (1 - discountToApply);
      const total = estimateSend - discountedCommission;
      const received = total * rate; // lo que se recibe con cupón

      // Actualizar estados con cupón
      setCommission(discountedCommission.toFixed(2));
      setTotalToSend(total.toFixed(2));
      setExchangeRate(rate.toFixed(3));
      setAmountReceive(received.toFixed(2));
      setAmountSend(estimateSend.toFixed(2));

      // Actualizar estados sin cupón
      setTotalToSendWithoutCoupon(totalWithoutCoupon.toFixed(2));

      // Diferencia
      const differenceCalc = received - parsedReceiveWithoutCoupon;
      setFinalDifference(differenceCalc.toFixed(2));
    },
    [
      fromCurrency,
      toCurrency,
      exchangeRates,
      calculateCommissionRate,
      couponDiscount,
      minAmount,
      maxAmount,
      getAutoDiscountFor,
    ]
  );

  // Recalcular cuando cambia el par de monedas: usar el campo activo (recibe o envía)
  useEffect(() => {
    const prev = prevPairRef.current;
    const changed = prev.from !== fromCurrency || prev.to !== toCurrency;
    if (!changed) return;
    prevPairRef.current = { from: fromCurrency, to: toCurrency };

    if (
      editingReceiveAmount &&
      amountReceive !== "" &&
      !isNaN(parseFloat(amountReceive))
    ) {
      calculate(amountReceive, true);
    } else if (amountSend !== "" && !isNaN(parseFloat(amountSend))) {
      calculate(amountSend);
    } else {
      resetCalculations();
      setAmountReceive("");
      setReceiveWithoutCoupon("");
      setSendWithoutCoupon("");
    }
  }, [
    fromCurrency,
    toCurrency,
    amountSend,
    amountReceive,
    editingReceiveAmount,
    calculate,
  ]);

  const handleFromCurrencyChange = (newValue) => {
    const newFromCurrency = newValue.value;
    setFromCurrency(newFromCurrency);
    const newToCurrencies = currencyOptions[newFromCurrency];
    if (!newToCurrencies.includes(toCurrency)) {
      setToCurrency(newToCurrencies[0]);
    }
  };

  const handleToCurrencyChange = (newValue) => {
    setToCurrency(newValue.value);
  };

  const getAvailableToCurrencies = () => {
    return currencyOptions[fromCurrency] || [];
  };

  // Descuento disponible para render
  const hasAvailableDiscount =
    couponApplied ||
    autoDiscountRules.length > 0 ||
    (couponDiscount && couponDiscount > 0);

  // Mensajes de WhatsApp según idioma para cantidades fuera de rango
  const getWhatsAppMessage = () => {
    const messages = {
      es: "Hola, estas a punto de comenzar una nueva experiencia! \n¡Ven con nosotros y sé parte de Brasper Transferências!",
      pt: "Hola, estas a punto de comenzar una nueva experiencia! \n¡Ven con nosotros y sé parte de Brasper Transferências!",
      en: "Hello, are you ready to start a new experience!  \nCome with us and be part of Brasper Transferencias! ✨🇵🇪🇧🇷",
    };
    return messages[locale] || messages.es;
  };

  const getWhatsAppLink = () => {
    const phoneNumber = "51966991933";
    const message = getWhatsAppMessage();
    const encoded = encodeURIComponent(message);
    return `https://wa.me/${phoneNumber}?text=${encoded}`;
  };

  // Renderizado del componente
  return (
    <div className="bg-white p-4 rounded-xl -z-10">
      {" "}
      <div className="flex items-center justify-center gap-3 mb-4">
        <img src="/logo.png" alt="Logo" className="w-10 h-10" />
        <h1 className="text-xl font-bold">{t.calculator.shipmentTitle}</h1>
      </div>
      {errorMessage && (
        <a
          href={getWhatsAppLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <div className="error-message text-center text-red-500 cursor-pointer hover:underline">
            {errorMessage}
          </div>
        </a>
      )}
      <CurrencyRow
        title={t.calculator.youSend}
        label={t.calculator.send}
        amount={amountSend}
        onAmountChange={handleAmountChange}
        selectedCurrency={fromCurrency}
        onCurrencyChange={handleFromCurrencyChange}
        allCurrencies={currencies}
        allowedCurrencyKeys={Object.keys(currencyOptions)}
        originalAmount={
          editingReceiveAmount && hasAvailableDiscount
            ? sendWithoutCoupon ?? ""
            : null
        }
        badgeText={
          editingReceiveAmount && couponApplied ? "(Cyber Wow)" : undefined
        }
        highlight={editingReceiveAmount && couponApplied}
      />
      <CurrencyRow
        title={t.calculator.recipientReceives}
        label={t.calculator.receive}
        amount={amountReceive}
        onAmountChange={handleAmountReceiveChange}
        selectedCurrency={toCurrency}
        onCurrencyChange={handleToCurrencyChange}
        allCurrencies={currencies}
        allowedCurrencyKeys={getAvailableToCurrencies()}
        originalAmount={
          hasAvailableDiscount && !editingReceiveAmount
            ? receiveWithoutCoupon ?? ""
            : null
        }
        badgeText={
          !editingReceiveAmount && couponApplied ? "(Cyber Wow)" : undefined
        }
        highlight={!editingReceiveAmount && couponApplied}
      />
      <CommissionDetails
        commissionRateDisplay={commissionRateDisplay}
        commission={commission}
        commissionWithoutCoupon={commissionWithoutCoupon}
        totalToSend={totalToSend}
        totalToSendWithoutCoupon={totalToSendWithoutCoupon}
        exchangeRate={exchangeRate}
        updateDetails={(data) => updateDetails?.(data)}
        couponApplied={couponApplied}
      />
      {couponApplied && Number(_finalDifference) > 0 && (
        <h3 className="font-semibold mb-3 text-blue-600 text-center">
          {t.calculator.promo1} {Number(_finalDifference).toFixed(2)}{" "}
          {toCurrency} {t.calculator.promo2}
        </h3>
      )}
      {/**
       * Cupón temporalmente deshabilitado
       * <CouponSection
       *   showInput={showInput}
       *   finalDifference={finalDifference}
       *   setShowInput={setShowInput}
       *   couponCode={couponCode}
       *   details={details}
       *   setCouponCode={setCouponCode}
       *   couponMessage={couponMessage}
       *   handleApplyCoupon={handleApplyCoupon}
       *   isLoading={isLoading}
       *   toCurrency={toCurrency}
       *   couponApplied={couponApplied}
       *   setCouponApplied={setCouponApplied}
       * />
       */}
      <div className="calculator-buttons">
        {/*<SendButton nextStep={nextStep} />*/}
        {location.pathname === "/" && (
          <WhatsAppButton
            amountSend={amountSend}
            amountReceive={amountReceive}
            fromCurrency={fromCurrency}
            toCurrency={toCurrency}
            currencies={currencies}
            exchangeRate={exchangeRate}
            commission={commission}
            totalToSend={totalToSend}
            errorMessage={errorMessage}
            totalToSendWithoutCoupon={totalToSendWithoutCoupon}
            originalAmount={receiveWithoutCoupon}
            commissionWithoutCoupon={commissionWithoutCoupon}
          />
        )}
      </div>
      <TermsAndConditions />
    </div>
  );
};

export default Calculator;

Calculator.propTypes = {
  details: PropTypes.object,
  updateDetails: PropTypes.func,
};
