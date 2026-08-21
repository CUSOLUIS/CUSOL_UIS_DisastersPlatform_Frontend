// CHG-069 — "Mi espacio": desde el desplegable bajo el nombre de la
// sesión, la persona ve sus reportes (y las novedades de estado que
// OTRAS personas aportaron a sus casos) y puede activar alertas de que
// se necesitan voluntarios en un punto: dirección resuelta con el
// servicio de mapa (o su ubicación actual), descripción y marcador
// público inmediato en el mapa operativo.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, fontFamilies } from "../../theme";
import {
  searchAddressCandidates,
  type AddressCandidate,
} from "../missing-persons/geocoding";
import {
  getGeolocationPermissionState,
  requestVisitorLocation,
} from "../operational-map/visitorLocation";
import {
  getLastKnownVisitorLocation,
  setLastKnownVisitorLocation,
} from "../operational-map/visitorPresence";
import type { GeographicCenter } from "../operational-map/webMercator";
import {
  fetchMyTransports,
  type MyTransportSummary,
} from "../transports/reportSubmission";
import { helpRequestsDataSource } from "../help-requests/dataSource";
import { HelpRequestsSection } from "../help-requests/HelpRequestsSection";
import type {
  ActiveHelpRequest,
  HelpRequestPage,
  HelpRequestsDataSource,
} from "../help-requests/types";
import { foodOffersDataSource } from "../food-offers/dataSource";
import { FoodOffersSection } from "../food-offers/FoodOffersSection";
import type {
  FoodOfferPage,
  FoodOffersDataSource,
} from "../food-offers/types";
import { damagedHomesDataSource } from "../damaged-homes/dataSource";
import { MyDamagedHomesSection } from "../damaged-homes/MyDamagedHomesSection";
import type {
  DamagedHomesDataSource,
  MyDamagedHome,
  MyDamagedHomesResponse,
} from "../damaged-homes/types";
import { mySpaceDataSource } from "./dataSource";
import type {
  MySpaceDataSource,
  MyReportsPage,
  MyReportSummary,
  VolunteerAlertPage,
} from "./types";

const REPORT_KIND_LABELS: Record<MyReportSummary["kind"], string> = {
  missing_person_report: "Persona desaparecida",
  unverified_building_report: "Edificio sin verificar",
};

const STATUS_LABELS: Record<string, string> = {
  under_review: "En revisión",
  needs_information: "Requiere información",
  accepted: "Aceptado",
  rejected: "Rechazado",
  archived: "Archivado",
  verified: "Verificado",
  unverified: "Sin verificar",
};

