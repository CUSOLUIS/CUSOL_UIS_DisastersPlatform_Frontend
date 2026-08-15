import type { PhotoValidationResult, SelectedPhoto } from "./reportTypes";

// CHG-071: máximo 3 imágenes por reporte. Las fotos grandes ya no se
// rechazan al seleccionarlas: si el conjunto supera los 50 MB (o una
// foto pasa de 10 MiB), se comprimen automáticamente antes de enviar.
export const MAX_PHOTO_COUNT = 3;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const allowedPhotoTypes: Record<string, string[]> = {
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
  ".heic": ["image/heic", "image/heif"],
  ".heif": ["image/heic", "image/heif"],
};

export const ALLOWED_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export const ALLOWED_PHOTO_HELP =
  "JPEG (.jpg, .jpeg), PNG (.png), WebP (.webp) y HEIC/HEIF (.heic, .heif).";

function extensionOf(name: string): string {
  const lastDot = name.lastIndexOf(".");
  return lastDot >= 0 ? name.slice(lastDot).toLocaleLowerCase("es-CO") : "";
}

export function validateAndMergePhotos(
  currentPhotos: SelectedPhoto[],
  incomingPhotos: SelectedPhoto[],
): PhotoValidationResult {
  if (currentPhotos.length + incomingPhotos.length > MAX_PHOTO_COUNT) {
    return {
      photos: currentPhotos,
      errors: [`Puedes adjuntar máximo ${MAX_PHOTO_COUNT} fotografías.`],
    };
  }

  const validPhotos: SelectedPhoto[] = [];
  const errors: string[] = [];

  incomingPhotos.forEach((photo) => {
    const extension = extensionOf(photo.name);
    const expectedMimeTypes = allowedPhotoTypes[extension];

    if (
      !expectedMimeTypes ||
      !photo.mimeType ||
      !expectedMimeTypes.includes(photo.mimeType.toLocaleLowerCase("en-US"))
    ) {
      errors.push(`${photo.name}: el formato no está permitido o no puede verificarse.`);
      return;
    }

    if (photo.size === null) {
      errors.push(`${photo.name}: no fue posible verificar el tamaño.`);
      return;
    }

    validPhotos.push(photo);
  });

  return { photos: [...currentPhotos, ...validPhotos], errors };
}
