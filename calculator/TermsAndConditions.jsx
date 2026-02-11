import { useLocale } from "../../context/LocaleProvider";

const TermsAndConditions = () => {
  const { t, locale } = useLocale();

  // Enlaces según idioma
  const termsLinks = {
    es: "https://drive.google.com/file/d/1ACrx6qdwvws_pSuUrlL2w4AgNydPMlW6/view?usp=sharing", // Español
    en: "https://drive.google.com/file/d/1ACrx6qdwvws_pSuUrlL2w4AgNydPMlW6/view?usp=sharing", // Inglés
    pt: "https://drive.google.com/file/d/1FOMBT2LZvTdx9YphUdN6xIaSvxfW9kcC/view?usp=sharing", // Portugués
  };

  // Obtener enlace según idioma actual
  const termsUrl = termsLinks[locale] || termsLinks["es"];

  return (
    <div className="flex items-center justify-center m-4">
      <a
        href={termsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 underline hover:text-blue-700"
      >
        {t.calculator.terminos}
      </a>
    </div>
  );
};

export default TermsAndConditions;