const OUTCOME_LABELS: Record<string, string> = {
  found: "Encontrada",
  deceased: "Fallecida",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function messageOf(caught: unknown): string {
  return caught instanceof Error
    ? caught.message
    : "No fue posible completar la operación.";
}

export function MySpacePanel({
  visible,
  onClose,
  dataSource = mySpaceDataSource,
  helpRequests = helpRequestsDataSource,
  foodOffers = foodOffersDataSource,
  damagedHomes = damagedHomesDataSource,
  geocode = searchAddressCandidates,
  locate = requestVisitorLocation,
  // CHG-191: solo se consulta la posición si el navegador YA tiene el
  // permiso concedido; nunca se provoca un diálogo por abrir el panel.
  permissionState = getGeolocationPermissionState,
  isSuperAdmin = false,
  onOpenAdmin,
  // CHG-193: ver quién atiende la solicitud propia (vista aparte).
  onOpenAttenders,
  onOpenRequestDetail,
  onOpenDamagedHomeDetail,
  // CHG-174: transportes de la cuenta (inyectable en pruebas).
  loadTransports = fetchMyTransports,
}: {
  visible: boolean;
  onClose: () => void;
  // CHG-139: acceso directo a la consola, solo para super_admin.
  isSuperAdmin?: boolean;
  onOpenAdmin?: () => void;
  onOpenAttenders?: (request: ActiveHelpRequest) => void;
  // CHG-198: la ficha completa de una solicitud que esta cuenta atiende.
  onOpenRequestDetail?: (request: ActiveHelpRequest) => void;
  // CHG-202: la ficha completa de una casita propia.
  onOpenDamagedHomeDetail?: (home: MyDamagedHome) => void;
  dataSource?: MySpaceDataSource;
  // CHG-125 / DEC-125-09 y DEC-125-11: las solicitudes activas se
  // notifican dentro del espacio personal con su acción de atender.
  helpRequests?: HelpRequestsDataSource;
  // CHG-163: las ofertas de comida activas se notifican igual.
  foodOffers?: FoodOffersDataSource;
  geocode?: (query: string) => Promise<AddressCandidate[]>;
  locate?: () => Promise<{ latitude: number; longitude: number }>;
  permissionState?: () => Promise<string>;
  loadTransports?: typeof fetchMyTransports;
  // CHG-182: casitas de la cuenta y sus comentarios sin leer.
  damagedHomes?: DamagedHomesDataSource;
}) {
  const [section, setSection] = useState<
    "reports" | "volunteers" | "help" | "food" | "transports" | "homes"
  >("reports");
  const [reports, setReports] = useState<MyReportsPage | null>(null);
  const [alerts, setAlerts] = useState<VolunteerAlertPage | null>(null);
  const [helpPage, setHelpPage] = useState<HelpRequestPage | null>(null);
  const [foodPage, setFoodPage] = useState<FoodOfferPage | null>(null);
  const [homesPage, setHomesPage] = useState<MyDamagedHomesResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        reportsPage,
        alertsPage,
        helpRequestsPage,
        foodOffersPage,
        myHomes,
      ] = await Promise.all([
        dataSource.getMyReports(),
        dataSource.listVolunteerAlerts(),
        helpRequests.listActive(),
        foodOffers.listActive(),
        // CHG-182: si la cuenta no tiene casitas, la bandeja llega
        // vacía; un fallo aquí no debe tumbar el panel entero.
        damagedHomes
          .listMine()
          .catch(() => ({ items: [], total: 0, unreadTotal: 0 })),
      ]);
      setReports(reportsPage);
      setAlerts(alertsPage);
      setHelpPage(helpRequestsPage);
      setFoodPage(foodOffersPage);
      setHomesPage(myHomes);
    } catch (caught: unknown) {
      setError(messageOf(caught));
    } finally {
      setLoading(false);
    }
  }, [dataSource, helpRequests, foodOffers, damagedHomes]);

  useEffect(() => {
    if (visible) void load();
  }, [load, visible]);

  // CHG-191: la distancia hasta cada solicitud se mide desde aquí. La
  // posición suele estar ya en memoria —el portón de la app la vigila
  // (CHG-066) y el mapa de la web la comparte al ubicarse (CHG-064)—;
  // si no está y el navegador ya tenía el permiso concedido, se pide
  // sin diálogo. Con el permiso en «prompt» o denegado no se pregunta
  // nada y la tarjeta simplemente no habla de distancia.
  const [viewerLocation, setViewerLocation] = useState<GeographicCenter | null>(
    () => getLastKnownVisitorLocation(),
  );

  useEffect(() => {
    if (!visible || viewerLocation) return;
    let cancelled = false;
    void (async () => {
      try {
        if ((await permissionState()) !== "granted") return;
        const located = await locate();
        if (cancelled) return;
        setViewerLocation(located);
        setLastKnownVisitorLocation(located);
      } catch {
        // Sin ubicación no hay distancia que mostrar; nada más falla.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, viewerLocation, permissionState, locate]);

  // CHG-190: en «Mi espacio» las solicitudes de ayuda están para
  // atenderlas, y nadie se atiende a sí mismo: la que creó esta cuenta
  // no se lista aquí. El listado del servidor sigue siendo completo
  // —el mapa, la alerta de proximidad y el contador de portada la
  // necesitan viva—; quien la esconde es esta superficie.
  const attendableHelpRequests = useMemo(
    () => (helpPage?.items ?? []).filter((request) => !request.createdByMe),
    [helpPage],
  );

  // CHG-193: las propias no se listan para atender, pero su dueña
  // necesita saber cuánta gente va en camino.
  const ownHelpRequests = useMemo(
    () => (helpPage?.items ?? []).filter((request) => request.createdByMe),
    [helpPage],
  );

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card} testID="my-space-panel">
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.overline}>CUENTA / PANEL PERSONAL</Text>
              <Text accessibilityRole="header" style={styles.title}>
                Mi espacio
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar Mi espacio"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          {/* CHG-139: la consola de administración se alcanza desde el
              espacio personal; nadie más ve este acceso. */}
          {isSuperAdmin && onOpenAdmin && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir la consola de administración"
              onPress={() => {
                onClose();
                onOpenAdmin();
              }}
              style={styles.adminButton}
            >
              <Text style={styles.adminButtonText}>
                CONSOLA DE ADMINISTRACIÓN →
              </Text>
            </Pressable>
          )}

          <View style={styles.tabs}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: section === "reports" }}
              accessibilityLabel="Mis reportes"
              onPress={() => setSection("reports")}
              style={[styles.tab, section === "reports" && styles.tabActive]}
            >
              <Text
                style={[
                  styles.tabText,
                  section === "reports" && styles.tabTextActive,
                ]}
              >
                MIS REPORTES
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: section === "volunteers" }}
              accessibilityLabel="Voluntarios"
              onPress={() => setSection("volunteers")}
              style={[styles.tab, section === "volunteers" && styles.tabActive]}
            >
              <Text
                style={[
                  styles.tabText,
                  section === "volunteers" && styles.tabTextActive,
                ]}
              >
                VOLUNTARIOS
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: section === "help" }}
              accessibilityLabel="Solicitudes de ayuda"
              onPress={() => setSection("help")}
              style={[styles.tab, section === "help" && styles.tabActive]}
            >
              <Text
                style={[
                  styles.tabText,
                  section === "help" && styles.tabTextActive,
                ]}
              >
                AYUDA
              </Text>
            </Pressable>
            {/* CHG-174: desde aquí se retoma un transporte para
                aceptar su ruta con el Centro de Acopio Local. */}
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: section === "homes" }}
              accessibilityLabel="Mis casitas"
              onPress={() => setSection("homes")}
              style={[styles.tab, section === "homes" && styles.tabActive]}
              testID="my-space-homes-tab"
            >
              <Text
                style={[
                  styles.tabText,
                  section === "homes" && styles.tabTextActive,
                ]}
              >
                CASITAS
                {homesPage && homesPage.unreadTotal > 0
                  ? ` · ${homesPage.unreadTotal}`
                  : ""}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: section === "transports" }}
              accessibilityLabel="Mis transportes"
              onPress={() => setSection("transports")}
              style={[
                styles.tab,
                section === "transports" && styles.tabActive,
              ]}
              testID="my-space-transports-tab"
            >
              <Text
                style={[
                  styles.tabText,
                  section === "transports" && styles.tabTextActive,
                ]}
              >
                TRANSPORTES
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: section === "food" }}
              accessibilityLabel="Ofertas de comida"
              onPress={() => setSection("food")}
              style={[styles.tab, section === "food" && styles.tabActive]}
            >
              <Text
                style={[
                  styles.tabText,
                  section === "food" && styles.tabTextActive,
                ]}
              >
                COMIDA
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Reintentar Mi espacio"
                  onPress={() => void load()}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryText}>REINTENTAR</Text>
                </Pressable>
              </View>
            )}
            {loading && !reports && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.cyan} />
                <Text style={styles.loadingText}>Cargando tu espacio…</Text>
              </View>
            )}

            {section === "reports" && reports && (
              <MyReportsSection page={reports} />
            )}
            {section === "volunteers" && (
              <VolunteersSection
                alerts={alerts}
                dataSource={dataSource}
                geocode={geocode}
                locate={locate}
                onChanged={() => void load()}
              />
            )}
            {/* CHG-125: solicitudes «Necesitamos ayuda» vigentes; el
                panel solo se abre con sesión, así que la acción de
                atender siempre está disponible. */}
            {section === "help" && (
              <HelpRequestsSection
                items={attendableHelpRequests}
                loading={loading && helpPage === null}
                errorMessage={null}
                isAuthenticated
                attend={(id) => helpRequests.attend(id)}
                onAttended={() => void load()}
                embedded
                title="Solicitudes de ayuda vigentes"
                viewerLocation={viewerLocation}
                ownRequests={ownHelpRequests}
                // CHG-196: eliminar la solicitud propia. Al borrarla se
                // recarga el panel, así que el contador y el VER MÁS de
                // la dueña desaparecen con ella.
                onOpenDetail={
                  onOpenRequestDetail
                    ? (request) => {
                        // Como con la lista de quién atiende: la ficha
                        // es otra pantalla, así que el panel se cierra.
                        onClose();
                        onOpenRequestDetail(request);
                      }
                    : undefined
                }
                onDeleteOwn={async (id) => {
                  await helpRequests.remove(id);
                  await load();
                }}
                onOpenAttenders={
                  onOpenAttenders
                    ? (request) => {
                        // La vista es una pantalla aparte: el panel se
                        // cierra, como con la consola de administración.
                        onClose();
                        onOpenAttenders(request);
                      }
                    : undefined
                }
              />
            )}
            {/* CHG-174: los transportes de la cuenta, con el estado de
                la aceptación de ruta y el acceso para retomarlos. */}
            {section === "transports" && (
              <MyTransportsSection loadTransports={loadTransports} />
            )}
            {/* CHG-182: las casitas de la cuenta, con el aviso de los
                comentarios que todavía no ha leído. */}
            {section === "homes" && (
              <MyDamagedHomesSection
                page={homesPage}
                dataSource={damagedHomes}
                onSeen={() => void load()}
                // CHG-202: ver la publicación entera y retirarla.
                onOpenDetail={
                  onOpenDamagedHomeDetail
                    ? (home) => {
                        onClose();
                        onOpenDamagedHomeDetail(home);
                      }
                    : undefined
                }
                onDeleted={() => void load()}
              />
            )}
            {/* CHG-163: ofertas «Ofrecer comida» vigentes — el canal de
                notificación a las cuentas (patrón DEC-125-11). */}
            {section === "food" && (
              <FoodOffersSection
                items={foodPage?.items ?? []}
                loading={loading && foodPage === null}
                errorMessage={null}
                embedded
              />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}


// CHG-174 — Los transportes de la cuenta. Sirve para retomar el viaje
// (antes solo se alcanzaba justo después de registrarlo) y para ver en
// qué punto va la aceptación de ruta con el Centro de Acopio Local.
function MyTransportsSection({
  loadTransports,
}: {
  loadTransports: typeof fetchMyTransports;
}) {
  const [items, setItems] = useState<MyTransportSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadTransports()
      .then((transports) => {
        if (active) setItems(transports);
      })
      .catch(() => {
        if (active) setError("No fue posible cargar tus transportes.");
      });
    return () => {
      active = false;
    };
  }, [loadTransports]);

  if (error) {
    return (
      <Text style={styles.emptyText} accessibilityRole="alert">
        {error}
      </Text>
    );
  }
  if (items === null) {
    return <Text style={styles.emptyText}>Cargando tus transportes…</Text>;
  }
  if (items.length === 0) {
    return (
      <Text style={styles.emptyText}>
        Todavía no has registrado ninguna mulera ni lanchera.
      </Text>
    );
  }

  return (
    <View style={styles.section} testID="my-space-transports">
      {items.map((item) => (
        <View key={item.transportId} style={styles.itemCard}>
          <Text style={styles.itemKind}>
            {item.transportKind === "mule" ? "LA MULERA" : "LA LANCHERA"}
          </Text>
          <Text style={styles.itemTitle}>
            {item.originMunicipality} → {item.destinationMunicipality}
          </Text>
          <Text style={styles.itemMeta}>
            {item.originCenterName} → {item.destinationCenterName}
          </Text>
          <Text style={styles.itemMeta}>{routeSummary(item)}</Text>
        </View>
      ))}
    </View>
  );
}

