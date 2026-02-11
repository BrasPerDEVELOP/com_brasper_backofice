import PropTypes from "prop-types";
import { useLocale } from "../../context/LocaleProvider";

const CommissionDetails = ({
  commissionRateDisplay, // Ahora se utiliza en la validación
  commission,
  commissionWithoutCoupon,
  totalToSend,
  totalToSendWithoutCoupon,
  exchangeRate,
  couponApplied,
  finalDifference,
  details,
}) => {
  const { t } = useLocale();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mx-5">
        <span className="font-semibold text-gray-700">{t.Comisión}:</span>
        <div className="text-right">
          {couponApplied && (
            <span className="line-through text-gray-700 mr-5">
              {commissionWithoutCoupon}
            </span>
          )}
          <span className="font-semibold text-green-500">{commission}</span>
        </div>
      </div>
     {/*  <div className="flex justify-between items-center mx-5">
        <span className="font-semibold text-gray-700">{t.Taxes}:</span>
        <div className="text-right">
          {couponApplied && (
            <span className="line-through text-gray-700 mr-2">
              {taxWithoutCoupon}
            </span>
          )}
          <span className="font-semibold text-green-500 ">{tax}</span>
        </div>
      </div> */}
      {/* Total a Enviar */}
      <div className="flex justify-between items-center mx-5">
        <span className="font-semibold text-gray-700">{t.Send}:</span>
        <div className="text-right">
          {couponApplied && (
            <span className="line-through text-gray-700 mr-2">
              {totalToSendWithoutCoupon}
            </span>
          )}
          <span className="font-semibold text-green-500 ">{totalToSend}</span>
        </div>
      </div>
      {/* Tipo de cambio */}
      <div className="flex justify-between items-center mx-5">
        <span className="font-semibold text-gray-700">{t.Exchange}:</span>
        <span className="text-black ">{exchangeRate}</span>
      </div>{" "}
      <br />
    </div>
  );
};

CommissionDetails.propTypes = {
  commissionRateDisplay: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]).isRequired,
  commission: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    .isRequired,
  commissionWithoutCoupon: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
  totalToSend: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    .isRequired,
  totalToSendWithoutCoupon: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
  exchangeRate: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    .isRequired,
  couponApplied: PropTypes.bool,
};

export default CommissionDetails;
