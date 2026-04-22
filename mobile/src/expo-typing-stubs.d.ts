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

declare module "expo-image-picker" {
  export type ImagePickerAsset = {
    uri: string;
    base64?: string;
    fileName?: string | null;
    mimeType?: string | null;
  };

  export type ImagePickerResult =
    | { canceled: true; assets: null }
    | { canceled: false; assets: ImagePickerAsset[] };

  export type PermissionResponse = { granted: boolean };

  export function requestCameraPermissionsAsync(): Promise<PermissionResponse>;
  export function requestMediaLibraryPermissionsAsync(): Promise<PermissionResponse>;
  export function launchCameraAsync(options?: {
    base64?: boolean;
    quality?: number;
    allowsEditing?: boolean;
  }): Promise<ImagePickerResult>;
  export function launchImageLibraryAsync(options?: {
    base64?: boolean;
    quality?: number;
    allowsEditing?: boolean;
  }): Promise<ImagePickerResult>;
}

declare module "react-native" {
  import type { ComponentType } from "react";

  export const Linking: {
    openURL: (url: string) => Promise<void>;
  };
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
