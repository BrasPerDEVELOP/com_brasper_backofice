import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import CurrencyRow from "./CurrencyRow";
import CommissionDetails from "./CommissionDetails";
import CouponSection from "./CouponSection";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSync } from "@fortawesome/free-solid-svg-icons";
import testApi from "../../services/apitest";
import { useLocation } from "react-router-dom";
import { useLocale } from "../../context/LocaleProvider";
import "../../styles/calculator.css";

// Constantes globales

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
    image: "/flags/peru.svg",
  },
  {
    code: "BRL",
    name: "Reales Brasileños",
    flag: "🇧🇷",
    image: "/flags/bra.svg",
  },
];

const currencyOptions = {
  PEN: ["BRL", "USD"],
  USD: ["BRL"],
  BRL: ["PEN", "USD"],
};

const getMaxAmount = (from, to) => {
  if (from === "BRL" && to === "PEN") return 6000;
  if (from === "PEN" && to === "BRL") return 20000;
  if (from === "BRL" && to === "USD") return 6000;
  if (from === "USD" && to === "BRL") return 10000;
};

const getMinAmount = (from, to) => {
  if (from === "USD" && to === "BRL") return 30;
  return 100;
};

const TestCalculator = ({ details, updateDetails }) => {
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
  const [finalDifference, setFinalDifference] = useState(0);
  const [exchangeRate, setExchangeRate] = useState(0);
  const [editingReceiveAmount, setEditingReceiveAmount] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [exchangeRates, setExchangeRates] = useState({});
  const [cachedRates, setCachedRates] = useState({});
  const [commissionRates, setCommissionRates] = useState({});

  const [coupons, setCoupons] = useState([]);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [showInput, setShowInput] = useState(true);
  const [couponMessage, setCouponMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [showWhatsAppPreview, setShowWhatsAppPreview] = useState(false);

  const maxAmount = getMaxAmount(fromCurrency, toCurrency);
  const minAmount = getMinAmount(fromCurrency, toCurrency);
  const location = useLocation();

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

  // Funciones para generar el mensaje de WhatsApp
  const generateWhatsAppMessage = () => {
    const localeData = {
      es: {
        template:
          `Perfecto, los detalles de tu envío de Brasper hoy son los siguientes:\n *Monto a Enviar:* {amountSend} {fromCurrency}\n Tipo de Cambio: {exchangeRate}\n *Comisión de envío:* {commission} {fromCurrency}\n Neto a convertir: {totalToSend} {fromCurrency}\n *Total a Recibir:* {amountReceive} {toCurrency}\n \n*Resumo:* Para su envío de *{amountSend} {fromCurrency}*, recibirá directo en su cuenta de destino *{amountReceive} {toCurrency}*`.trim(),
      },
      en: {
        template:
          `Great! Here are the details of your Brasper transfer today\n *Amount to Send:* {amountSend} {fromCurrency}\n Exchange Rate: {exchangeRate}\n *Shipping Commission:* {commission} {fromCurrency}\n Net to Convert: {totalToSend} {fromCurrency}\n *Total to Receive:* {amountReceive} {toCurrency}\n\n *Summary:* For your transfer of *{amountSend} {fromCurrency}*, you will receive directly in your destination account *{amountReceive} {toCurrency}*`.trim(),
      },
      pt: {
        template:
          `Perfeito, os detalhes para seu envio Brasper de hoje é o seguinte:\n *Valor a Enviar:* {amountSend} {fromCurrency}\n Taxa de Câmbio: {exchangeRate}\n *Custo de envio:* {commission} {fromCurrency}\n Neto por converter: {totalToSend} {fromCurrency}\n*Total a Receber:* {amountReceive} {toCurrency}\n\n*Resumo:* Para seu envio de *{amountSend} {fromCurrency}*, chegará direto na sua conta de destino *{amountReceive} {toCurrency}*`.trim(),
      },
    };

    const selected = localeData[locale] || localeData.es;

    return selected.template
      .replace(/{amountSend}/g, amountSend)
      .replace(/{amountReceive}/g, amountReceive)
      .replace(/{fromCurrency}/g, fromCurrency)
      .replace(/{toCurrency}/g, toCurrency)
      .replace(/{exchangeRate}/g, exchangeRate)
      .replace(/{commission}/g, commission)
      .replace(/{totalToSend}/g, totalToSend);
  };

  const handleSendWhatsApp = () => {
    if (!amountSend || !amountReceive || errorMessage) {
      alert("Por favor, complete todos los campos correctamente.");
      return;
    }

    setShowWhatsAppPreview(true);
  };

  // Confirmación se maneja externamente por ahora

  const handleCancelWhatsApp = () => {
    setShowWhatsAppPreview(false);
  };

  const handleCopyMessage = async () => {
    try {
      const message = generateWhatsAppMessage();
      await navigator.clipboard.writeText(message);
      // Mostrar feedback visual temporal
      const originalText = document.querySelector(".copy-btn-text");
      if (originalText) {
        originalText.textContent = "✅ ¡Copiado!";
        setTimeout(() => {
          originalText.textContent = "📋 Copiar Mensaje";
        }, 2000);
      }
    } catch (err) {
      console.error("Error al copiar:", err);
      // Fallback para navegadores que no soportan clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = generateWhatsAppMessage();
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);

      const originalText = document.querySelector(".copy-btn-text");
      if (originalText) {
        originalText.textContent = "✅ ¡Copiado!";
        setTimeout(() => {
          originalText.textContent = "📋 Copiar Mensaje";
        }, 2000);
      }
    }
  };

  // Funciones para Fetch de API de desarrollo
  const fetchCoupons = async () => {
    try {
      const response = await testApi.get("transactions/coupons/");
      setCoupons(response.data);
    } catch (error) {
      console.error("Error fetching coupons:", error);
    }
  };

  // Mantener API auxiliar disponible para otros componentes si se necesita

  // Mantener API auxiliar disponible para otros componentes si se necesita

  const fetchExchangeRates = async () => {
    try {
      const { data } = await testApi.get("coin/exchange-rates/");
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
      const { data } = await testApi.get("coin/commissions/");
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
          min: parseFloat(commissionItem.range_details.min_amount),
          max: parseFloat(commissionItem.range_details.max_amount),
          rate: commissionItem.commission_percentage / 100,
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

  // Función para recargar todas las tasas
  const handleReloadRates = async () => {
    setIsReloading(true);
    try {
      await Promise.all([
        fetchExchangeRates(),
        fetchCommissionRates(),
        fetchCoupons(),
      ]);
      setErrorMessage("");
    } catch (error) {
      console.error("Error al recargar las tasas:", error);
      setErrorMessage("Error al recargar las tasas de cambio.");
    } finally {
      setIsReloading(false);
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

  // Lógica de Cupón
  const handleApplyCoupon = async () => {
    if (!couponCode) {
      setCouponMessage("Por favor, ingresa un código de cupón.");
      setCouponApplied(false);
      return { valid: false };
    }

    setIsLoading(true);
    const currentDate = new Date();

    const foundCoupon = coupons.find(
      (c) => c.code.toUpperCase() === couponCode.toUpperCase()
    );

    if (!foundCoupon) {
      setCouponMessage("❌ Cupón no encontrado.");
      setIsLoading(false);
      setCouponApplied(false);
      return { valid: false };
    }

    if (!foundCoupon.is_active) {
      setCouponMessage("🚫 Este cupón no está activo.");
      setIsLoading(false);
      return { valid: false };
    }

    const startDate = new Date(foundCoupon.start_date);
    const endDate = new Date(foundCoupon.end_date);

    if (currentDate < startDate) {
      setCouponMessage("📅 Este cupón aún no es válido.");
      setIsLoading(false);
      return { valid: false };
    }

    if (currentDate > endDate) {
      setCouponMessage("⏰ Este cupón ya ha expirado.");
      setIsLoading(false);
      return { valid: false };
    }

    if (
      !(
        (foundCoupon.source_currency_code === fromCurrency &&
          foundCoupon.target_currency_code === toCurrency) ||
        (foundCoupon.source_currency_code === toCurrency &&
          foundCoupon.target_currency_code === fromCurrency)
      )
    ) {
      setCouponMessage(
        "⚠️ Este cupón no es válido para esta conversión de moneda."
      );
      setIsLoading(false);
      return { valid: false };
    }

    const discount = parseFloat(foundCoupon.discount_percentage) / 100;
    setCouponDiscount(discount);
    setIsLoading(false);

    if (amountSend) {
      calculate(amountSend, false);
    } else if (amountReceive) {
      calculate(amountReceive, true);
    }
    setCouponApplied(true);

    setCouponMessage("");
    return { valid: true };
  };

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

  // Función de Cálculo
  const calculate = useCallback(
    (amount, isReceiveAmount = false) => {
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
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount)) return;
      let commissionRateValue;
      let amountSendCalc;

      if (isReceiveAmount) {
        // CUANDO EL USUARIO INGRESA "MONTO A RECIBIR"
        // Estimar el monto a enviar considerando el descuento de cupón
        let estimateSend = parsedAmount / rate;
        let iterations = 0;
        while (iterations < 5) {
          const currentRate = calculateCommissionRate(estimateSend, key);
          const effectiveMultiplier = 1 - currentRate * (1 - couponDiscount);
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
          setErrorMessage(
            `El monto debe estar entre ${minAmount} y ${maxAmount}`
          );
          return;
        }

        if (amountSendCalc < 20) {
          setCommission("0");
          setCommissionRateDisplay("0%");
          setTotalToSend(0);
          setExchangeRate(rate.toFixed(2));
          setErrorMessage("El monto mínimo es 20");
          return;
        } else {
          setErrorMessage("");
        }

        // Comisión con el monto final
        commissionRateValue = calculateCommissionRate(amountSendCalc, key);
        setCommissionRateDisplay(`${(commissionRateValue * 100).toFixed(2)}%`);

        // Cálculos sin cupón
        const baseCommissionAmount = amountSendCalc * commissionRateValue;
        setCommissionWithoutCoupon(baseCommissionAmount.toFixed(2));
        const totalToSendWithoutCouponCalc =
          amountSendCalc - baseCommissionAmount;

        // Cálculos con cupón
        const discountedCommission =
          baseCommissionAmount * (1 - couponDiscount);
        const totalToSendCalc = amountSendCalc - discountedCommission;

        // Actualizar estados con cupón
        setCommission(discountedCommission.toFixed(2));
        setTotalToSend(totalToSendCalc.toFixed(2));
        setExchangeRate(rate.toFixed(3));

        // Actualizar estados sin cupón
        setTotalToSendWithoutCoupon(totalToSendWithoutCouponCalc.toFixed(2));

        // Diferencia en la moneda destino
        const receivedWithCoupon = totalToSendCalc * rate;
        const receivedWithoutCoupon = totalToSendWithoutCouponCalc * rate;
        const differenceCalc = receivedWithCoupon - receivedWithoutCoupon;
        setFinalDifference(differenceCalc.toFixed(2));

        // Actualizar el monto a enviar
        setAmountSend(amountSendCalc.toFixed(2));
      } else {
        // CUANDO EL USUARIO INGRESA "MONTO A ENVIAR"
        if (parsedAmount < 20) {
          setCommission("0");
          setCommissionRateDisplay("0%");
          setTotalToSend(0);
          setExchangeRate(rate.toFixed(2));
          setErrorMessage("El monto mínimo es 20");
          return;
        } else {
          if (parsedAmount < minAmount || parsedAmount > maxAmount) {
            setErrorMessage(
              `El monto debe estar entre ${minAmount} y ${maxAmount}`
            );
            setAmountReceive("");
            return;
          }
          setErrorMessage("");
        }

        // Cálculo de comisión sin cupón
        commissionRateValue = calculateCommissionRate(parsedAmount, key);
        setCommissionRateDisplay((commissionRateValue * 100).toFixed(2) + "%");

        const baseCommissionAmount = parsedAmount * commissionRateValue;
        setCommissionWithoutCoupon(baseCommissionAmount.toFixed(2));
        const totalWithoutCoupon = parsedAmount - baseCommissionAmount;

        // Cálculos con cupón
        const discountedCommission =
          baseCommissionAmount * (1 - couponDiscount);
        const total = parsedAmount - discountedCommission;
        const received = total * rate;

        // Actualizar estados con cupón
        setCommission(discountedCommission.toFixed(2));
        setTotalToSend(total.toFixed(2));
        setExchangeRate(rate.toFixed(3));
        setAmountReceive(received.toFixed(2));

        // Actualizar estados sin cupón
        setTotalToSendWithoutCoupon(totalWithoutCoupon.toFixed(2));

        // Monto que se recibiría sin cupón
        const receivedWithoutCoupon = totalWithoutCoupon * rate;

        // La diferencia debe ser en la moneda destino
        const differenceCalc = received - receivedWithoutCoupon;
        setFinalDifference(differenceCalc.toFixed(2));
      }
    },
    [
      fromCurrency,
      toCurrency,
      exchangeRates,
      calculateCommissionRate,
      couponDiscount,
      minAmount,
      maxAmount,
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
  };

  // Actualizar cálculos y detalles según cambios en los montos y monedas
  useEffect(() => {
    if (editingReceiveAmount) {
      if (amountReceive !== "" && !isNaN(parseFloat(amountReceive))) {
        calculate(amountReceive, true);
      } else {
        resetCalculations();
        setAmountSend("");
      }
    } else {
      if (amountSend !== "" && !isNaN(parseFloat(amountSend))) {
        calculate(amountSend);
      } else {
        resetCalculations();
        setAmountReceive("");
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

  const handleAmountChange = (e) => {
    setAmountSend(e.target.value);
    setEditingReceiveAmount(false);
  };

  const handleAmountReceiveChange = (e) => {
    setAmountReceive(e.target.value);
    setEditingReceiveAmount(true);
  };

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

  // Renderizado del componente
  return (
    <div className="bg-white p-4 rounded-xl -z-10">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl text-center font-bold text-blue-600">
          🧪 MODO DESARROLLO
        </h1>
        <button
          onClick={handleReloadRates}
          disabled={isReloading}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors"
          title="Recargar tasas de cambio"
        >
          <FontAwesomeIcon
            icon={faSync}
            className={`${isReloading ? "animate-spin" : ""}`}
          />
          {isReloading ? "Actualizando..." : "Recargar"}
        </button>
      </div>
    
      {errorMessage && (
        <div className="error-message text-red-500">{errorMessage}</div>
      )}
      <CurrencyRow
        title={t.calculator.youSend}
        label="Enviar"
        amount={amountSend}
        onAmountChange={handleAmountChange}
        selectedCurrency={fromCurrency}
        onCurrencyChange={handleFromCurrencyChange}
        allCurrencies={currencies}
        allowedCurrencyKeys={Object.keys(currencyOptions)}
      />
      <CurrencyRow
        title={t.calculator.recipientReceives}
        label="Recibir"
        amount={amountReceive}
        onAmountChange={handleAmountReceiveChange}
        selectedCurrency={toCurrency}
        onCurrencyChange={handleToCurrencyChange}
        allCurrencies={currencies}
        allowedCurrencyKeys={getAvailableToCurrencies()}
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
      {location.pathname != "/" && (
        <CouponSection
          showInput={showInput}
          finalDifference={finalDifference}
          setShowInput={setShowInput}
          couponCode={couponCode}
          details={details}
          setCouponCode={setCouponCode}
          couponMessage={couponMessage}
          handleApplyCoupon={handleApplyCoupon}
          isLoading={isLoading}
          toCurrency={toCurrency}
          couponApplied={couponApplied}
          setCouponApplied={setCouponApplied}
        />
      )}

      <div className="calculator-buttons">
        <button onClick={handleSendWhatsApp} className="theme-btn">
          <span>Enviar por WhatsApp</span>
        </button>
      </div>
      {/* Popup de Preview del Mensaje de WhatsApp */}
      {showWhatsAppPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                📱 Preview del Mensaje de WhatsApp
              </h3>
              <button
                onClick={handleCancelWhatsApp}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-2">
                  <span className="text-white text-sm">📱</span>
                </div>
                <span className="font-semibold text-green-800">WhatsApp</span>
              </div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {generateWhatsAppMessage()}
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleCopyMessage}
                className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <span className="copy-btn-text">📋 Copiar Mensaje</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestCalculator;

TestCalculator.propTypes = {
  details: PropTypes.object,
  updateDetails: PropTypes.func,
};
