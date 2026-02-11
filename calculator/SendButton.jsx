import PropTypes from "prop-types";
import Notiflix from "notiflix";
import { useNavigate } from "react-router-dom";
import { useLocale } from "../../context/LocaleProvider";

const SendButton = ({ nextStep }) => {
  const navigate = useNavigate();
  const userId = sessionStorage.getItem("id");
  const { t } = useLocale();
  const handleSendWhatsAppMessage = () => {
    if (!userId) {
      navigate("/login");
      return;
    }

    nextStep();
  };

  return (
    <button className="theme-btn" onClick={handleSendWhatsAppMessage}>
      {t.next}
    </button>
  );
};

SendButton.propTypes = {
  nextStep: PropTypes.func.isRequired,
};

export default SendButton;
