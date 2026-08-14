# Instrucciones del frontend

## Fuente de verdad

Antes de modificar comportamiento, leer:

1. `../CUSOL_UIS_DisastersPlatform_Specs/constitution.md`.
2. La especificación aplicable en `../CUSOL_UIS_DisastersPlatform_Specs/features/`.
3. El expediente aplicable en `../CUSOL_UIS_DisastersPlatform_Specs/changes/active/`.
4. `../CUSOL_UIS_DisastersPlatform_Specs/contracts/openapi.yaml`.

Si una ruta no existe o el cambio no está especificado, registrar primero la necesidad en Specs.

## Responsabilidades

- Implementar comportamiento observable y estados de interfaz.
- Mantener consistencia entre mapa, listas y detalles.
- Tratar accesibilidad, diseño adaptable, carga, vacío y error como requisitos.
- Consumir el contrato de API sin inventar campos ni semántica.
- Etiquetar claramente fuente, vigencia, verificación e inferencias de IA.
- Este repositorio es el área principal de implementación de Codex.
- Si una funcionalidad necesita un cambio de backend, documentar el contrato y las tareas para backend en Specs antes de continuar con la integración.

## Calidad

- Agregar pruebas al nivel apropiado.
- Asociar cambios y pruebas con `CHG-NNN` y criterios `AC-NNN`.
- Ejecutar los comandos de validación disponibles antes de declarar una tarea terminada.
- No seleccionar framework o dependencias estructurales sin un ADR aceptado.
- Con el entorno local iniciado, verificar que los cambios se reflejen mediante Expo/Metro Fast Refresh en el puerto `3100` sin reiniciar backend.
- Todo componente nuevo debe funcionar en Android, iOS y web; aislar excepciones justificadas con archivos específicos de plataforma.

## Git

No ejecutar `git push` ni operaciones remotas sin orden explícita del usuario. No incluir secretos, archivos de entorno ni credenciales.
