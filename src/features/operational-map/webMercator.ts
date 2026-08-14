export const TILE_SIZE = 256;
// Límite del servidor público de teselas de OpenStreetMap (z19 ≈ edificaciones).
export const OSM_MAX_ZOOM = 19;

export interface GeographicCenter {
  latitude: number;
  longitude: number;
}

export const COLOMBIA_CENTER: GeographicCenter = {
  latitude: 4.65,
  longitude: -74.25,
};

export const COLOMBIA_BOUNDS = {
  west: -82,
  south: -4.5,
  east: -66.5,
  north: 13.5,
} as const;

export interface CanvasSize {
  width: number;
  height: number;
}

export interface TilePlacement {
  key: string;
  uri: string;
  left: number;
  top: number;
}

export function buildTilePlacements(
  size: CanvasSize,
  zoom: number,
  center: GeographicCenter,
): TilePlacement[] {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const centerX = longitudeToWorldX(center.longitude, worldSize);
  const centerY = latitudeToWorldY(center.latitude, worldSize);
  const viewportLeft = centerX - size.width / 2;
  const viewportTop = centerY - size.height / 2;
  const startX = Math.floor(viewportLeft / TILE_SIZE);
  const endX = Math.floor((viewportLeft + size.width) / TILE_SIZE);
  const startY = Math.max(0, Math.floor(viewportTop / TILE_SIZE));
  const endY = Math.min(2 ** zoom - 1, Math.floor((viewportTop + size.height) / TILE_SIZE));
  const placements: TilePlacement[] = [];

  for (let tileX = startX; tileX <= endX; tileX += 1) {
    const wrappedX = ((tileX % 2 ** zoom) + 2 ** zoom) % 2 ** zoom;
    for (let tileY = startY; tileY <= endY; tileY += 1) {
      placements.push({
        key: `${zoom}-${tileX}-${tileY}`,
        uri: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`,
        left: tileX * TILE_SIZE - viewportLeft,
        top: tileY * TILE_SIZE - viewportTop,
      });
    }
  }

  return placements;
}

export function longitudeToWorldX(longitude: number, worldSize: number): number {
  return ((longitude + 180) / 360) * worldSize;
}

export function worldXToLongitude(worldX: number, worldSize: number): number {
  return (worldX / worldSize) * 360 - 180;
}

export function latitudeToWorldY(latitude: number, worldSize: number): number {
  const boundedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const radians = (boundedLatitude * Math.PI) / 180;
  const mercator = Math.log(Math.tan(Math.PI / 4 + radians / 2));
  return (0.5 - mercator / (2 * Math.PI)) * worldSize;
}

export function worldYToLatitude(worldY: number, worldSize: number): number {
  const mercator = Math.PI * (1 - (2 * worldY) / worldSize);
  return (Math.atan(Math.sinh(mercator)) * 180) / Math.PI;
}

export function viewportBounds(
  size: CanvasSize,
  zoom: number,
  center: GeographicCenter,
) {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const centerX = longitudeToWorldX(center.longitude, worldSize);
  const centerY = latitudeToWorldY(center.latitude, worldSize);
  const west = Math.max(
    -180,
    worldXToLongitude(centerX - size.width / 2, worldSize),
  );
  const east = Math.min(
    180,
    worldXToLongitude(centerX + size.width / 2, worldSize),
  );
  const north = Math.min(
    85.05112878,
    worldYToLatitude(centerY - size.height / 2, worldSize),
  );
  const south = Math.max(
    -85.05112878,
    worldYToLatitude(centerY + size.height / 2, worldSize),
  );

  return { west, south, east, north };
}

export function panGeographicCenter(
  center: GeographicCenter,
  zoom: number,
  deltaX: number,
  deltaY: number,
): GeographicCenter {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const nextWorldX =
    (longitudeToWorldX(center.longitude, worldSize) - deltaX + worldSize) %
    worldSize;
  const nextWorldY = Math.max(
    0,
    Math.min(worldSize, latitudeToWorldY(center.latitude, worldSize) - deltaY),
  );

  return {
    longitude: (nextWorldX / worldSize) * 360 - 180,
    latitude: worldYToLatitude(nextWorldY, worldSize),
  };
}

// Desplaza un punto geográfico siguiendo un arrastre en píxeles de pantalla.
export function movePointByScreenDelta(
  point: GeographicCenter,
  zoom: number,
  deltaX: number,
  deltaY: number,
): GeographicCenter {
  return panGeographicCenter(point, zoom, -deltaX, -deltaY);
}
