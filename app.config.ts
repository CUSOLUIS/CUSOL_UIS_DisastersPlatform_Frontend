import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins: NonNullable<ExpoConfig["plugins"]> = [
    ...(config.plugins ?? []),
  ];
  const mapsPluginOptions: Record<string, string> = {};

  if (process.env.GOOGLE_MAPS_ANDROID_API_KEY) {
    mapsPluginOptions.androidGoogleMapsApiKey =
      process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  }

  if (process.env.GOOGLE_MAPS_IOS_API_KEY) {
    mapsPluginOptions.iosGoogleMapsApiKey = process.env.GOOGLE_MAPS_IOS_API_KEY;
  }

  if (Object.keys(mapsPluginOptions).length > 0) {
    plugins.push(["react-native-maps", mapsPluginOptions]);
  }

  return {
    ...config,
    name: config.name ?? "CUSOL Desastres Colombia",
    slug: config.slug ?? "cusol-disasters-colombia",
    plugins,
  };
};
