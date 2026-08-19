import type { OperationalMapPoint } from "../operational-map/types";
import { transportKindLabel, type ActiveTransport } from "./types";

// CHG-171 — Los viajes de La Mulera/La Lanchera se fusionan en cliente
// como puntos del mapa (patrón DEC-125-10): el marcador vive en la
// última posición del GPS del conductor (o en el centro de origen
// mientras no reporte) y el rastro se dibuja como puntos no
// interactivos detrás del marcador.

export const TRANSPORT_POINT_PREFIX = "transport:";

export function transportIdFromPointId(pointId: string): string | null {
  return pointId.startsWith(TRANSPORT_POINT_PREFIX)
    ? pointId.slice(TRANSPORT_POINT_PREFIX.length)
    : null;
}

function markerPosition(
  transport: ActiveTransport,
): { latitude: number; longitude: number } | null {
  if (transport.lastLatitude !== null && transport.lastLongitude !== null) {
    return {
      latitude: transport.lastLatitude,
      longitude: transport.lastLongitude,
    };
  }
  if (
    transport.originLatitude !== null &&
    transport.originLongitude !== null
  ) {
    return {
      latitude: transport.originLatitude,
      longitude: transport.originLongitude,
    };
  }
  return null;
}

export function transportsToMapPoints(
  transports: ActiveTransport[],
): OperationalMapPoint[] {
  return transports.flatMap((transport) => {
    const position = markerPosition(transport);
    if (!position) return [];
    return [
      {
        id: `${TRANSPORT_POINT_PREFIX}${transport.id}`,
        category: "humanitarian_transport" as const,
        title: `${transportKindLabel[transport.kind]} en ruta`,
        locationLabel: `${transport.originMunicipality} → ${transport.destinationMunicipality}`,
        latitude: position.latitude,
        longitude: position.longitude,
        coordinatePrecision: "exact" as const,
        verificationStatus: "unverified" as const,
        relatedDisasterId: null,
        description: transport.suppliesSummary,
        source: {
          name: "Registro con cuenta",
          sourceType: "citizen" as const,
          url: null,
        },
        updatedAt: transport.lastPositionAt ?? transport.createdAt,
      },
    ];
  });
}

// Rastro por viaje: los últimos puntos del GPS, aligerados para no
// saturar el lienzo (el feed ya llega con máximo 200 por viaje).
const TRAIL_POINTS_PER_TRANSPORT = 40;

export interface TransportTrailDot {
  id: string;
  latitude: number;
  longitude: number;
}

export function transportsToTrailDots(
  transports: ActiveTransport[],
): TransportTrailDot[] {
  return transports.flatMap((transport) => {
    const recent = transport.trail.slice(-TRAIL_POINTS_PER_TRANSPORT);
    return recent.map((point, index) => ({
      id: `trail:${transport.id}:${index}`,
      latitude: point.latitude,
      longitude: point.longitude,
    }));
  });
}
