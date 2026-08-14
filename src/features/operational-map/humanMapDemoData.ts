import type { HumanStatus } from "../human-impact/types";
import type {
  HumanMapCluster,
  HumanMapOverview,
  HumanMapQuery,
  HumanMapStatusCounts,
} from "./types";

type DemoClusterRow = readonly [
  id: string,
  latitude: number,
  longitude: number,
  count: number,
  missing: number,
  reportedDeceased: number,
  confirmedAlive: number,
  confirmedDeceased: number,
  west: number,
  south: number,
  east: number,
  north: number,
];

// Snapshot nacional de la semilla CHG-016. Los valores se mantienen locales
// únicamente para trabajar sin backend; la aplicación usa la API por defecto.
const demoClusterRows: DemoClusterRow[] = [
  ["z5:x37:y33", 4.59409, -74.52618, 650, 200, 50, 350, 50, -75.71547, 2.90338, -73.34823, 5.55454],
  ["z5:x37:y35", 10.33577, -75.13428, 384, 134, 100, 100, 50, -75.90537, 8.72328, -74.1759, 11.24902],
  ["z5:x37:y34", 6.42417, -75.0798, 252, 73, 51, 77, 51, -75.6298, 6.1944, -73.1254, 7.14906],
  ["z5:x36:y33", 3.45151, -76.53226, 150, 50, 0, 50, 50, -76.57967, 3.40165, -76.4838, 3.50055],
  ["z5:x38:y34", 7.46556, -72.83373, 110, 82, 1, 26, 1, -73.12426, 6.8649, -72.48036, 7.92348],
  ["z5:x36:y32", 1.82911, -76.94803, 100, 0, 50, 0, 50, -77.30336, 1.18865, -76.59724, 2.4646],
  ["z5:x34:y36", 12.58482, -81.69986, 50, 50, 0, 0, 0, -81.70887, 12.57495, -81.69064, 12.59448],
  ["z5:x36:y34", 5.69466, -76.6616, 50, 0, 0, 50, 0, -76.6799, 5.67532, -76.64345, 5.714],
  ["z5:x37:y32", 1.61389, -75.60624, 50, 0, 0, 0, 50, -75.62947, 1.58955, -75.5839, 1.63837],
  ["z5:x38:y32", 2.57294, -72.64635, 50, 0, 0, 50, 0, -72.66897, 2.5479, -72.62337, 2.59742],
  ["z5:x38:y33", 5.33838, -72.39575, 50, 0, 0, 50, 0, -72.41873, 5.31335, -72.37313, 5.36217],
  ["z5:x38:y36", 11.53908, -72.90492, 50, 0, 0, 50, 0, -72.92833, 11.51425, -72.88277, 11.56307],
  ["z5:x39:y30", -4.21549, -69.93959, 50, 0, 50, 0, 0, -69.95732, -4.23524, -69.92087, -4.19562],
  ["z5:x37:y36", 11.25772, -74.19785, 16, 16, 0, 0, 0, -74.22143, 11.2502, -74.17597, 11.26482],
];

const demoClusters: HumanMapCluster[] = demoClusterRows.map(
  ([
    id,
    latitude,
    longitude,
    count,
    missing,
    reportedDeceased,
    confirmedAlive,
    confirmedDeceased,
    west,
    south,
    east,
    north,
  ]) => ({
    kind: "cluster",
    id,
    latitude,
    longitude,
    count,
    statusCounts: {
      missing,
      reportedDeceased,
      confirmedAlive,
      confirmedDeceased,
    },
    bounds: { west, south, east, north },
  }),
);

const statusCountKeys = {
  missing: "missing",
  reported_deceased: "reportedDeceased",
  confirmed_alive: "confirmedAlive",
  confirmed_deceased: "confirmedDeceased",
} as const satisfies Record<HumanStatus, keyof HumanMapStatusCounts>;

export function getHumanMapDemoOverview(
  query: HumanMapQuery,
): HumanMapOverview {
  const clusters = demoClusters.flatMap((cluster) => {
    if (
      cluster.longitude < query.bounds.west ||
      cluster.longitude > query.bounds.east ||
      cluster.latitude < query.bounds.south ||
      cluster.latitude > query.bounds.north
    ) {
      return [];
    }

    const statusCounts: HumanMapStatusCounts = {
      missing: 0,
      reportedDeceased: 0,
      confirmedAlive: 0,
      confirmedDeceased: 0,
    };

    query.statuses.forEach((status) => {
      const key = statusCountKeys[status];
      statusCounts[key] = cluster.statusCounts[key];
    });

    const count = Object.values(statusCounts).reduce(
      (total, value) => total + value,
      0,
    );
    return count >= 2 ? [{ ...cluster, count, statusCounts }] : [];
  });
  const totalMapped = clusters.reduce(
    (total, cluster) => total + cluster.count,
    0,
  );

  return {
    features: clusters,
    totalMatched: totalMapped,
    totalMapped,
    unmappedCount: 0,
    returnedFeatures: clusters.length,
    nextCursor: null,
    generatedAt: "2026-08-13T21:24:46.000Z",
    dataClassification: "demonstrative",
  };
}
