import PropTypes from "prop-types";
import Select from "react-select";

const createSelectOptions = (allCurrencies) => {
  return allCurrencies.map((currency) => ({
    value: currency.code,
    label: currency.code,
    image: currency.image,
  }));
};

const CustomOption = ({ innerProps, innerRef, data }) => (
  <div
    ref={innerRef}
    {...innerProps}
    className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer"
  >
    {data.image ? (
      <img src={data.image} alt={data.label} className="w-5 h-5 mr-2" />
    ) : (
      <div className="w-5 h-5 mr-2 bg-gray-300" />
    )}
    <span>{data.label}</span>
  </div>
);

CustomOption.propTypes = {
  innerProps: PropTypes.object.isRequired,
  innerRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  ]),
  data: PropTypes.shape({
    image: PropTypes.string,
    label: PropTypes.string.isRequired,
  }).isRequired,
};

const CustomSingleValue = ({ innerProps = {}, data }) => (
  <div className="flex items-center" {...innerProps}>
    {data.image ? (
      <img src={data.image} alt={data.label} className="w-5 h-5 mr-2" />
    ) : (
      <div className="w-5 h-5 mr-2 bg-gray-300" />
    )}
    <span>{data.label}</span>
  </div>
);

CustomSingleValue.propTypes = {
  innerProps: PropTypes.object,
  data: PropTypes.shape({
    image: PropTypes.string,
    label: PropTypes.string.isRequired,
  }).isRequired,
};

const CurrencyRow = ({
  title,
  label,
  amount,
  onAmountChange,
  selectedCurrency,
  onCurrencyChange,
  allCurrencies,
  allowedCurrencyKeys,
  originalAmount,
  badgeText,
  highlight,
}) => {
  const currencyOptionsSelect = createSelectOptions(allCurrencies);

  return (
    <div className=" shadow-lg rounded-xl p-4 border mb-4">
      <h2 className="text-sm  ">
        {title} {badgeText ? <span className="text-blue-600 font-semibold">{badgeText}</span> : null}
      </h2>
      <div className="flex items-center gap-x-4">
        {originalAmount !== undefined && originalAmount !== null ? (
          <>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="w-full max-w-[200px] bg-transparent text-xl focus:outline-none border-none focus:ring-0 text-gray-700"
              placeholder={label}
              value={originalAmount ?? ""}
              onChange={onAmountChange}
            />
            <span className={`text-2xl font-semibold ${
              highlight ? "text-blue-600" : "text-gray-800"
            }`}>
              {amount || ""}
            </span>
          </>
        ) : (
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className={`w-full max-w-[200px] bg-transparent text-2xl focus:outline-none border-none focus:ring-0 ${
              highlight ? "text-blue-600 font-semibold" : ""
            }`}
            placeholder={label}
            value={amount || ""}
            onChange={onAmountChange}
          />
        )}
        <Select
          value={currencyOptionsSelect.find(
            (option) => option.value === selectedCurrency
          )}
          onChange={onCurrencyChange}
          options={currencyOptionsSelect.filter((option) =>
            allowedCurrencyKeys.includes(option.value)
          )}
          components={{
            Option: CustomOption,
            SingleValue: CustomSingleValue,
          }}
          isSearchable={false}
          classNames={{
            // 1) ancho completo hasta 600px
            container: () => "w-full max-w-[600px]",

            // 2) sin borde, sin sombra
            control: () =>
              "bg-transparent border-none shadow-none focus:outline-none",

            valueContainer: () => "flex items-center",
            indicatorsContainer: () => "flex items-center p-0",
          }}
          styles={{
            // por si acaso: eliminar cualquier borde/sombra "inline"
            control: (provided) => ({
              ...provided,
              border: 0,
              boxShadow: "none",
              backgroundColor: "transparent",
              minHeight: "auto",
              padding: 0,
            }),
            valueContainer: (provided) => ({
              ...provided,
              padding: "4px 3em", // antes: 0
              display: "flex",
              alignItems: "center",
            }),

            indicatorsContainer: (provided) => ({
              ...provided,
              padding: 0,
              display: "flex",
              alignItems: "center",
            }),
            dropdownIndicator: (base) => ({
              ...base,
              padding: 0,
              fontSize: "5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }),
          }}
        />
      </div>
    </div>
  );
};

CurrencyRow.propTypes = {
  label: PropTypes.string.isRequired,
  amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onAmountChange: PropTypes.func.isRequired,
  selectedCurrency: PropTypes.string.isRequired,
  onCurrencyChange: PropTypes.func.isRequired,
  allCurrencies: PropTypes.arrayOf(
    PropTypes.shape({
      code: PropTypes.string.isRequired,
      name: PropTypes.string,
      image: PropTypes.string,
    })
  ).isRequired,
  allowedCurrencyKeys: PropTypes.arrayOf(PropTypes.string).isRequired,
  originalAmount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  badgeText: PropTypes.string,
  highlight: PropTypes.bool,
};

export default CurrencyRow;
