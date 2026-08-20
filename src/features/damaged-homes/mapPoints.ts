import type { OperationalMapPoint } from "../operational-map/types";
import type { ActiveDamagedHome } from "./types";

export const DAMAGED_HOME_POINT_PREFIX = "damaged_home:";

// CHG-182 — La casita dejó de proyectarse desde la tabla compartida del
// mapa (CHG-162) y ahora se fusiona en cliente, como las solicitudes de
// ayuda y las ofertas de comida: necesita llevar fotos, personas, medio
// de ayuda y puntuación, y eso no cabe en un punto operativo común.
export function damagedHomesToMapPoints(
  homes: ActiveDamagedHome[],
): OperationalMapPoint[] {
  // Las casitas sin coordenadas (llegaron solo con dirección escrita)
  // no se dibujan; siguen visibles en «Mi espacio».
  return homes
    .filter(
      (
        home,
      ): home is ActiveDamagedHome & {
        latitude: number;
        longitude: number;
      } => home.latitude !== null && home.longitude !== null,
    )
    .map((home) => ({
      id: `${DAMAGED_HOME_POINT_PREFIX}${home.id}`,
      category: "damaged_home",
      title: "Casa destruida",
      locationLabel: home.address,
      latitude: home.latitude,
      longitude: home.longitude,
      coordinatePrecision: "exact" as const,
      verificationStatus: "unverified" as const,
      relatedDisasterId: null,
      description: home.description,
      source: {
        name: "Reporte de la familia",
        sourceType: "citizen" as const,
        url: null,
      },
      updatedAt: home.updatedAt,
      // La puntuación viaja con la casita, así el popup pinta la línea
      // de estrellas igual que en un centro de acopio.
      commentRatingAverage: home.commentRatingAverage ?? null,
      commentRatingCount: home.commentRatingCount ?? 0,
    }));
}

export function damagedHomeIdFromPointId(pointId: string): string | null {
  return pointId.startsWith(DAMAGED_HOME_POINT_PREFIX)
    ? pointId.slice(DAMAGED_HOME_POINT_PREFIX.length)
    : null;
}