// §73: qué ve la Mulera en cada punto del proceso, sin prometer que la
// ruta completa esté aceptada.
function routeSummary(item: MyTransportSummary): string {
  if (item.routeStatus === "accepted") {
    return "Ruta aceptada con el Centro de Acopio Local.";
  }
  if (item.routeStatus === "code_issued") {
    return "El Centro de Acopio Local inició la aceptación: introduce el código que te entregó.";
  }
  if (item.localStatus === "declined" || item.receptionStatus === "declined") {
    return "Un centro declinó la solicitud: esta ruta no puede continuar.";
  }
  return "Esperando que los centros involucrados acepten la solicitud.";
}

function MyReportsSection({ page }: { page: MyReportsPage }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLead}>
        Tus reportes y su estado. Si otras personas añaden una novedad de
        estado sobre un caso tuyo, aparece aquí.
      </Text>
      {page.items.map((report) => (
        <View key={report.id} style={styles.itemCard}>
          <View style={styles.itemTop}>
            <Text style={styles.itemKind}>
              {REPORT_KIND_LABELS[report.kind]}
            </Text>
            <Text style={styles.itemStatus}>{statusLabel(report.status)}</Text>
          </View>
          <Text style={styles.itemTitle}>{report.title}</Text>
          <Text style={styles.itemMeta}>
            {report.referenceCode} · {formatDate(report.receivedAt)}
          </Text>
          {report.novelties.length > 0 && (
            <View style={styles.noveltyBox}>
              <Text style={styles.noveltyTitle}>
                NOVEDADES DE OTRAS PERSONAS ({report.novelties.length})
              </Text>
              {report.novelties.map((novelty, index) => (
                <Text key={index} style={styles.noveltyText}>
                  Reportada como{" "}
                  {OUTCOME_LABELS[novelty.claimedOutcome] ??
                    novelty.claimedOutcome}{" "}
                  · {statusLabel(novelty.moderationStatus)} ·{" "}
                  {formatDate(novelty.receivedAt)}
                </Text>
              ))}
            </View>
          )}
        </View>
      ))}
      {page.items.length === 0 && (
        <Text style={styles.emptyText}>
          Todavía no has enviado reportes con esta cuenta.
        </Text>
      )}
    </View>
  );
}

