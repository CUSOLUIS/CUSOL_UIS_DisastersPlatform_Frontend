// CHG-076: los estilos globales de foco/autofill solo existen en web
// (ver WebFormControlStyles.web.tsx); en nativo no hay nada que pintar.
export function WebFormControlStyles() {
  return null;
}
