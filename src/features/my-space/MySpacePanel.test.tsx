/**
 * CHG-069 — "Mi espacio": reportes propios con novedades de terceros y
 * alertas de voluntariado con dirección resuelta en el mapa.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { MySpacePanel } from "./MySpacePanel";
import type { MySpaceDataSource } from "./types";
import type { HelpRequestsDataSource } from "../help-requests/types";
import { setLastKnownVisitorLocation } from "../operational-map/visitorPresence";

// CHG-191: la última posición conocida vive en memoria del módulo y
// sobrevive entre pruebas; se limpia para que cada caso empiece igual
// que una pestaña recién abierta.
beforeEach(() => setLastKnownVisitorLocation(null));

function createDataSource(): MySpaceDataSource & {
  createVolunteerAlert: jest.Mock;
  resolveVolunteerAlert: jest.Mock;
} {
  return {
    transport: "demo",
    getMyReports: jest.fn().mockResolvedValue({
      items: [
        {
          id: "10000000-0000-4000-8000-000000000001",
          kind: "missing_person_report",
          referenceCode: "MP-2026-ABCD1234",
          title: "Persona De Prueba",
          status: "under_review",
          receivedAt: "2026-08-13T10:00:00Z",
          novelties: [
            {
              claimedOutcome: "found",
              moderationStatus: "under_review",
              receivedAt: "2026-08-14T09:30:00Z",
            },
          ],
        },
      ],
      total: 1,
      generatedAt: "2026-08-15T12:00:00Z",
    }),
    listVolunteerAlerts: jest.fn().mockResolvedValue({
      items: [
        {
          id: "20000000-0000-4000-8000-000000000001",
          description: "Clasificar donaciones en el acopio.",
          address: "Carrera 27 #9-30, Bucaramanga",
          latitude: 7.1398,
          longitude: -73.1211,
          status: "active",
          createdAt: "2026-08-14T15:00:00Z",
          updatedAt: "2026-08-14T15:00:00Z",
        },
      ],
      total: 1,
      generatedAt: "2026-08-15T12:00:00Z",
    }),
    createVolunteerAlert: jest.fn().mockResolvedValue({
      id: "30000000-0000-4000-8000-000000000001",
      description: "Se necesita gente para remover escombros del sector.",
      address: "Calle 45 #27-08, Bucaramanga",
      latitude: 7.1193,
      longitude: -73.1227,
      status: "active",
      createdAt: "2026-08-15T12:05:00Z",
      updatedAt: "2026-08-15T12:05:00Z",
    }),
    resolveVolunteerAlert: jest.fn().mockResolvedValue({
      id: "20000000-0000-4000-8000-000000000001",
      description: "Clasificar donaciones en el acopio.",
      address: "Carrera 27 #9-30, Bucaramanga",
      latitude: 7.1398,
      longitude: -73.1211,
      status: "resolved",
      createdAt: "2026-08-14T15:00:00Z",
      updatedAt: "2026-08-15T12:10:00Z",
    }),
  };
}

const geocode = jest.fn().mockResolvedValue([
  {
    label: "Calle 45 #27-08, Bucaramanga, Santander",
    latitude: 7.1193,
    longitude: -73.1227,
  },
]);

it("muestra los reportes propios con las novedades de otras personas", async () => {
  render(
    <MySpacePanel
      visible
      onClose={jest.fn()}
      dataSource={createDataSource()}
      geocode={geocode}
    />,
  );

  expect(await screen.findByText("Persona De Prueba")).toBeTruthy();
  expect(screen.getByText(/MP-2026-ABCD1234/)).toBeTruthy();
  expect(screen.getByText("NOVEDADES DE OTRAS PERSONAS (1)")).toBeTruthy();
  expect(screen.getByText(/Reportada como Encontrada/)).toBeTruthy();
});

it("activa una alerta de voluntarios con dirección ubicada en el mapa", async () => {
  const dataSource = createDataSource();
  render(
    <MySpacePanel
      visible
      onClose={jest.fn()}
      dataSource={dataSource}
      geocode={geocode}
    />,
  );

  fireEvent.press(await screen.findByRole("tab", { name: "Voluntarios" }));

  fireEvent.changeText(
    screen.getByLabelText("Dirección donde se necesitan voluntarios"),
    "Calle 45 #27-08, Bucaramanga",
  );
  fireEvent.press(
    screen.getByRole("button", { name: "Buscar dirección en el mapa" }),
  );
  fireEvent.press(
    await screen.findByRole("button", {
      name: /Elegir Calle 45 #27-08/,
    }),
  );
  expect(screen.getByTestId("volunteer-coordinates")).toBeTruthy();

  fireEvent.changeText(
    screen.getByLabelText("Descripción de la necesidad de voluntarios"),
    "Se necesita gente para remover escombros del sector.",
  );
  fireEvent.press(
    screen.getByRole("button", { name: "Activar alerta de voluntarios" }),
  );

  await waitFor(() =>
    expect(dataSource.createVolunteerAlert).toHaveBeenCalledWith({
      description: "Se necesita gente para remover escombros del sector.",
      address: "Calle 45 #27-08, Bucaramanga",
      latitude: 7.1193,
      longitude: -73.1227,
    }),
  );
  expect(await screen.findByText(/Alerta activada/)).toBeTruthy();
});

it("no envía la alerta sin coordenadas resueltas", async () => {
  const dataSource = createDataSource();
  render(
    <MySpacePanel
      visible
      onClose={jest.fn()}
      dataSource={dataSource}
      geocode={geocode}
    />,
  );

  fireEvent.press(await screen.findByRole("tab", { name: "Voluntarios" }));
  fireEvent.changeText(
    screen.getByLabelText("Dirección donde se necesitan voluntarios"),
    "Calle 45 #27-08, Bucaramanga",
  );
  fireEvent.changeText(
    screen.getByLabelText("Descripción de la necesidad de voluntarios"),
    "Se necesita gente para remover escombros del sector.",
  );
  fireEvent.press(
    screen.getByRole("button", { name: "Activar alerta de voluntarios" }),
  );

  expect(await screen.findByText(/Ubica el punto primero/)).toBeTruthy();
  expect(dataSource.createVolunteerAlert).not.toHaveBeenCalled();
});

it("marca resuelta una alerta activa", async () => {
  const dataSource = createDataSource();
  render(
    <MySpacePanel
      visible
      onClose={jest.fn()}
      dataSource={dataSource}
      geocode={geocode}
    />,
  );

  fireEvent.press(await screen.findByRole("tab", { name: "Voluntarios" }));
  fireEvent.press(
    await screen.findByRole("button", {
      name: /Marcar resuelta la alerta de Carrera 27/,
    }),
  );

  await waitFor(() =>
    expect(dataSource.resolveVolunteerAlert).toHaveBeenCalledWith(
      "20000000-0000-4000-8000-000000000001",
    ),
  );
});

// CHG-139 — El acceso a la consola vive en Mi espacio, solo para
// super_admin; cerrarlo navega a /administracion.
it("muestra la consola de administración solo al super_admin", async () => {
  const onOpenAdmin = jest.fn();
  const onClose = jest.fn();
  render(
    <MySpacePanel
      visible
      onClose={onClose}
      dataSource={createDataSource()}
      geocode={geocode}
      isSuperAdmin
      onOpenAdmin={onOpenAdmin}
    />,
  );

  fireEvent.press(
    await screen.findByLabelText("Abrir la consola de administración"),
  );
  expect(onClose).toHaveBeenCalled();
  expect(onOpenAdmin).toHaveBeenCalledTimes(1);
});

it("sin rol super_admin no existe el acceso a la consola", async () => {
  render(
    <MySpacePanel
      visible
      onClose={jest.fn()}
      dataSource={createDataSource()}
      geocode={geocode}
      onOpenAdmin={jest.fn()}
    />,
  );

  expect(await screen.findByText("Persona De Prueba")).toBeTruthy();
  expect(
    screen.queryByLabelText("Abrir la consola de administración"),
  ).toBeNull();
});

// CHG-190 — En «Mi espacio» las solicitudes de ayuda están para
// atenderlas, así que la propia no se ofrece: nadie se atiende a sí
// mismo. El servidor las sigue devolviendo todas (el mapa las necesita);
// esconderlas es cosa de esta superficie.
function helpRequestsWith(
  items: { id: string; address: string; createdByMe?: boolean }[],
): HelpRequestsDataSource {
  return {
    transport: "demo",
    listActive: jest.fn().mockResolvedValue({
      items: items.map((item) => ({
        id: item.id,
        description: `Necesitamos ayuda en ${item.address}.`,
        address: item.address,
        latitude: 7.12,
        longitude: -73.12,
        notificationRadiusKm: null,
        createdAt: "2026-08-21T10:00:00Z",
        expiresAt: "2126-08-21T10:00:00Z",
        attendersCount: 0,
        attendedByMe: false,
        createdByMe: item.createdByMe ?? false,
        photoUrl: null,
      })),
      total: items.length,
      generatedAt: "2026-08-21T10:05:00Z",
    }),
    attend: jest.fn(),
    remove: jest.fn().mockResolvedValue(undefined),
    listAttenders: jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      generatedAt: "2026-08-21T10:05:00Z",
    }),
  };
}

it("no ofrece para atender la solicitud de ayuda creada por la propia cuenta", async () => {
  render(
    <MySpacePanel
      visible
      onClose={jest.fn()}
      dataSource={createDataSource()}
      helpRequests={helpRequestsWith([
        {
          id: "40000000-0000-4000-8000-000000000001",
          address: "Calle 33, Bucaramanga",
          createdByMe: true,
        },
        {
          id: "40000000-0000-4000-8000-000000000002",
          address: "Vereda El Salado, Piedecuesta",
        },
      ])}
      geocode={geocode}
    />,
  );

  fireEvent.press(await screen.findByRole("tab", { name: "Solicitudes de ayuda" }));

  expect(
    await screen.findByTestId("help-request-item-40000000-0000-4000-8000-000000000002"),
  ).toBeTruthy();
  expect(
    screen.queryByTestId("help-request-item-40000000-0000-4000-8000-000000000001"),
  ).toBeNull();
  // CHG-193: teniendo solicitud propia, la píldora deja de contar
  // vigentes y dice cuánta gente la está atendiendo.
  expect(screen.getByText("NADIE ATIENDE TU SOLICITUD AÚN")).toBeTruthy();
});

it("si todas las solicitudes vigentes son propias, la pestaña queda vacía sin error", async () => {
  render(
    <MySpacePanel
      visible
      onClose={jest.fn()}
      dataSource={createDataSource()}
      helpRequests={helpRequestsWith([
        {
          id: "40000000-0000-4000-8000-000000000003",
          address: "Calle 33, Bucaramanga",
          createdByMe: true,
        },
      ])}
      geocode={geocode}
    />,
  );

  fireEvent.press(await screen.findByRole("tab", { name: "Solicitudes de ayuda" }));

  expect(
    await screen.findByText(
      "No hay solicitudes de ayuda vigentes en este momento.",
    ),
  ).toBeTruthy();
});

// CHG-191 — La distancia hasta la solicitud, sin provocar nunca un
// diálogo de permiso por abrir el panel.
it("dice a qué distancia queda la solicitud cuando el navegador ya tenía permiso", async () => {
  const locate = jest
    .fn()
    .mockResolvedValue({ latitude: 7.1299, longitude: -73.12 });

  render(
    <MySpacePanel
      visible
      onClose={jest.fn()}
      dataSource={createDataSource()}
      helpRequests={helpRequestsWith([
        {
          id: "40000000-0000-4000-8000-000000000004",
          address: "Vereda El Salado, Piedecuesta",
        },
      ])}
      geocode={geocode}
      locate={locate}
      permissionState={jest.fn().mockResolvedValue("granted")}
    />,
  );

  fireEvent.press(await screen.findByRole("tab", { name: "Solicitudes de ayuda" }));

  expect(
    await screen.findByTestId(
      "help-request-distance-40000000-0000-4000-8000-000000000004",
    ),
  ).toBeTruthy();
  expect(locate).toHaveBeenCalled();
});

it("con el permiso sin conceder no pide la ubicación ni habla de distancia", async () => {
  const locate = jest.fn();

  render(
    <MySpacePanel
      visible
      onClose={jest.fn()}
      dataSource={createDataSource()}
      helpRequests={helpRequestsWith([
        {
          id: "40000000-0000-4000-8000-000000000005",
          address: "Vereda El Salado, Piedecuesta",
        },
      ])}
      geocode={geocode}
      locate={locate}
      permissionState={jest.fn().mockResolvedValue("prompt")}
    />,
  );

  fireEvent.press(await screen.findByRole("tab", { name: "Solicitudes de ayuda" }));

  expect(
    await screen.findByTestId("help-request-item-40000000-0000-4000-8000-000000000005"),
  ).toBeTruthy();
  await waitFor(() => expect(locate).not.toHaveBeenCalled());
  expect(screen.queryByText(/DE TI$/)).toBeNull();
});

// CHG-193 — El paso a la vista de quién atiende: el panel es un modal,
// así que se cierra antes de navegar (igual que la consola de admin).
it("desde la píldora se abre quién atiende y se cierra el panel", async () => {
  const onClose = jest.fn();
  const onOpenAttenders = jest.fn();
  render(
    <MySpacePanel
      visible
      onClose={onClose}
      dataSource={createDataSource()}
      helpRequests={helpRequestsWith([
        {
          id: "40000000-0000-4000-8000-000000000006",
          address: "Calle 33, Bucaramanga",
          createdByMe: true,
        },
      ])}
      geocode={geocode}
      onOpenAttenders={onOpenAttenders}
    />,
  );

  fireEvent.press(await screen.findByRole("tab", { name: "Solicitudes de ayuda" }));
  fireEvent.press(
    await screen.findByRole("button", {
      name: "Ver quién atiende tu solicitud",
    }),
  );

  expect(onClose).toHaveBeenCalled();
  expect(onOpenAttenders).toHaveBeenCalledWith(
    expect.objectContaining({ id: "40000000-0000-4000-8000-000000000006" }),
  );
});

