import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import {
  MAX_VISIBLE_OPTIONS,
  TerritorySelectField,
} from "./TerritorySelectField";
import { DEPARTMENTS, municipalitiesOf } from "./territory";

afterEach(cleanup);

// CHG-185 — El campo es una lista cerrada que se busca escribiendo:
// escribir filtra, tocar elige, y nada más guarda un valor.
describe("TerritorySelectField (CHG-185)", () => {
  it("no dibuja los 1.122 municipios de golpe y dice cuántos quedan", () => {
    render(
      <TerritorySelectField
        label="Municipio *"
        name="municipio"
        value=""
        options={municipalitiesOf("Antioquia")}
        onSelect={jest.fn()}
      />,
    );

    fireEvent(screen.getByLabelText("Municipio *"), "focus");
    expect(
      screen.getByText(`y ${125 - MAX_VISIBLE_OPTIONS} más — sigue escribiendo para acotar`),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Elegir el municipio Medellín")).toBeNull();

    fireEvent.changeText(screen.getByLabelText("Municipio *"), "medell");
    expect(screen.getByLabelText("Elegir el municipio Medellín")).toBeTruthy();
    expect(screen.queryByText(/más — sigue escribiendo/)).toBeNull();
  });

  it("guarda solo lo que se toca en la lista", () => {
    const onSelect = jest.fn();
    render(
      <TerritorySelectField
        label="Departamento *"
        name="departamento"
        value=""
        options={DEPARTMENTS}
        onSelect={onSelect}
      />,
    );

    fireEvent.changeText(screen.getByLabelText("Departamento *"), "boyaca");
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText("Elegir el departamento Boyacá"));
    expect(onSelect).toHaveBeenCalledWith("Boyacá");
  });

  it("avisa cuando nada del catálogo coincide", () => {
    render(
      <TerritorySelectField
        label="Departamento *"
        name="departamento"
        value=""
        options={DEPARTMENTS}
        onSelect={jest.fn()}
      />,
    );

    fireEvent.changeText(screen.getByLabelText("Departamento *"), "Sanander");
    expect(
      screen.getByText(
        "Ningún departamento del catálogo coincide con «Sanander». Revisa cómo lo escribiste.",
      ),
    ).toBeTruthy();
  });

  it("ya elegido muestra el nombre y deja cambiarlo", () => {
    const onSelect = jest.fn();
    render(
      <TerritorySelectField
        label="Departamento *"
        name="departamento"
        value="Chocó"
        options={DEPARTMENTS}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByLabelText("Departamento *: Chocó")).toBeTruthy();
    expect(screen.queryByLabelText("Departamento *")).toBeNull();

    fireEvent.press(screen.getByLabelText("Cambiar departamento"));
    expect(onSelect).toHaveBeenCalledWith("");
  });

  it("deshabilitado no ofrece ninguna opción", () => {
    render(
      <TerritorySelectField
        label="Municipio *"
        name="municipio"
        value=""
        options={[]}
        onSelect={jest.fn()}
        disabled
        disabledHint="Elige primero el departamento"
      />,
    );

    expect(screen.getByLabelText("Municipio * no disponible")).toBeTruthy();
    expect(screen.queryByLabelText("Municipio *")).toBeNull();
    expect(screen.queryByLabelText("Opciones de municipio")).toBeNull();
  });
});
