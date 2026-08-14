# CUSOL UIS Disasters Platform — Frontend universal

Aplicación React Native, Expo y TypeScript para Android, iOS y web desde una única base de componentes.

## Requisitos

- Node.js `20.19` o superior.
- Android Studio para emulador Android, o un dispositivo con Expo Go compatible.
- macOS con Xcode para el simulador iOS. Desde Linux o Windows se puede usar un iPhone físico o un build remoto posterior.

## Instalar

```bash
npm install
cp .env.example .env
```

La aplicación consulta la API por defecto, pero mantiene la etiqueta de datos demostrativos mientras se utilizan registros semilla y siguen pendientes la terminología `DEC-006` y la política de privacidad. Usa `EXPO_PUBLIC_DASHBOARD_DATA_MODE=demo` únicamente para trabajar sin backend con el fixture local. En móvil configura `EXPO_PUBLIC_API_BASE_URL` con una URL accesible desde el dispositivo. En un build web servido por Nginx puede omitirse para usar el proxy `/api` del mismo origen.

La ruta protegida `/administracion` exige que `GET /api/v1/auth/me` confirme una
sesión activa con rol `super_admin`; el rol nunca se toma del cliente. Incluye
resumen, bandeja y detalle de ingresos, edición con motivo, decisiones,
archivo/restauración, acceso temporal a evidencia, cuentas, revocación de
sesiones y auditoría. `EXPO_PUBLIC_ADMIN_DATA_MODE=demo` mantiene datos
sintéticos claramente rotulados mientras se implementan los contratos
`/api/v1/admin`; usa `api` únicamente cuando esos endpoints estén disponibles.

El mapa operativo consulta por defecto `GET /api/v1/operational-map/overview`; usa `EXPO_PUBLIC_OPERATIONAL_MAP_DATA_MODE=demo` únicamente para trabajar sin backend. La búsqueda y el formulario de desaparecidos de `CHG-007` permanecen locales con `EXPO_PUBLIC_MISSING_PERSON_DATA_MODE=demo` hasta que el backend seguro esté validado.

La capa **Situación humana** consulta `GET /api/v1/people/map-overview` por área visible y zoom. Representa todas las personas georreferenciables mediante clusters que se dividen al acercar, sin publicar identidad ni coordenadas exactas. La leyenda inferior **Respuesta e infraestructura** muestra únicamente centros de acopio, escombros y edificios; no repite desaparecidos. Usa `EXPO_PUBLIC_HUMAN_MAP_DATA_MODE=demo` solo para trabajar sin backend.

El listado **Personas agregadas** consulta `GET /api/v1/people/records` de forma independiente al resumen. Su sección ocupa como mínimo el viewport disponible bajo el encabezado y termina en un footer institucional negro; la navegación “Transmisión en vivo” alinea el módulo sin dejar visible el panel anterior. La portada muestra cinco filas; elegir 10, 20 o 50 abre una ventana ampliada con búsqueda, filtros y paginación. Para conservar el contrato actual, el adaptador solicita 10 para mostrar 5 y 25 para mostrar 20, recortando sólo el excedente y manteniendo el total y el `offset` del servidor. La página activa se actualiza cada 30 segundos. Usa `EXPO_PUBLIC_PEOPLE_RECORDS_DATA_MODE=demo` solo para trabajar sin backend; “todos” se limita siempre a la proyección pública `PersonRecord`.

El módulo **Buscar y verificar** permite alternar entre personas, centros de
acopio y puntos de recolección con filtros compactos. Las coincidencias se abren
en una ventana independiente con tarjetas. Las novedades de persona y las
valoraciones con estrellas envían texto y fotografías privadas para revisión;
nunca cambian automáticamente un estado o promedio público. Mientras Claude
implementa `CHG-034` T007–T009, usa
`EXPO_PUBLIC_HUMANITARIAN_DIRECTORY_DATA_MODE=demo` y
`EXPO_PUBLIC_COMMUNITY_CONTRIBUTION_DATA_MODE=demo` para validar la experiencia
completa con fixtures rotulados.