function VolunteersSection({
  alerts,
  dataSource,
  geocode,
  locate,
  onChanged,
}: {
  alerts: VolunteerAlertPage | null;
  dataSource: MySpaceDataSource;
  geocode: (query: string) => Promise<AddressCandidate[]>;
  locate: () => Promise<{ latitude: number; longitude: number }>;
  onChanged: () => void;
}) {
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [coordinates, setCoordinates] = useState<{
    latitude: number;
    longitude: number;
    label: string;
  } | null>(null);
  const [candidates, setCandidates] = useState<AddressCandidate[]>([]);
  const [locating, setLocating] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const findAddress = async () => {
    setLocating(true);
    setError(null);
    setCandidates([]);
    try {
      const found = await geocode(address);
      if (found.length === 0) {
        setError(
          "No se encontró la dirección. Ajusta el texto (incluye municipio) e intenta de nuevo.",
        );
      } else {
        setCandidates(found);
      }
    } catch (caught: unknown) {
      setError(messageOf(caught));
    } finally {
      setLocating(false);
    }
  };

  const useMyLocation = async () => {
    setLocating(true);
    setError(null);
    try {
      const located = await locate();
      setCoordinates({
        latitude: located.latitude,
        longitude: located.longitude,
        label: "Tu ubicación actual",
      });
      setCandidates([]);
    } catch (caught: unknown) {
      setError(messageOf(caught));
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (description.trim().length < 10) {
      setError("Describe la necesidad con al menos 10 caracteres.");
      return;
    }
    if (address.trim().length < 5) {
      setError("Escribe la dirección del punto donde se necesita gente.");
      return;
    }
    if (!coordinates) {
      setError(
        "Ubica el punto primero: busca la dirección en el mapa o usa tu ubicación actual.",
      );
      return;
    }
    setWorking(true);
    try {
      await dataSource.createVolunteerAlert({
        description: description.trim(),
        address: address.trim(),
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });
      setNotice(
        "Alerta activada: el punto ya aparece en el mapa operativo como “Se necesitan voluntarios”.",
      );
      setDescription("");
      setAddress("");
      setCoordinates(null);
      onChanged();
    } catch (caught: unknown) {
      setError(messageOf(caught));
    } finally {
      setWorking(false);
    }
  };

  const resolve = async (id: string) => {
    setError(null);
    try {
      await dataSource.resolveVolunteerAlert(id);
      onChanged();
    } catch (caught: unknown) {
      setError(messageOf(caught));
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLead}>
        Activa una alerta pública de que se necesita gente en un punto:
        aparece de inmediato en el mapa operativo para que quienes puedan
        ayudar acudan.
      </Text>

      <Text style={styles.fieldLabel}>DIRECCIÓN DEL PUNTO</Text>
      <TextInput
        accessibilityLabel="Dirección donde se necesitan voluntarios"
        value={address}
        onChangeText={(value) => {
          setAddress(value);
          setCoordinates(null);
        }}
        placeholder="Calle, número y municipio"
        placeholderTextColor="#536074"
        style={styles.input}
      />
      <View style={styles.locateRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buscar dirección en el mapa"
          disabled={locating}
          onPress={() => void findAddress()}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>
            {locating ? "BUSCANDO…" : "UBICAR EN EL MAPA"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Usar mi ubicación actual"
          disabled={locating}
          onPress={() => void useMyLocation()}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>MI UBICACIÓN</Text>
        </Pressable>
      </View>

      {candidates.length > 0 && (
        <View style={styles.candidateList}>
          {candidates.map((candidate, index) => (
            <Pressable
              key={index}
              accessibilityRole="button"
              accessibilityLabel={`Elegir ${candidate.label}`}
              onPress={() => {
                setCoordinates({
                  latitude: candidate.latitude,
                  longitude: candidate.longitude,
                  label: candidate.label,
                });
                setCandidates([]);
              }}
              style={styles.candidateItem}
            >
              <Text style={styles.candidateText}>{candidate.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {coordinates && (
        <View style={styles.coordinateBox} testID="volunteer-coordinates">
          <Text style={styles.coordinateText}>
            Punto elegido: {coordinates.label} (
            {coordinates.latitude.toFixed(5)},{" "}
            {coordinates.longitude.toFixed(5)})
          </Text>
        </View>
      )}

      <Text style={styles.fieldLabel}>DESCRIPCIÓN DE LA NECESIDAD</Text>
      <TextInput
        accessibilityLabel="Descripción de la necesidad de voluntarios"
        value={description}
        onChangeText={setDescription}
        placeholder="Qué se necesita hacer, cuánta gente y desde cuándo"
        placeholderTextColor="#536074"
        multiline
        style={[styles.input, styles.inputMultiline]}
      />

      {error && <Text style={styles.errorText}>{error}</Text>}
      {notice && <Text style={styles.noticeText}>{notice}</Text>}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Activar alerta de voluntarios"
        disabled={working}
        onPress={() => void submit()}
        style={styles.primaryButton}
      >
        {working ? (
          <ActivityIndicator size="small" color={colors.canvas} />
        ) : (
          <Text style={styles.primaryButtonText}>
            ACTIVAR ALERTA DE VOLUNTARIOS
          </Text>
        )}
      </Pressable>

      <Text style={styles.subheading}>TUS ALERTAS</Text>
      {alerts?.items.map((alert) => (
        <View key={alert.id} style={styles.itemCard}>
          <View style={styles.itemTop}>
            <Text style={styles.itemKind}>
              {alert.status === "active" ? "ACTIVA" : "RESUELTA"}
            </Text>
            <Text style={styles.itemMeta}>{formatDate(alert.createdAt)}</Text>
          </View>
          <Text style={styles.itemTitle}>{alert.address}</Text>
          <Text style={styles.itemBody}>{alert.description}</Text>
          {alert.status === "active" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Marcar resuelta la alerta de ${alert.address}`}
              onPress={() => void resolve(alert.id)}
              style={styles.resolveButton}
            >
              <Text style={styles.resolveButtonText}>
                YA NO SE NECESITA · MARCAR RESUELTA
              </Text>
            </Pressable>
          )}
        </View>
      ))}
      {alerts?.items.length === 0 && (
        <Text style={styles.emptyText}>No has activado alertas todavía.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // CHG-139: acceso del super_admin a la consola.
  adminButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.4)",
    borderRadius: 8,
    backgroundColor: "rgba(81,229,255,0.08)",
  },
  adminButtonText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.9,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(3, 6, 12, 0.86)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 640,
    maxHeight: "92%",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 18,
    padding: 20,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  overline: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    letterSpacing: 1.4,
  },
  title: { color: colors.ink, fontSize: 24, fontWeight: "800" },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
  },
  closeText: { color: colors.ink, fontSize: 20, lineHeight: 22 },
  tabs: { flexDirection: "row", gap: 8 },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  tabActive: {
    borderColor: colors.cyan,
    backgroundColor: "rgba(81, 229, 255, 0.08)",
  },
  tabText: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  tabTextActive: { color: colors.cyan },
  scrollContent: { gap: 12, paddingBottom: 8 },
  section: { gap: 10 },
  sectionLead: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  itemCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.panelSoft,
    padding: 14,
    gap: 6,
  },
  itemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  itemKind: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  itemStatus: {
    color: colors.missing,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  itemTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  itemBody: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  itemMeta: { color: colors.inkDim, fontSize: 11 },
  noveltyBox: {
    marginTop: 4,
    borderLeftWidth: 2,
    borderLeftColor: colors.missing,
    paddingLeft: 10,
    gap: 3,
  },
  noveltyTitle: {
    color: colors.missing,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  noveltyText: { color: colors.inkSoft, fontSize: 12, lineHeight: 18 },
  emptyText: { color: colors.inkDim, fontSize: 13 },
  fieldLabel: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    color: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "rgba(5, 9, 17, 0.65)",
  },
  inputMultiline: { minHeight: 84, textAlignVertical: "top" },
  locateRow: { flexDirection: "row", gap: 8 },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 10,
  },
  secondaryButtonText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  candidateList: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    overflow: "hidden",
  },
  candidateItem: {
    padding: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  candidateText: { color: colors.ink, fontSize: 13 },
  coordinateBox: {
    borderWidth: 1,
    borderColor: "rgba(67, 231, 173, 0.4)",
    backgroundColor: "rgba(67, 231, 173, 0.07)",
    borderRadius: 10,
    padding: 10,
  },
  coordinateText: { color: colors.alive, fontSize: 12, lineHeight: 18 },
  errorBox: { gap: 8 },
  errorText: { color: colors.reported, fontSize: 13, lineHeight: 19 },
  noticeText: { color: colors.alive, fontSize: 13, lineHeight: 19 },
  retryButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    fontWeight: "800",
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  loadingText: { color: colors.inkSoft, fontSize: 13 },
  primaryButton: {
    marginTop: 4,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: colors.cyan,
  },
  primaryButtonText: {
    color: "#06101a",
    fontFamily: fontFamilies.mono,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  subheading: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 8,
  },
  resolveButton: {
    alignSelf: "flex-start",
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(67, 231, 173, 0.5)",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resolveButtonText: {
    color: colors.alive,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
});
