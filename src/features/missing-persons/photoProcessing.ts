// CHG-071 — Presupuesto total de fotografías con compresión previa.
// Máximo 3 imágenes por reporte; si la suma supera los 50 MB (o alguna
// pasa de 10 MiB), TODAS las imágenes se procesan antes de guardarse:
// se reducen en dimensión y calidad por pasos hasta caber en el
// presupuesto. Solo si ni así caben, el envío se rechaza.

import type { SelectedPhoto } from "./reportTypes";

export const MAX_TOTAL_PHOTO_BYTES = 50 * 1024 * 1024;
export const MAX_SINGLE_PHOTO_BYTES = 10 * 1024 * 1024;

// Debajo de este tamaño una imagen no se REDIMENSIONA (solo se
// recomprime): evita agrandar fotos pequeñas al reprocesar el conjunto.
const RESIZE_THRESHOLD_BYTES = 4 * 1024 * 1024;

// Pasos de compresión, de suave a agresivo.
const COMPRESSION_STEPS = [
  { quality: 0.8, maxDimension: 1920 },
  { quality: 0.6, maxDimension: 1600 },
  { quality: 0.45, maxDimension: 1280 },
] as const;

export interface CompressPhotoOptions {
  quality: number;
  maxDimension: number;
  resize: boolean;
}

export type PhotoCompressor = (
  photo: SelectedPhoto,
  options: CompressPhotoOptions,
) => Promise<SelectedPhoto>;

function jpegName(name: string): string {
  const lastDot = name.lastIndexOf(".");
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  return `${base}.jpg`;
}

async function measureBytes(uri: string): Promise<number | null> {
  try {
    const blob = await (await fetch(uri)).blob();
    return blob.size;
  } catch {
    // En algunos entornos nativos el tamaño no puede medirse; el
    // backend conserva sus propios límites como última defensa.
    return null;
  }
}

async function defaultCompressor(
  photo: SelectedPhoto,
  options: CompressPhotoOptions,
): Promise<SelectedPhoto> {
  const { manipulateAsync, SaveFormat } = await import(
    "expo-image-manipulator"
  );
  const result = await manipulateAsync(
    photo.uri,
    options.resize ? [{ resize: { width: options.maxDimension } }] : [],
    { compress: options.quality, format: SaveFormat.JPEG },
  );
  return {
    uri: result.uri,
    name: jpegName(photo.name),
    size: await measureBytes(result.uri),
    mimeType: "image/jpeg",
  };
}

function totalBytes(photos: SelectedPhoto[]): number {
  return photos.reduce((sum, photo) => sum + (photo.size ?? 0), 0);
}

export function photosWithinBudget(photos: SelectedPhoto[]): boolean {
  return (
    totalBytes(photos) <= MAX_TOTAL_PHOTO_BYTES &&
    photos.every(
      (photo) => photo.size === null || photo.size <= MAX_SINGLE_PHOTO_BYTES,
    )
  );
}

export interface PreparedPhotos {
  photos: SelectedPhoto[];
  compressed: boolean;
}

export async function preparePhotosForUpload(
  photos: SelectedPhoto[],
  compressor: PhotoCompressor = defaultCompressor,
): Promise<PreparedPhotos> {
  if (photosWithinBudget(photos)) {
    return { photos, compressed: false };
  }

  let current = photos;
  for (const step of COMPRESSION_STEPS) {
    current = await Promise.all(
      photos.map((photo) =>
        compressor(photo, {
          quality: step.quality,
          maxDimension: step.maxDimension,
          resize: (photo.size ?? Infinity) > RESIZE_THRESHOLD_BYTES,
        }),
      ),
    );
    if (photosWithinBudget(current)) {
      return { photos: current, compressed: true };
    }
  }

  if (photosWithinBudget(current)) {
    return { photos: current, compressed: true };
  }
  throw new Error(
    "Ni comprimiendo las imágenes fue posible bajar de 50 MB en total " +
      "y 10 MiB por foto. Usa fotografías más livianas.",
  );
}
