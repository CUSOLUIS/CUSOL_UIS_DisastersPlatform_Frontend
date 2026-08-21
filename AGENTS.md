# Instrucciones del frontend

## Fuente de verdad

Antes de modificar comportamiento, leer:

1. `../CUSOL_UIS_DisastersPlatform_Specs/constitution.md`.
2. La especificación aplicable en `../CUSOL_UIS_DisastersPlatform_Specs/features/`.
3. El expediente aplicable en `../CUSOL_UIS_DisastersPlatform_Specs/changes/active/`.
4. `../CUSOL_UIS_DisastersPlatform_Specs/contracts/openapi.yaml`.

Si una ruta no existe o el cambio no está especificado, registrar primero la necesidad en Specs.

## Grafo del repositorio (CHG-183, 2026-08-20)

`graphify-out/` contiene el grafo de conocimiento de este repositorio:
`graph.json` (datos), `GRAPH_REPORT.md` (informe), `graph.html` (mapa visual) y
`wiki/` (un artículo por comunidad).

- **Para localizar dónde vive algo, consultarlo ANTES de barrer el árbol con
  `grep` o lectura exploratoria**, desde la raíz del repositorio:
  `graphify query "<pregunta>"`, `graphify explain "<símbolo>"`,
  `graphify path "<A>" "<B>"`, `graphify affected "<archivo>"`.
  `graphify-out/wiki/index.md` es la entrada para un agente que no ejecuta nada.
- **Tras cada cambio de código**, al cerrar el expediente: `graphify update .`
  (determinista, sin LLM ni coste). Anotar el resultado en la bitácora del
  `CHG-NNN`.
- **Aviso (verificado el 2026-08-20, CHG-185):** el comando solo deja los
  archivos intactos si la topología **no** cambió. En cuanto el cambio añade
  archivos, la detección de comunidades se re-agrupa y `update` **renombra
  todas las etiquetas curadas por su nodo central** —el mismo daño que en
  Specs—. La salida anterior queda respaldada en `graphify-out/<fecha>/`. La
  reparación es determinista y está descrita en la bitácora de CHG-185:
  reasignar cada comunidad nueva a la vieja con la que más nodos comparte y
  devolverle su etiqueta en `.graphify_labels.json`, `graph.json`, `graph.html`
  y los encabezados de `GRAPH_REPORT.md`; las comunidades que el cambio
  reformó se nombran a mano. Sin esa reparación, el grafo pierde el índice en
  castellano y queda con nombres de archivo.
- El grafo es un índice, no una fuente de verdad: señala archivo y línea; lo que
  manda sigue siendo el código y el contrato.

## Responsabilidades

- Implementar comportamiento observable y estados de interfaz.
- Mantener consistencia entre mapa, listas y detalles.
- Tratar accesibilidad, diseño adaptable, carga, vacío y error como requisitos,
  no como acabado posterior; su nivel lo fija el protocolo de diseño (ver abajo)
  y el mínimo no negociable está en `design/design-system.md`.
- Consumir el contrato de API sin inventar campos ni semántica.
- Etiquetar claramente fuente, vigencia, verificación e inferencias de IA.
- Este repositorio es el área principal de implementación de Codex.
- Si una funcionalidad necesita un cambio de backend, documentar el contrato y las tareas para backend en Specs antes de continuar con la integración.

## Diseño (regla del usuario, 2026-08-20, CHG-186)

Este repositorio es donde se ve el diseño, así que aquí es donde se aplica el
protocolo. **Un cambio visual no se implementa con el criterio de un solo
agente.**

Antes de tocar una pantalla, un componente o un token, cuando el cambio altera
cómo se ve, se siente, se mueve o se interactúa con algo:

1. Leer `../CUSOL_UIS_DisastersPlatform_Specs/design/design-system.md`: lo que
   ya está decidido no se vuelve a discutir, y contradecirlo exige argumentarlo.
2. Lanzar los **dos subagentes en paralelo** —NORMA con
   `ui-ux-pro-max:ui-ux-pro-max` e INTENCIÓN con `impeccable`—, una ronda de
   contraste entre ellos, y archivar la discusión en el `design-review.md` del
   expediente `CHG-NNN`.
3. Aplicar el plan acordado; ante desacuerdo irresuelto o decisión de marca,
   preguntar en el chat.

La secuencia completa, el disparador exacto y qué se pregunta al usuario están
en «Protocolo de diseño» del `AGENTS.md` del workspace. El comando `/diseno` lo
arranca a mano.

**No se dispara** para arreglos que no cambian el aspecto (llamadas a la API,
cálculos, condiciones, pruebas, tipado, refactor interno): esos siguen el flujo
normal.

La decisión de diseño se prueba en las **tres superficies** —web de escritorio,
web móvil y app nativa—, conservando las diferencias deliberadas de la app en
lugar de aplanarlas hacia la web.

## Calidad

- Agregar pruebas al nivel apropiado.
- Asociar cambios y pruebas con `CHG-NNN` y criterios `AC-NNN`.
- Ejecutar los comandos de validación disponibles antes de declarar una tarea terminada.
- No seleccionar framework o dependencias estructurales sin un ADR aceptado.
- Con el entorno local iniciado, verificar que los cambios se reflejen mediante Expo/Metro Fast Refresh en el puerto `3100` sin reiniciar backend.
- Todo componente nuevo debe funcionar en Android, iOS y web; aislar excepciones justificadas con archivos específicos de plataforma.
- Un cambio visual no se cierra sin su `design-review.md` archivado en el expediente.

## Git

No ejecutar `git push` ni operaciones remotas sin orden explícita del usuario. No incluir secretos, archivos de entorno ni credenciales.
