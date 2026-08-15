/**
 * CHG-071 — Presupuesto de fotografías: si la suma supera los 50 MB
 * (o una foto pasa de 10 MiB), TODAS las imágenes se comprimen antes
 * de guardarse; solo si ni así caben, el envío se rechaza.
 */

import {
  MAX_SINGLE_PHOTO_BYTES,
  MAX_TOTAL_PHOTO_BYTES,
  preparePhotosForUpload,
  totalSizeNotice,
  type PhotoCompressor,
} from "./photoProcessing";
import type { SelectedPhoto } from "./reportTypes";

const MB = 1024 * 1024;

function photo(name: string, sizeMb: number): SelectedPhoto {
  return {
    uri: `file:///photos/${name}`,
    name,
    size: sizeMb * MB,
    mimeType: "image/jpeg",
  };
}

it("no toca las fotos cuando el conjunto cabe en el presupuesto", async () => {
  const compressor = jest.fn();
  const input = [photo("a.jpg", 8), photo("b.jpg", 9), photo("c.jpg", 10)];

  const prepared = await preparePhotosForUpload(
    input,
    compressor as unknown as PhotoCompressor,
  );

  expect(prepared.compressed).toBe(false);
  expect(prepared.photos).toBe(input);
  expect(compressor).not.toHaveBeenCalled();
});

it("comprime TODAS las imágenes cuando la suma excede los 50 MB", async () => {
  const compressor: jest.MockedFunction<PhotoCompressor> = jest.fn(
    async (original, options) => ({
      ...original,
      name: original.name.replace(/\.[^.]+$/, ".jpg"),
      // El peso resultante depende de la calidad aplicada.
      size: Math.round(7.5 * MB * options.quality),
      mimeType: "image/jpeg",
    }),
  );
  const input = [
    photo("a.png", 30),
    photo("b.jpg", 25),
    photo("c.webp", 2),
  ];

  const prepared = await preparePhotosForUpload(input, compressor);

  expect(prepared.compressed).toBe(true);
  // Las tres se procesan, incluida la pequeña (sin redimensionarla).
  expect(compressor).toHaveBeenCalledTimes(3);
  expect(compressor.mock.calls.map(([, options]) => options.resize)).toEqual([
    true,
    true,
    false,
  ]);
  const total = prepared.photos.reduce((sum, item) => sum + (item.size ?? 0), 0);
  expect(total).toBeLessThanOrEqual(MAX_TOTAL_PHOTO_BYTES);
  expect(
    prepared.photos.every((item) => (item.size ?? 0) <= MAX_SINGLE_PHOTO_BYTES),
  ).toBe(true);
});

// CHG-071b (hallazgo del VPS): el aviso de suma total aparece ANTES de
// enviar, en vez de un 413 confuso del borde.
it("avisa antes de enviar cuando la selección supera el presupuesto", () => {
  expect(totalSizeNotice([photo("a.jpg", 8), photo("b.jpg", 9)])).toBeNull();
  expect(
    totalSizeNotice([photo("a.jpg", 30), photo("b.jpg", 25)]),
  ).toMatch(/suman 55 MB y el máximo es 50 MB/);
  expect(totalSizeNotice([photo("grande.jpg", 12)])).toMatch(
    /supera los 10 MiB/,
  );
});

it("intenta pasos más agresivos y rechaza si ni así cabe", async () => {
  const compressor: jest.MockedFunction<PhotoCompressor> = jest.fn(
    async (original, options) => ({
      ...original,
      // Ni el paso más agresivo logra bajarla del límite por foto.
      size: options.quality < 0.5 ? 20 * MB : 40 * MB,
    }),
  );
  const input = [photo("enorme.jpg", 80)];

  await expect(preparePhotosForUpload(input, compressor)).rejects.toThrow(
    /Ni comprimiendo/,
  );
  // Tres pasos × una foto.
  expect(compressor).toHaveBeenCalledTimes(3);
});
