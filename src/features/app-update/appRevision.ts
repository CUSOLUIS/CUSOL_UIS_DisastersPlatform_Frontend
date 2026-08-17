// CHG-128 — Revisión embebida del build. En el repo vive como null
// (web, desarrollo local y pruebas: el portón queda inactivo); el
// workflow `Android APK` SOBREESCRIBE este archivo con el commit del
// build antes de compilar. Es un archivo generado a propósito: no
// depende del inlining de variables de entorno de babel, que en el
// build de CI del APK no llegó al empaquetado (el bundle publicado
// salió sin la revisión aunque el workflow exportaba la variable).
export const EMBEDDED_APP_REVISION: string | null = null;
