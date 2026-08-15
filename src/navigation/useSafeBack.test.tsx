import { renderHook } from "@testing-library/react-native";
import { useSafeBack } from "./useSafeBack";

// CHG-079 — VOLVER resiliente: con historial navega atrás; tras una
// recarga o un acceso directo (pila vacía) reemplaza a la portada.

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockHistoryAvailable = true;

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => mockHistoryAvailable,
  }),
}));

afterEach(() => {
  mockBack.mockClear();
  mockReplace.mockClear();
});

it("con historial de navegación vuelve atrás", () => {
  mockHistoryAvailable = true;
  const { result } = renderHook(() => useSafeBack());

  result.current();

  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(mockReplace).not.toHaveBeenCalled();
});

it("tras recarga o URL directa reemplaza hacia la portada", () => {
  mockHistoryAvailable = false;
  const { result } = renderHook(() => useSafeBack());

  result.current();

  expect(mockBack).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith("/");
});
