# Pag_Gmidei Frontend

Frontend en **Next.js** para la gestión de proyectos, reportes, miembros, calendario y tareas. Esta guía funciona como documento vivo del frontend: describe la navegación, la responsabilidad de cada pantalla y el tipo de datos que el backend debe entregar o recibir.

> **Nota operativa:** este README debe actualizarse cada vez que cambie la arquitectura visible de la app, la navegación o el contrato esperado con backend.

---

## 1. Stack y propósito

- **Framework:** Next.js App Router.
- **Estado de autenticación:** Zustand (`store/authStore`).
- **Cliente HTTP:** Axios (`lib/api.ts`).
- **Persistencia auxiliar local:** `localStorage` para comentarios y tareas cuando el backend aún no tiene endpoints específicos o cuando falla la sincronización.
- **Objetivo del producto:** centralizar seguimiento operativo de subgrupos/proyectos universitarios con foco en reportes, tareas, miembros y coordinación mentor/líder/miembro.

---

## 2. Jerarquía de navegación

### Rutas públicas

- `/`
  - Landing inicial.
- `/auth/login`
  - Inicio de sesión.
- `/auth/register`
  - Registro de usuario.

### Rutas privadas (`/dashboard`)

- `/dashboard`
  - Resumen principal con métricas, accesos rápidos y reportes recientes.
- `/dashboard/reports`
  - Centro de reportes.
  - Incluye creación de informe, filtros avanzados y timeline visual.
- `/dashboard/reports/view?id=:reportId`
  - Detalle del reporte.
  - Muestra bloques del informe, evidencia, adjuntos y conversación de comentarios.
- `/dashboard/tasks`
  - Nuevo módulo de tareas.
  - Permite asignar tareas por rango de fechas y revisar cumplimiento.
- `/dashboard/calendar`
  - Calendario operativo del proyecto.
- `/dashboard/members`
  - Vista de miembros por proyecto y sus reportes.
- `/dashboard/subgroups`
  - Gestión de proyectos/subgrupos para usuarios con permisos de mentor o superiores.
- `/dashboard/admin`
  - Panel administrativo global.

### Lógica de visibilidad importante

- **Reportes:** visibles según respuesta del backend y filtros aplicados en frontend.
- **Tareas:** en frontend se renderizan solo para:
  - miembro asignado,
  - mentor del proyecto,
  - líder del proyecto,
  - administrador global.

---

## 3. Distribución funcional de la interfaz

### 3.1 Dashboard principal

Resume el estado del usuario con:
- total de reportes,
- total de miembros,
- cantidad de tareas visibles para el usuario,
- accesos rápidos hacia reportes y tareas,
- lista corta de reportes recientes.

### 3.2 Módulo de reportes

#### Vista `/dashboard/reports`

Se divide en dos zonas:
1. **Creación de reporte**
   - selección de proyecto,
   - redacción estructurada por bloques,
   - links de evidencia,
   - comentarios adicionales,
   - carga de archivos vía backend.
2. **Explorador de informes**
   - búsqueda por texto,
   - filtro por proyecto,
   - filtro por miembro,
   - filtro por estado,
   - filtro por rango de fechas,
   - opción “solo mis reportes”.

#### Vista `/dashboard/reports/view`

Presenta el informe con mejor jerarquía:
- resumen por bloques (`Avance`, `Problemas`, `Siguiente paso`),
- cuerpo renderizado del markdown,
- panel lateral de evidencia,
- adjuntos descargables,
- comentarios tipo conversación,
- edición del reporte si el usuario es autor o administrador.

### 3.3 Módulo de tareas

#### Objetivo

Dar seguimiento a trabajo operativo que no necesariamente entra como reporte diario/semanal.

#### Flujo actual del frontend

- Un mentor/líder crea una tarea.
- La tarea se relaciona con:
  - proyecto/subgrupo,
  - miembro responsable,
  - fecha de inicio,
  - fecha de fin,
  - criterio o descripción,
  - estado,
  - bitácora de seguimiento.
- La tarea se muestra únicamente a quienes deben verla.

