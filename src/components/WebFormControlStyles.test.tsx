import {
  WebFormControlStyles,
  webFormControlCss,
} from "./WebFormControlStyles.web";
import { WebFormControlStyles as NativeVariant } from "./WebFormControlStyles";
import { colors } from "../theme";

// CHG-076 — El anillo de foco y el autofill de los inputs en web usan
// el lenguaje de diseño en lugar del amarillo del navegador.
describe("WebFormControlStyles", () => {
  it("sustituye el anillo de foco del navegador por el cian del tema", () => {
    expect(webFormControlCss).toContain("input:focus");
    expect(webFormControlCss).toContain("textarea:focus");
    expect(webFormControlCss).toContain(
      `outline: 1.5px solid ${colors.cyan}bf !important`,
    );
  });

  it("reemplaza el fondo amarillo del autocompletado por el tema oscuro", () => {
    expect(webFormControlCss).toContain("input:-webkit-autofill");
    expect(webFormControlCss).toContain(colors.canvasRaised);
    expect(webFormControlCss).toContain(colors.ink);
  });

  it("inyecta una única etiqueta de estilos global en web", () => {
    const element = WebFormControlStyles();
    expect(element?.type).toBe("style");
    expect(element?.props.id).toBe("cusol-form-controls");
    expect(element?.props.children).toBe(webFormControlCss);
  });

  it("no pinta nada en la app nativa", () => {
    expect(NativeVariant()).toBeNull();
  });
});
