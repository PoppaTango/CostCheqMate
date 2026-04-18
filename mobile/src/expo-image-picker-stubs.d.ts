declare module "expo-image-picker" {
  export const MediaTypeOptions: {
    Images: "images";
  };

  export type MediaTypeOptions = "images";

  export interface ImagePickerAsset {
    uri: string;
    base64?: string | null;
    type?: string | null;
    mimeType?: string | null;
    fileName?: string | null;
  }

  export interface ImagePickerResult {
    canceled: boolean;
    assets?: ImagePickerAsset[];
  }

  export function requestCameraPermissionsAsync(): Promise<{
    granted: boolean;
    status?: "granted" | "denied" | "undetermined";
  }>;
  export function requestMediaLibraryPermissionsAsync(): Promise<{
    granted: boolean;
    status?: "granted" | "denied" | "undetermined";
  }>;
  export function launchCameraAsync(options?: {
    mediaTypes?: MediaTypeOptions;
    quality?: number;
    base64?: boolean;
  }): Promise<ImagePickerResult>;
  export function launchImageLibraryAsync(options?: {
    mediaTypes?: MediaTypeOptions;
    quality?: number;
    base64?: boolean;
  }): Promise<ImagePickerResult>;
}
