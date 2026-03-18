# Prompt para informar al backend (hallazgo + estado actual frontend)

Usa este mensaje para reportar al equipo backend:

---
Hola equipo backend,

Detectamos un ajuste importante en frontend relacionado a permisos y sincronización de reportes/comentarios.

## 1) Hallazgo principal
- Antes del fix, el botón de **Editar reporte** aparecía en UI incluso para usuarios que no eran autor/admin.
- Ya corregimos frontend para que solo permita editar cuando:
  - `user.id === report.author.id`, o
  - `user.isGodAdmin === true`.
- Aun así, necesitamos confirmación de que backend **siempre valida autorización** en `PUT/PATCH /api/reports/:id`.

## 2) Estado actual de flujos GET/POST/PUT en frontend
### Reportes
- `GET /api/reports` y `GET /api/reports/:id`:
  - consumimos campos nuevos si llegan: `links`, `has_evidence`, `updatedAt`, `edited`, `previousContent`.
  - mantenemos fallback con campos legacy (`externalLinks`, markdown parseado).
- Edición:
  - frontend intenta `PUT /api/reports/:id` primero,
  - fallback a `PATCH /api/reports/:id` por compatibilidad.
- Creación/edición:
  - si backend retorna `warning`, se muestra como aviso no bloqueante.

### Comentarios
- Crear comentario: `POST /api/comments` con `{ reportId, content }`.
- Editar comentario: `PUT /api/comments/:id` con `{ content }`.
- Si falla sincronización, frontend aplica fallback local para no romper UX.

### Upload
- Subida: `POST /api/upload` (multipart con campo `file`).
- Si backend responde `503`, frontend muestra mensaje de storage no disponible.

## 3) Validaciones solicitadas al backend
- Confirmar política de autorización exacta para editar reportes.
- Confirmar formato estable de `warning` (ej. `warning` string u objeto con `message`).
- Confirmar forma final del payload de `comments` en respuestas (si incluye `user.fullName`).
- Confirmar contrato de respuesta de `POST /api/upload` (`url` top-level o `data.url`).

Gracias.
---
