# Plan de migración frontend incremental (backend actualizado)

## Etapa 1 — Compatibilidad de contratos (este PR)
- Ampliar tipados de reportes con campos nuevos (`links`, `has_evidence`, `updatedAt`, `edited`, `previousContent`).
- Añadir soporte de `PUT /reports/:id` con fallback a `PATCH`.
- Añadir soporte de warnings backend en creación/edición (UI no bloqueante).
- Mostrar evidencia en listado/detalle usando `has_evidence` y `links`, con fallback a campos antiguos.
- Integrar endpoints de comentarios (`POST /comments`, `PUT /comments/:id`) sin romper fallback local.
- Crear componente reutilizable para subida de archivos vía `POST /upload` con manejo 503.

## Etapa 2 — Convergencia de datos
- Reemplazar almacenamiento local de comentarios por listado server-side cuando se habilite endpoint de lectura (`GET /comments?reportId=` o embebido en reporte).
- Registrar warnings backend en una capa de notificaciones global.
- Unificar mapping de evidencia en un helper centralizado (`links` + markdown + `externalLinks`).

## Etapa 3 — Limpieza y endurecimiento
- Eliminar fallback legado cuando toda la data histórica esté migrada.
- Agregar pruebas de integración para flujos críticos (create/edit report, create/edit comment, upload).
- Añadir analítica de errores 503 (storage) para observabilidad.
