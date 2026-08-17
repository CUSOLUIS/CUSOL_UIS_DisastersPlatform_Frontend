import { demoHelpRequestsDataSource } from "./dataSource";

describe("helpRequestsDataSource demo (CHG-125)", () => {
  it("lista solicitudes vigentes con conteo de atendedores", async () => {
    const page = await demoHelpRequestsDataSource.listActive();
    expect(page.total).toBeGreaterThan(0);
    expect(page.items.length).toBe(page.total);
    page.items.forEach((request) => {
      expect(Date.parse(request.expiresAt)).toBeGreaterThan(Date.now());
      expect(request.attendersCount).toBeGreaterThanOrEqual(0);
      expect(typeof request.attendedByMe).toBe("boolean");
    });
  });

  it("atender es idempotente: repetir no duplica el conteo (DEC-125-03)", async () => {
    const page = await demoHelpRequestsDataSource.listActive();
    const target = page.items[0];
    const first = await demoHelpRequestsDataSource.attend(target.id);
    expect(first.attending).toBe(true);
    expect(first.attendersCount).toBe(target.attendersCount + 1);

    const second = await demoHelpRequestsDataSource.attend(target.id);
    expect(second.attending).toBe(true);
    expect(second.attendersCount).toBe(first.attendersCount);

    const refreshed = await demoHelpRequestsDataSource.listActive();
    const refreshedTarget = refreshed.items.find(
      (item) => item.id === target.id,
    );
    expect(refreshedTarget?.attendedByMe).toBe(true);
    expect(refreshedTarget?.attendersCount).toBe(first.attendersCount);
  });

  it("rechaza atender una solicitud inexistente", async () => {
    await expect(
      demoHelpRequestsDataSource.attend("00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow("La solicitud no existe o ya expiró.");
  });
});
