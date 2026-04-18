declare module "expo-constants" {
  const Constants: {
    expoConfig?: {
      version?: string;
    };
  };
  export default Constants;
}

declare module "expo-secure-store" {
  export function getItemAsync(key: string): Promise<string | null>;
  export function setItemAsync(key: string, value: string): Promise<void>;
  export function deleteItemAsync(key: string): Promise<void>;
}

declare module "react-native" {
  import type { ComponentType } from "react";

  export const Alert: {
    alert: (title: string, message?: string) => void;
  };
  export const Button: ComponentType<Record<string, unknown>>;
  export const SafeAreaView: ComponentType<Record<string, unknown>>;
  export const ScrollView: ComponentType<Record<string, unknown>>;
  export const Text: ComponentType<Record<string, unknown>>;
  export const TextInput: ComponentType<Record<string, unknown>>;
  export const View: ComponentType<Record<string, unknown>>;
}