#### Observación técnica

Actualmente el módulo usa persistencia local (`localStorage`) en `lib/tasks.ts`. Esto sirve como base visual/funcional mientras el backend expone endpoints reales.

### 3.4 Módulo de miembros

- Carga los miembros del proyecto seleccionado.
- Permite filtrar reportes por miembro.
- Sirve como vista de seguimiento de actividad del proyecto.

### 3.5 Calendario

- Consume eventos del backend.
- Relaciona eventos con subgrupos/proyectos.

---

## 4. Contrato de datos esperado con backend

Esta sección está pensada para alinear frontend y backend.

### 4.1 Autenticación

#### Login
- **Ruta:** `POST /auth/login`
- **Payload enviado:**

```json
{
  "email": "usuario@correo.com",
  "password": "secreto"
}
```

#### Register
- **Ruta:** `POST /auth/register`
- **Payload enviado:**

```json
{
  "email": "usuario@correo.com",
  "password": "secreto",
  "fullName": "Nombre completo"
}
```

#### Respuesta esperada

- `accessToken`
- `refreshToken`
- datos del usuario autenticado, incluyendo membresías por subgrupo.

### 4.2 Usuario autenticado

El frontend espera algo equivalente a:

```json
{
  "id": "user-id",
  "email": "usuario@correo.com",
  "fullName": "Nombre Apellido",
  "memberships": [
    {
      "subgroupId": "subgroup-id",
      "subgroupName": "Proyecto A",
      "subgroupCode": "PA-01",
      "roles": ["MIEMBRO", "LIDER"]
    }
  ],
  "isGodAdmin": false
}
```

### 4.3 Reportes

#### Obtener lista
- **Ruta:** `GET /reports`
- **Query params usados por frontend:**
  - `authorId`
  - `subgroupId`
  - `status`
  - `q`
  - `from`
  - `to`
  - `page`
  - `limit`

#### Crear reporte
- **Ruta:** `POST /reports`
- **Formato enviado:** `multipart/form-data`
- **Campos enviados:**
  - `title`
  - `markdown`
  - `comments`
  - `externalLinks`
  - `subgroupId`
  - `attachments[]`

#### Obtener detalle
- **Ruta:** `GET /reports/:id`

#### Editar reporte
- **Rutas usadas por frontend:**
  - `PUT /reports/:id`
  - fallback: `PATCH /reports/:id`

#### Modelo que el frontend espera recibir

```json
{
  "id": "report-id",
  "title": "Reporte semanal",
  "description": "markdown del reporte",
  "reportDate": "2026-03-22T00:00:00.000Z",
  "comments": "comentario inicial opcional",
  "externalLinks": ["https://..."],
  "links": ["https://..."],
  "has_evidence": true,
  "updatedAt": "2026-03-22T00:00:00.000Z",
  "edited": true,
  "author": {
    "id": "user-id",
    "fullName": "Autor del reporte",
    "role": "MIEMBRO"
  },
  "subgroup": {
    "id": "subgroup-id",
    "name": "Proyecto A",
    "code": "PA-01"
  },
  "attachments": [
    {
      "id": "file-id",
      "originalName": "archivo.pdf"
    }
  ]
}
```

### 4.4 Comentarios de reportes

#### Crear comentario
- **Ruta:** `POST /comments`
- **Payload enviado:**

```json
{
  "reportId": "report-id",
  "content": "Texto del comentario"
}
```

#### Editar comentario
- **Ruta:** `PUT /comments/:commentId`
- **Payload enviado:**

```json
{
  "content": "Nuevo texto"
}
```

#### Respuesta ideal esperada

```json
{
  "id": "comment-id",
  "reportId": "report-id",
  "userId": "user-id",
  "content": "Texto del comentario",
  "createdAt": "2026-03-22T00:00:00.000Z",
  "editedAt": "2026-03-22T01:00:00.000Z",
  "user": {
    "id": "user-id",
    "fullName": "Nombre del autor"
  }
}
```

### 4.5 Subgrupos / proyectos

