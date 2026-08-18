import * as DocumentPicker from "expo-document-picker";
import {
  ALLOWED_PHOTO_MIME_TYPES,
  validateAndMergePhotos,
} from "../missing-persons/photoValidation";
import type { SelectedPhoto } from "../missing-persons/reportTypes";

// CHG-148: selector de UNA fotografía opcional del voluntario, con la
// misma validación (tipo/tamaño) del resto de envíos ciudadanos.
export async function pickVolunteerPhoto(): Promise<SelectedPhoto[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ALLOWED_PHOTO_MIME_TYPES,
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled) {
    return [];
  }
  const picked = result.assets.map((asset) => ({
    uri: asset.uri,
    name: asset.name,
    size: asset.size ?? null,
    mimeType: asset.mimeType ?? null,
  }));
  const { photos } = validateAndMergePhotos([], picked);
  return photos.slice(0, 1);
}
