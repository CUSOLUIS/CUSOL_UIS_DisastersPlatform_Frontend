/**
 * CHG-112 — La cabecera de la ventana ampliada respeta el área segura.
 *
 * El modal se abre con `statusBarTranslucent`, así que su ventana
 * empieza debajo de la barra de estado: sin el inset, "CONSULTA
 * AMPLIADA" y "CERRAR ×" se dibujaban encima del reloj y los iconos del
 * sistema. Aquí se simula un dispositivo con muesca para que la regla
 * no dependa de que alguien la recuerde.
 */

// Este mock sustituye al global de `src/test/setup.ts`, que devuelve
// insets en cero.
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 44, right: 0, bottom: 34, left: 0 }),
}));

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { RecentPeopleTable } from "./RecentPeopleTable";
import type { PeopleRecordsDataSource, PersonRecord } from "./types";

const INSET_SUPERIOR = 44;

const persona: PersonRecord = {
  id: "b0f4b2a1-6d43-4d4f-9d0e-6d9b3b2b1a55",
  displayName: "Arnulfo Jaramillo",
  status: "missing",
  location: "Cali, Valle del Cauca",
  relatedEvent: "Reporte ciudadano de persona desaparecida",
  source: {
    name: "Reporte ciudadano de persona desaparecida — plataforma CUSOL",
    sourceType: "citizen",
    url: null,
  },
  createdAt: "2026-08-15T17:52:00.000Z",
};

const dataSource: PeopleRecordsDataSource = {
  transport: "fixture",
  getPage: async (query) => ({
    items: [persona],
    total: 1,
    limit: query.limit,
    offset: query.offset,
    generatedAt: "2026-08-16T04:00:00.000Z",
  }),
};

async function abrirVentanaAmpliada() {
  render(<RecentPeopleTable dataSource={dataSource} />);
  // La primera carga es asíncrona; se deja resolver dentro de act para
  // que la paginación esté montada antes de tocarla.
  await act(async () => {});
  fireEvent.press(
    screen.getByRole("button", {
      name: "Abrir ventana con 10 filas por página",
    }),
  );
  await act(async () => {});
}

function estiloDeLaBarra() {
  return StyleSheet.flatten(
    screen.getByTestId("expanded-people-toolbar").props.style,
  );
}

function controlDePagina(filas: number) {
  return screen.getByRole("button", {
    name: `Mostrar ${filas} filas por página`,
  });
}

afterEach(cleanup);

describe("Ventana ampliada de registros publicables", () => {
  it("baja la cabecera por debajo de la barra de estado del sistema", async () => {
    await abrirVentanaAmpliada();

    // El inset no sustituye al respiro propio de la barra: se suma.
    expect(estiloDeLaBarra().paddingTop).toBeGreaterThan(INSET_SUPERIOR);
  });

  it("conserva el respiro inferior de la cabecera", async () => {
    await abrirVentanaAmpliada();

    // Un `paddingTop` propio anula el `paddingVertical` de la hoja solo
    // por arriba; si esto se rompe, el título queda pegado al borde.
    const barra = estiloDeLaBarra();
    expect(barra.paddingBottom ?? barra.paddingVertical).toBeGreaterThan(0);
  });

  it("no mueve la cabecera al cambiar de tamaño de página", async () => {
    await abrirVentanaAmpliada();
    const antesDeLaBarra = estiloDeLaBarra().paddingTop;
    // 20 está inactivo; es el cambio de estado que sí ocurre dentro de
    // la ventana (10 ya viene seleccionado al abrirla).
    const antes = StyleSheet.flatten(controlDePagina(20).props.style);

    fireEvent.press(controlDePagina(20));
    await act(async () => {});

    const despues = StyleSheet.flatten(controlDePagina(20).props.style);
    // El estado activo solo puede cambiar color: cualquier cambio de
    // caja reacomoda la fila y empuja el resto del layout.
    expect(despues.minWidth).toBe(antes.minWidth);
    expect(despues.minHeight).toBe(antes.minHeight);
    expect(despues.borderWidth).toBe(antes.borderWidth);
    expect(despues.paddingHorizontal).toBe(antes.paddingHorizontal);
    // Y la cabecera sigue donde estaba.
    expect(estiloDeLaBarra().paddingTop).toBe(antesDeLaBarra);
  });
});
