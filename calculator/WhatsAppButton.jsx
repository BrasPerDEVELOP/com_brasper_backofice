import React from "react";
import Notiflix from "notiflix";
import { useLocale } from "@/context/LocaleProvider";
import { FaWhatsapp } from "react-icons/fa";
const WhatsAppButton = ({
  amountSend,
  amountReceive,
  fromCurrency,
  toCurrency,
  exchangeRate,
  commission,
  tax,
  totalToSend,
  errorMessage,
}) => {
  const { locale } = useLocale(); // "es", "en" o "pt"

  // ▼ Definimos todo aquí mismo ▼
  const localeData = {
    es: {
      privacyWarning: {
        title: "Aviso",
        message: "Debe aceptar la Política de Privacidad antes de continuar.",
        button: "Entendido",
      },
      fillAmountsWarning: {
        title: "Aviso",
        message: "Por favor, ingrese los montos",
        button: "OK",
      },
      correctErrorsWarning: {
        title: "Aviso",
        message: "Por favor, corrija los errores antes de continuar",
        button: "Entendido",
      },
      buttonText: "Enviar Dinero",
      template:
        `Perfecto, los detalles de tu envío de Brasper hoy son los siguientes:\n *Monto a Enviar:* {amountSend} {fromCurrency}\n Tipo de Cambio: {exchangeRate}\n *Comisión de envío:* {commission} {fromCurrency}\n Neto a convertir: {totalToSend} {fromCurrency}\n *Total a Recibir:* {amountReceive} {toCurrency}\n \n*Resumen:* Para su envío de *{amountSend} {fromCurrency}*, recibirá directo en su cuenta de destino *{amountReceive} {toCurrency}*`.trim(),
    },
    en: {
      privacyWarning: {
        title: "Notice",
        message: "You must accept the Privacy Policy before continuing.",
        button: "Got it",
      },
      fillAmountsWarning: {
        title: "Notice",
        message: "Please enter the amounts",
        button: "OK",
      },
      correctErrorsWarning: {
        title: "Notice",
        message: "Please fix the errors before proceeding",
        button: "Understood",
      },
      buttonText: "Send Money",
      template:
        `Great! Here are the details of your Brasper transfer today\n *Amount to Send:* {amountSend} {fromCurrency}\n Exchange Rate: {exchangeRate}\n *Shipping Commission:* {commission} {fromCurrency}\n Net to Convert: {totalToSend} {fromCurrency}\n *Total to Receive:* {amountReceive} {toCurrency}\n\n *Summary:* For your transfer of *{amountSend} {fromCurrency}*, you will receive directly in your destination account *{amountReceive} {toCurrency}*`.trim(),
    },
    pt: {
      privacyWarning: {
        title: "Aviso",
        message:
          "Você deve aceitar a Política de Privacidade antes de continuar.",
        button: "Entendi",
      },
      fillAmountsWarning: {
        title: "Aviso",
        message: "Por favor, insira os valores",
        button: "OK",
      },
      correctErrorsWarning: {
        title: "Aviso",
        message: "Por favor, corrija os erros antes de continuar",
        button: "Entendi",
      },
      buttonText: "Enviar Dinero",
      template:
        `Perfeito, os detalhes para seu envio Brasper de hoje é o seguinte:\n *Valor a Enviar:* {amountSend} {fromCurrency}\n Taxa de Câmbio: {exchangeRate}\n *Custo de envio:* {commission} {fromCurrency}\n Neto por converter: {totalToSend} {fromCurrency}\n*Total a Receber:* {amountReceive} {toCurrency}\n\n*Resumo:* Para seu envio de *{amountSend} {fromCurrency}*, chegará direto na sua conta de destino *{amountReceive} {toCurrency}*`.trim(),
    },
  };

  // Seleccionamos el bloque correcto (fallback a "es")
  const t = localeData[locale] || localeData.es;

  const inject = (str) =>
    str
      .replace(/{amountSend}/g, amountSend)
      .replace(/{amountReceive}/g, amountReceive)
      .replace(/{fromCurrency}/g, fromCurrency)
      .replace(/{toCurrency}/g, toCurrency)
      .replace(/{exchangeRate}/g, exchangeRate)
      .replace(/{commission}/g, commission)
      .replace(/{tax}/g, tax)
      .replace(/{totalToSend}/g, totalToSend);

  const handleSendWhatsAppMessage = () => {
    // 1️⃣ Validar montos
    if (
      amountSend === "" ||
      amountReceive === "" ||
      isNaN(Number(amountSend)) ||
      isNaN(Number(amountReceive))
    ) {
      const w = t.fillAmountsWarning;
      return Notiflix.Report.warning(w.title, w.message, w.button);
    }

    // 2️⃣ Errores del formulario
    if (errorMessage) {
      const w = t.correctErrorsWarning;
      return Notiflix.Report.warning(w.title, w.message, w.button);
    }

    // 3️⃣ Construir y enviar
    const phoneNumber = "51966991933";
    const raw = t.template;
    const message = inject(raw);
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${phoneNumber}?text=${encoded}`, "_blank");
  };

  return (
    <button onClick={handleSendWhatsAppMessage} className="theme-btn">
      {" "}
      <FaWhatsapp className="mr-2 text-3xl   hover:shadow-xl transition-shadow duration-300 ease-in-out transform hover:scale-105" />
      <span>{t.buttonText}</span>
    </button>
  );
};

export default WhatsAppButton;
