// eslint-disable-next-line no-unused-vars
import React from "react";
import PropTypes from "prop-types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faTag,
  faSpinner,
  faTimesCircle,
} from "@fortawesome/free-solid-svg-icons";
import { useLocale } from "../../context/LocaleProvider";

const CouponSection = ({
  // showInput - no usado, input siempre visible
  couponCode,
  setCouponCode,
  couponMessage,
  handleApplyCoupon,
  isLoading,
  finalDifference,
  // fromCurrency,
  toCurrency,
  details,
  couponApplied,
  setCouponApplied,
}) => {
  const { t } = useLocale();

  const applyCoupon = async () => {
    const result = await handleApplyCoupon(couponCode);
    if (result?.valid) {
      setCouponApplied(true);
    } else {
      setCouponApplied(false);
    }
  };

  const isError = couponMessage && !couponApplied;
  const currency = toCurrency || details?.receiveAmountCurrency || "";

  return (
    <div className="flex flex-col items-center justify-center my-6 w-full">
      {/* Mensaje de éxito con animación */}
      {couponApplied && (
        <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl shadow-lg animate-fade-in w-full max-w-md">
          <div className="flex items-center justify-center gap-3">
            <div className="flex-shrink-0">
              <FontAwesomeIcon
                icon={faCircleCheck}
                className="text-3xl text-green-600 animate-bounce-in"
              />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-lg text-green-700 mb-1">
                {t.calculator.promo1}
              </h3>
              <p className="text-green-600 font-semibold text-xl">
                {finalDifference} {currency} {t.calculator.promo2}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sección de input de cupón */}
      <div className="w-full max-w-md">
        

        <div
          className={`flex items-center border-2 rounded-xl shadow-sm transition-all duration-300 ${
            couponApplied
              ? "border-green-400 bg-green-50"
              : isError
              ? "border-red-400 bg-red-50"
              : "border-gray-300 bg-white hover:border-blue-400 focus-within:border-blue-500"
          }`}
        >
          {/* Icono de estado */}
          <div className="pl-4 pr-2 flex items-center">
            {isLoading ? (
              <FontAwesomeIcon
                icon={faSpinner}
                className="text-blue-500 animate-spin"
              />
            ) : couponApplied ? (
              <FontAwesomeIcon
                icon={faCircleCheck}
                className="text-green-600 text-xl"
              />
            ) : isError ? (
              <FontAwesomeIcon
                icon={faTimesCircle}
                className="text-red-500 text-xl"
              />
            ) : (
              <FontAwesomeIcon icon={faTag} className="text-gray-400 text-lg" />
            )}
          </div>

          {/* Input */}
          <input
            type="text"
            placeholder="Ingresa tu código de cupón"
            className={`px-3 py-3 flex-1 border-none bg-transparent focus:outline-none text-gray-700 placeholder-gray-400 ${
              couponApplied ? "text-green-700" : isError ? "text-red-700" : ""
            }`}
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && couponCode && !isLoading) {
                applyCoupon();
              }
            }}
            disabled={isLoading}
          />

          {/* Botón de aplicar */}
          <button
            onClick={applyCoupon}
            disabled={!couponCode || isLoading}
            className={`px-6 py-3 font-semibold rounded-r-xl transition-all duration-300 transform ${
              isLoading
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : couponApplied
                ? "bg-green-600 text-white hover:bg-green-700 hover:scale-105"
                : "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
            } ${!couponCode ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                Validando...
              </span>
            ) : couponApplied ? (
              "Aplicado"
            ) : (
              "Aplicar"
            )}
          </button>
        </div>

        {/* Mensaje de error o información */}
        {couponMessage && (
          <div
            className={`mt-3 p-3 rounded-lg text-sm text-center animate-fade-in ${
              isError
                ? "bg-red-50 border border-red-200 text-red-700"
                : "bg-blue-50 border border-blue-200 text-blue-700"
            }`}
          >
            <p className="font-medium">{couponMessage}</p>
          </div>
        )}

        {/* Mensaje de ayuda */}
        {!couponCode && !couponMessage && (
          <p className="mt-2 text-xs text-gray-500 text-center">
            Ingresa tu código de cupón para obtener un descuento especial
          </p>
        )}
      </div>
    </div>
  );
};

export default CouponSection;

CouponSection.propTypes = {
  showInput: PropTypes.bool.isRequired,
  couponCode: PropTypes.string.isRequired,
  setCouponCode: PropTypes.func.isRequired,
  couponMessage: PropTypes.string,
  handleApplyCoupon: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  finalDifference: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  fromCurrency: PropTypes.string,
  toCurrency: PropTypes.string,
  details: PropTypes.object,
  couponApplied: PropTypes.bool.isRequired,
  setCouponApplied: PropTypes.func.isRequired,
};
