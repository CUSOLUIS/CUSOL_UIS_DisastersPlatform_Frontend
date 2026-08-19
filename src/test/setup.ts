import type { PropsWithChildren } from "react";
import { AccessibilityInfo } from "react-native";
import { configure } from "@testing-library/react-native";

// En runners lentos o cargados (CI, la Pi durante builds) el primer
// render de la App en un worker frío tarda varios segundos y los
// findBy*/waitFor superan sus límites por defecto sin que exista un
// fallo funcional; los timeouts amplios eliminan esa clase de flakes.
configure({ asyncUtilTimeout: 15_000 });
jest.setTimeout(60_000);

process.env.EXPO_PUBLIC_HUMAN_MAP_DATA_MODE = "demo";
process.env.EXPO_PUBLIC_PEOPLE_RECORDS_DATA_MODE = "demo";
process.env.EXPO_PUBLIC_MISSING_PERSON_DATA_MODE = "demo";
process.env.EXPO_PUBLIC_HUMANITARIAN_DIRECTORY_DATA_MODE = "demo";
process.env.EXPO_PUBLIC_COMMUNITY_CONTRIBUTION_DATA_MODE = "demo";
process.env.EXPO_PUBLIC_MY_SPACE_DATA_MODE = "demo";
// CHG-125: solicitudes «Necesitamos ayuda» sin red en pruebas.
process.env.EXPO_PUBLIC_HELP_REQUESTS_DATA_MODE = "demo";
// CHG-163: ofertas «Ofrecer comida» sin red en pruebas.
process.env.EXPO_PUBLIC_FOOD_OFFERS_DATA_MODE = "demo";
// CHG-165: comentarios/denuncias de acopios locales sin red en pruebas.
process.env.EXPO_PUBLIC_AID_LOCATION_COMMUNITY_DATA_MODE = "demo";

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: PropsWithChildren) => children,
  SafeAreaView: ({ children }: PropsWithChildren) => children,
  // CHG-112: sin insets por defecto, para que ninguna prueba existente
  // cambie de comportamiento. Quien necesite un dispositivo con muesca
  // sustituye este mock en su propio archivo.
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("../hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));

jest.mock("../features/operational-map/OperationalMapCanvas", () => ({
  OperationalMapCanvas: jest.requireActual<
    typeof import("../features/operational-map/FallbackMapCanvas")
  >("../features/operational-map/FallbackMapCanvas").FallbackMapCanvas,
}));

jest
  .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
  .mockResolvedValue(true);
