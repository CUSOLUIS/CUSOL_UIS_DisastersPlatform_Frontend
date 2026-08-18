import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useAccountNotifications } from "./useAccountNotifications";
import { resetNotificationsStoreForTests } from "./notificationsStore";
import type { MySpaceDataSource } from "../my-space/types";
import type { AdminDataSource } from "../admin/types";

afterEach(() => resetNotificationsStoreForTests());

function reportsWith(noveltyCounts: number[]): MySpaceDataSource {
  return {
    transport: "demo",
    getMyReports: jest.fn(async () => ({
      items: noveltyCounts.map((n, index) => ({
        id: `r-${index}`,
        kind: "missing_person_report" as const,
        referenceCode: `RC-${index}`,
        title: "Reporte",
        status: "under_review",
        receivedAt: "2026-08-18T10:00:00Z",
        novelties: Array.from({ length: n }, () => ({
          claimedOutcome: "found" as const,
          moderationStatus: "under_review" as const,
          receivedAt: "2026-08-18T10:00:00Z",
        })),
      })),
      total: noveltyCounts.length,
      generatedAt: "2026-08-18T10:00:00Z",
    })),
    listVolunteerAlerts: jest.fn(),
    createVolunteerAlert: jest.fn(),
    resolveVolunteerAlert: jest.fn(),
  } as unknown as MySpaceDataSource;
}

function adminWith(underReview: number, needsInformation: number): AdminDataSource {
  return {
    getOverview: jest.fn(async () => ({
      underReview,
      needsInformation,
      acceptedToday: 0,
      archived: 0,
      activeAccounts: 0,
      suspendedAccounts: 0,
      oldestPendingAt: null,
    })),
  } as unknown as AdminDataSource;
}

describe("useAccountNotifications (CHG-149)", () => {
  it("cuenta las novedades de los reportes propios y se limpia al leer", async () => {
    const { result } = renderHook(() =>
      useAccountNotifications({
        account: { id: "acc-1" },
        isSuperAdmin: false,
        mySpace: reportsWith([2, 1]),
        admin: adminWith(0, 0),
      }),
    );

    await waitFor(() => expect(result.current.count).toBe(3));
    expect(result.current.unread).toBe(true);
    expect(result.current.ownNovelties).toBe(3);

    act(() => result.current.markRead());
    expect(result.current.unread).toBe(false);
  });

  it("suma los pendientes del admin solo para super_admin", async () => {
    const { result } = renderHook(() =>
      useAccountNotifications({
        account: { id: "acc-2" },
        isSuperAdmin: true,
        mySpace: reportsWith([1]),
        admin: adminWith(4, 2),
      }),
    );

    await waitFor(() => expect(result.current.count).toBe(7));
    expect(result.current.adminPending).toBe(6);
  });

  it("sin cuenta no hay notificaciones", async () => {
    const { result } = renderHook(() =>
      useAccountNotifications({
        account: null,
        isSuperAdmin: false,
        mySpace: reportsWith([5]),
        admin: adminWith(3, 3),
      }),
    );

    await waitFor(() => expect(result.current.count).toBe(0));
    expect(result.current.unread).toBe(false);
  });
});
