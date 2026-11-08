import type { ConfigContext, ExpoConfig } from 'expo/config';

// Extends app.json: injects the Google Maps key (Android store builds) from the environment.
export default ({ config }: ConfigContext): ExpoConfig =>
  ({
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: { apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '' },
      },
    },
  }) as ExpoConfig;