La acción **Reportar edificio sin verificar** abre
`/reportar-edificio-sin-verificar`. El formulario registra identificación,
ubicación privada, estado de búsqueda, condiciones observadas, contacto y de una
a cinco fotografías; envía multipart a
`POST /api/v1/unverified-building-reports`. Una respuesta válida queda
`under_review`: no crea un marcador, no confirma presencia de personas y no
constituye un diagnóstico estructural. `CHG-035` está conectado a la API real:
en web usa el proxy `/api` cuando no se configura una base explícita y en móvil
usa `EXPO_PUBLIC_API_BASE_URL`. Este formulario no tiene modo demo.

Sin clave de Google, el mapa usa teselas reales de OpenStreetMap con atribución visible. `EXPO_PUBLIC_OSM_TILES_DISABLED=true` permite probar la degradación sin conectividad: el lienzo neutro conserva marcadores, selección, filtros y zoom. Las teselas públicas son apropiadas para desarrollo y demostración; un despliegue con tráfico real debe seleccionar un proveedor gestionado.

En web, mantén presionado el botón izquierdo o derecho y arrastra para desplazar el mapa. La rueda del mouse acerca o aleja; los botones visibles continúan disponibles para mouse, tacto y teclado.

El filtro **Edificios sin revisar** muestra únicamente inmuebles cuya inspección está pendiente. Mientras la API demostrativa aún no entregue esa categoría, el frontend agrega dos ubicaciones claramente marcadas como demo; nunca completa respuestas operativas con datos sintéticos.

### Google Maps opcional

Sin credenciales, el mapa conserva filtros, marcadores y selección sobre un lienzo demostrativo. Para usar Google Maps:

- Web: habilita Maps JavaScript API, configura una clave restringida por referente HTTP en `EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY` y reemplaza `DEMO_MAP_ID` con un Map ID propio antes de producción.
- Android: configura una clave restringida por paquete y SHA-1 en `GOOGLE_MAPS_ANDROID_API_KEY`.
- iOS: configura una clave restringida por bundle ID en `GOOGLE_MAPS_IOS_API_KEY`.
- En builds nativos con las claves integradas, establece `EXPO_PUBLIC_GOOGLE_MAPS_NATIVE_ENABLED=true`.

Google Maps requiere un proyecto de Google Cloud, APIs habilitadas y facturación. Las claves reales no deben copiarse al repositorio.

## Ejecutar por plataforma

```bash
# Navegador en http://localhost:3100
npm run web

# Metro y emulador Android
npm run android

# Metro y simulador iOS (requiere macOS)
npm run ios

# Servidor Expo interactivo; permite escanear QR
npm start
```

En Android Emulator, la máquina anfitriona suele estar disponible como `http://10.0.2.2:8000`. En un teléfono físico usa la IP local del computador, por ejemplo `http://192.168.1.20:8000`; `localhost` apuntaría al propio teléfono. En web, Metro conserva un proxy local para `/api`, configurable con `EXPO_API_PROXY_TARGET`.

## Desarrollo integrado con microservicios

Desde el backend:

```bash
cd ../CUSOL_UIS_DisastersPlatform_Backend
make dev
```

El servicio web queda en <http://localhost:3100>. Expo/Metro aplica Fast Refresh sin reiniciar los microservicios.

## Validación

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx expo install --check
```

`npm run build` exporta el sitio web estático en `dist/`. Los proyectos nativos se generan bajo demanda con Expo Prebuild; `android/` e `ios/` no son la fuente primaria.

## Contrato

La aplicación consume `GET /api/v1/people/overview`, `GET /api/v1/people/records`, `GET /api/v1/people/map-overview`, `GET /api/v1/operational-map/overview`, `GET /api/v1/humanitarian-directory/search`, `POST /api/v1/unverified-building-reports` y los aportes públicos/autenticados definidos en `../CUSOL_UIS_DisastersPlatform_Specs/contracts/openapi.yaml`.