#### Rutas consumidas
- `GET /subgroups/my`
- `GET /subgroups/:subgroupId/members`
- `POST /subgroups`
- `PATCH /subgroups/:subgroupId`
- `DELETE /subgroups/:subgroupId`
- `POST /subgroups/:subgroupId/members`
- `PATCH /subgroups/:subgroupId/members/:userId/roles`
- `DELETE /subgroups/:subgroupId/members/:userId`

#### Miembros esperados por proyecto

```json
[
  {
    "userId": "user-id",
    "roles": ["MENTOR"],
    "user": {
      "id": "user-id",
      "fullName": "Nombre Apellido",
      "email": "correo@dominio.com"
    }
  }
]
```

### 4.6 Calendario

#### Rutas consumidas
- `GET /calendar`
- `POST /calendar/subgroups/:subgroupId`
- `PATCH /calendar/:id`
- `DELETE /calendar/:id`

### 4.7 Tareas

#### Estado actual

Todavía **no hay integración HTTP** para tareas en el frontend actual. La interfaz ya está construida y la persistencia temporal vive en navegador.

#### Contrato recomendado para backend

##### Crear tarea
- **Ruta sugerida:** `POST /tasks`

```json
{
  "title": "Preparar pruebas de integración",
  "description": "Definir casos, ejecutar pruebas y documentar resultados.",
  "subgroupId": "subgroup-id",
  "assigneeId": "member-user-id",
  "startDate": "2026-03-23",
  "endDate": "2026-03-30"
}
```

##### Listar tareas visibles para el usuario
- **Ruta sugerida:** `GET /tasks`
- **Filtros sugeridos:**
  - `subgroupId`
  - `assigneeId`
  - `status`
  - `from`
  - `to`

##### Actualizar estado / seguimiento
- **Ruta sugerida:** `PATCH /tasks/:taskId`

```json
{
  "status": "en_progreso",
  "progressNote": "Se completó la fase 1, faltan validaciones finales."
}
```

##### Modelo recomendado

```json
{
  "id": "task-id",
  "title": "Preparar pruebas de integración",
  "description": "Detalle de la tarea",
  "subgroupId": "subgroup-id",
  "subgroupName": "Proyecto A",
  "assigneeId": "user-id",
  "assigneeName": "Nombre del miembro",
  "assigneeRole": "Miembro",
  "mentorOrLeaderIds": ["mentor-id", "leader-id"],
  "startDate": "2026-03-23",
  "endDate": "2026-03-30",
  "status": "pendiente",
  "progressNote": "",
  "createdAt": "2026-03-22T00:00:00.000Z",
  "updatedAt": "2026-03-22T00:00:00.000Z",
  "completedAt": null
}
```

---

## 5. Archivos frontend más relevantes

- `app/dashboard/layout.tsx`
  - navegación lateral principal.
- `app/dashboard/page.tsx`
  - home del dashboard.
- `app/dashboard/reports/page.tsx`
  - centro de creación y exploración de reportes.
- `app/dashboard/reports/view/page.tsx`
  - detalle y edición del reporte.
- `components/reports/ReportViewer.tsx`
  - visualización estructurada del contenido.
- `components/reports/CommentSection.tsx`
  - conversación de comentarios.
- `app/dashboard/tasks/page.tsx`
  - entrada del módulo de tareas.
- `components/tasks/TaskBoard.tsx`
  - tablero funcional de tareas.
- `lib/api.ts`
  - capa HTTP y contratos base.
- `lib/tasks.ts`
  - persistencia temporal/local del módulo de tareas.

---

## 6. Desarrollo local

```bash
npm install
npm run dev
```

Variables opcionales:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_BASE_PATH=
```

---

## 7. Última actualización funcional

### Cambio actual

- Se mejoró el render visual de reportes.
- Se añadió filtro por miembro en reportes.
- Se rediseñó la experiencia de comentarios para parecer una conversación real.
- Se agregó el módulo **Tareas** con asignación, rango de fechas y seguimiento local.
- Se actualizó el dashboard inicial para enlazar mejor reportes y tareas.
