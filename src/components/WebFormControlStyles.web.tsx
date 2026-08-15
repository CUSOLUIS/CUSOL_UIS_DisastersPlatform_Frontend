import { createElement } from "react";
import { colors } from "../theme";

// CHG-076: en web, el navegador pinta su propio anillo de foco
// (amarillento o blanco según SO) sobre los inputs de React Native
// Web, y el autocompletado de Chrome pinta el fondo amarillo. Estos
// estilos globales sustituyen ambos por el lenguaje de diseño: anillo
// cian y fondo oscuro del tema. El foco visible se conserva
// (accesibilidad); solo cambia su color.
export const webFormControlCss = `
input:focus,
textarea:focus,
select:focus {
  outline: 1.5px solid ${colors.cyan}bf !important;
  outline-offset: 1px;
}
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus,
textarea:-webkit-autofill,
select:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 1000px ${colors.canvasRaised} inset !important;
  -webkit-text-fill-color: ${colors.ink} !important;
  caret-color: ${colors.ink};
}
input:autofill {
  background-color: ${colors.canvasRaised} !important;
  color: ${colors.ink} !important;
}
`;

export function WebFormControlStyles() {
  return createElement(
    "style",
    { id: "cusol-form-controls" },
    webFormControlCss,
  );
}
