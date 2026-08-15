import { useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Header } from "../features/human-impact/HumanImpactDashboard";
import { authDataSource } from "../features/auth/dataSource";
import {
  useSessionAccount,
  type SessionAccountSource,
  type SessionAccountState,
} from "../features/auth/useSessionAccount";
import { colors } from "../theme";

// CHG-097 — Las rutas internas (formularios de reporte) montaban solo
// una barra con "VOLVER" y quedaban como una pantalla suelta, sin los
// logos, el nombre de la plataforma ni la sesión activa. Aquí se monta
// el mismo encabezado de la portada, así que la navegación y la marca
// son las mismas en toda la aplicación.
//
// Diferencia con la portada: allí los enlaces desplazan a secciones de
// la misma página; aquí no existen esas secciones, así que navegan de
// vuelta a la portada, que es donde viven.

// Mismos cortes que la portada, para que el encabezado se comporte
// igual a un ancho dado.
// Cuando la vista anfitriona ya resolvió la sesión, el hook interno
// se apunta a una fuente que nunca consulta: así no se dispara una
// segunda petición a /auth/me.
const NO_REQUEST_SOURCE: SessionAccountSource = {
  getCurrentAccount: () => new Promise(() => undefined),
};

const COMPACT_WIDTH = 760;
const NARROW_WIDTH = 360;
const STACKED_NAVIGATION_WIDTH = 1120;

export function InnerRouteHeader({
  onNavigateHome,
  onLogin,
  onRegister,
  sessionSource,
  onLoggedOut,
  session,
}: {
  // Volver a la portada; los enlaces del menú la usan porque las
  // secciones a las que apuntan viven allí.
  onNavigateHome: () => void;
  onLogin: () => void;
  onRegister: () => void;
  sessionSource?: SessionAccountSource;
  onLoggedOut?: () => void;
  // Sesión ya resuelta por la vista anfitriona. Se acepta para no
  // repetir la consulta a /auth/me: los formularios de reporte ya la
  // piden para su leyenda (CHG-078).
  session?: SessionAccountState;
}) {
  const { width } = useWindowDimensions();
  const ownSession = useSessionAccount(
    session === undefined ? sessionSource : NO_REQUEST_SOURCE,
  );
  const resolvedSession = session ?? ownSession;
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const logout = () => {
    setAccountMenuOpen(false);
    authDataSource
      .logout()
      .catch(() => undefined)
      .finally(() => {
        // Cerrar sesión desde un formulario deja la vista sin contexto:
        // se sale a la portada, que ya refleja el estado anónimo.
        (onLoggedOut ?? onNavigateHome)();
      });
  };

  return (
    <View style={styles.shell}>
      <Header
        compact={width < COMPACT_WIDTH}
        narrow={width < NARROW_WIDTH}
        stackedNavigation={width < STACKED_NAVIGATION_WIDTH}
        // Ninguna sección de la portada está visible desde aquí, así
        // que ningún enlace se marca como activo.
        activeSection="home"
        onNavigateHome={onNavigateHome}
        onNavigateMap={onNavigateHome}
        onNavigateAbout={onNavigateHome}
        onNavigateData={onNavigateHome}
        onNavigateLive={onNavigateHome}
        onLogin={onLogin}
        onRegister={onRegister}
        account={
          resolvedSession.status === "authenticated"
            ? resolvedSession.account
            : null
        }
        onLogout={logout}
        accountMenuOpen={accountMenuOpen}
        onToggleAccountMenu={() =>
          setAccountMenuOpen((current) => !current)
        }
        onOpenMySpace={onNavigateHome}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // El encabezado trae su propio fondo; el contenedor solo garantiza
  // que quede sobre el contenido cuando el menú se despliega.
  shell: { zIndex: 30, backgroundColor: colors.canvas },
});
