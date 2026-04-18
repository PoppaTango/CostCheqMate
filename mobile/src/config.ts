const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

if (!configuredBaseUrl) {
  // eslint-disable-next-line no-console
  console.warn(
    "EXPO_PUBLIC_API_BASE_URL is not set. Mobile app calls will fail until it is configured."
  );
}

export const API_BASE_URL = configuredBaseUrl || "http://localhost:3000";
