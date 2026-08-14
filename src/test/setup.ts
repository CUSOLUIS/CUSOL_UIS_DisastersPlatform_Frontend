import type { PropsWithChildren } from "react";
import { AccessibilityInfo } from "react-native";

process.env.EXPO_PUBLIC_HUMAN_MAP_DATA_MODE = "demo";
process.env.EXPO_PUBLIC_PEOPLE_RECORDS_DATA_MODE = "demo";
process.env.EXPO_PUBLIC_MISSING_PERSON_DATA_MODE = "demo";
process.env.EXPO_PUBLIC_HUMANITARIAN_DIRECTORY_DATA_MODE = "demo";
process.env.EXPO_PUBLIC_COMMUNITY_CONTRIBUTION_DATA_MODE = "demo";

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: PropsWithChildren) => children,
  SafeAreaView: ({ children }: PropsWithChildren) => children,
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
