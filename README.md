# Pag_Gmidei Frontend

Frontend en **Next.js** para la gestión de proyectos, reportes, miembros, calendario y tareas. Este README funciona como documento vivo del frontend: describe la navegación, la organización visual de cada módulo y el contrato de datos que el backend necesita conocer para integrarse sin ambigüedad.

> **Nota operativa:** cada vez que cambie una pantalla, una pestaña o el flujo de datos con backend, este archivo debe actualizarse.

---

## 1. Stack y propósito

- **Framework:** Next.js App Router.
- **Estado global/autenticación:** Zustand.
- **Cliente HTTP:** Axios.
- **Persistencia auxiliar local actual:** `localStorage` para comentarios, calificación de reportes y módulo de tareas mientras algunos endpoints no existan en backend.
- **Objetivo del producto:** centralizar seguimiento operativo y evaluación de subgrupos/proyectos con foco en reportes, tareas y coordinación entre miembro, líder y mentor.

---

## 2. Jerarquía de navegación

### Rutas públicas

- `/`
  - Landing.
- `/auth/login`
  - Inicio de sesión.
- `/auth/register`
  - Registro.

### Rutas privadas (`/dashboard`)

- `/dashboard`
  - Resumen principal con métricas, accesos rápidos y reportes recientes.
- `/dashboard/reports`
  - Centro de reportes dividido por pestañas.
- `/dashboard/reports/view?id=:reportId`
  - Vista detallada del reporte con lectura, evidencia y comentarios.
- `/dashboard/tasks`
  - Centro de tareas dividido por pestañas.
- `/dashboard/calendar`
  - Calendario del proyecto.
- `/dashboard/members`
  - Miembros y seguimiento por proyecto.
- `/dashboard/subgroups`
  - Gestión de proyectos/subgrupos.
- `/dashboard/admin`
  - Panel administrativo global.

---

## 3. Organización funcional por módulos y pestañas

La idea actual del frontend es **evitar saturación**: cada módulo principal concentra una responsabilidad general, pero sus herramientas se separan por pestañas internas.

### 3.1 Dashboard principal

Muestra:
- total de reportes,
- total de miembros,
- total de tareas visibles para el usuario,
- accesos rápidos a reportes y tareas,
- reportes recientes.

### 3.2 Módulo `Reportes`

Ruta: `/dashboard/reports`

#### Pestañas actuales

1. **Creación**
   - selección de proyecto,
   - edición estructurada del reporte,
   - evidencia,
   - comentarios adicionales.

2. **Visualización**
   - listado de reportes,
   - filtro por texto,
   - filtro por proyecto,
   - filtro por miembro,
   - filtro por fechas,
   - vista enriquecida por tarjeta.

3. **Calificación**
   - revisión separada del flujo de lectura,
   - estado de revisión (`pendiente`, `en revisión`, `aprobado`, `requiere cambios`),
   - etiquetas rápidas,
   - checklist de calidad,
   - nota de calificación.

#### Vista detalle del reporte

Ruta: `/dashboard/reports/view?id=:reportId`

Muestra:
- resumen por bloques (`Avance`, `Problemas`, `Siguiente paso`),
- markdown renderizado,
- panel lateral de evidencia,
- adjuntos,
- comentarios en formato conversación,
- edición para autor/admin, con asociación obligatoria a tareas vigentes del proyecto.
- en creación ya no se elige fecha manual: frontend usa la fecha actual del día para mantener trazabilidad del reporte y lista las tareas del proyecto seleccionado para enlazar el reporte.

### 3.3 Módulo `Tareas`

Ruta: `/dashboard/tasks`

#### Pestañas actuales

1. **Visualización de tareas**
   - tareas visibles del usuario,
   - resumen de cumplimiento,
   - filtros por proyecto, miembro y estado,
   - bitácora operativa.

2. **Asignación**
   - creación de tareas,
   - definición de responsable,
   - ventana de fechas,
   - criterio o descripción de cumplimiento,
   - visible solo para líderes, mentores o administrador global.

#### Regla de edición de tarea

La acción **"Editar tarea"** (título, descripción, fechas y subtareas) se habilita únicamente para:
- líderes del proyecto,
- mentores del proyecto,
- administrador global.

El miembro asignado sigue pudiendo mover el estado y escribir en la bitácora operativa, pero no modificar la estructura de la tarea si no tiene uno de esos roles.

3. **Calificación**
   - validación y revisión separadas del flujo operativo,
   - etiquetas rápidas,
   - nivel de cumplimiento,
   - nota de revisión,
   - checkbox de validación del líder.

#### Reglas de visibilidad de tareas

Una tarea se renderiza solo para:
- el miembro asignado,
- líderes del proyecto,
- mentores del proyecto,
- administrador global.

#### Regla especial de validación

La casilla **"Validada por líder"** está pensada para que la active el líder del proyecto (y actualmente también el administrador global, si existe ese caso de supervisión).

### 3.4 Módulo `Miembros`

- carga miembros del proyecto,
- permite seguimiento de reportes por miembro,
- sirve como vista rápida de actividad de equipo.

### 3.5 Módulo `Calendario`

- consume eventos del backend,
- los relaciona con subgrupos/proyectos.

---

## 4. Contrato de datos esperado con backend

Esta sección alinea frontend y backend.

### 4.1 Autenticación

#### Login
- **Ruta:** `POST /auth/login`

```json
{
  "email": "usuario@correo.com",
  "password": "secreto"
}
```

#### Register
- **Ruta:** `POST /auth/register`

```json
{
  "email": "usuario@correo.com",
  "password": "secreto",
  "fullName": "Nombre completo"
}
```

#### Respuesta esperada

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
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
}
```

### 4.2 Reportes

#### Obtener lista
- **Ruta:** `GET /reports`
- **Query params usados:**
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
- **Formato:** `multipart/form-data`
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
- **Rutas usadas:**
  - `PUT /reports/:id`
  - fallback `PATCH /reports/:id`

#### Modelo esperado

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

### 4.3 Comentarios de reportes

#### Crear comentario
- **Ruta:** `POST /comments`

```json
{
  "reportId": "report-id",
  "content": "Texto del comentario"
}
```

#### Editar comentario
- **Ruta:** `PUT /comments/:commentId`

```json
{
  "content": "Nuevo texto"
}
```

### 4.4 Calificación de reportes

#### Estado actual

La calificación de reportes está implementada en frontend con persistencia local en `localStorage` (`lib/reportReviews.ts`) mientras no exista un backend dedicado.

#### Modelo que hoy usa el frontend

```json
{
  "reportId": "report-id",
  "status": "aprobado",
  "tags": ["Con evidencia clara", "Bien documentado"],
  "reviewNote": "Buen avance, mantener trazabilidad.",
  "reviewerId": "user-id",
  "reviewerName": "Nombre revisor",
  "reviewedAt": "2026-03-22T00:00:00.000Z",
  "checklist": {
    "claridad": true,
    "evidencia": true,
    "siguientePaso": true
  }
}
```

#### Recomendación backend futura

- `GET /report-reviews?subgroupId=&reportId=`
- `POST /report-reviews`
- `PATCH /report-reviews/:reportId`

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

#### Miembros esperados

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

El módulo visual y de calificación ya existe en frontend, pero su persistencia sigue siendo local (`lib/tasks.ts`) mientras se define el backend oficial.

#### Modelo actual usado por frontend

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
  "status": "en_progreso",
  "progressNote": "Avance operativo",
  "labels": ["Alta prioridad", "Requiere apoyo"],
  "score": "parcial",
  "reviewNote": "Falta cerrar la última validación",
  "leaderValidation": {
    "checked": true,
    "reviewerId": "leader-id",
    "reviewerName": "Líder del proyecto",
    "reviewedAt": "2026-03-22T00:00:00.000Z"
  },
  "createdAt": "2026-03-22T00:00:00.000Z",
  "updatedAt": "2026-03-22T00:00:00.000Z",
  "completedAt": null
}
```

#### Contrato backend recomendado

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

##### Listar tareas
- **Ruta sugerida:** `GET /tasks`
- **Filtros sugeridos:**
  - `subgroupId`
  - `assigneeId`
  - `status`
  - `from`
  - `to`

##### Actualizar tarea o calificación
- **Ruta sugerida:** `PATCH /tasks/:taskId`

```json
{
  "status": "completada",
  "progressNote": "Se completó la entrega.",
  "labels": ["Alta prioridad"],
  "score": "cumplida",
  "reviewNote": "Trabajo correcto",
  "leaderValidation": {
    "checked": true,
    "reviewerId": "leader-id"
  }
}
```

---

## 5. Archivos frontend relevantes

- `app/dashboard/layout.tsx`
  - navegación lateral.
- `app/dashboard/page.tsx`
  - dashboard principal.
- `app/dashboard/reports/page.tsx`
  - pestañas de creación, visualización y calificación de reportes; obliga asociación a tareas vigentes y usa las tareas del proyecto seleccionado para enlazar reportes.
- `app/dashboard/reports/view/page.tsx`
  - detalle del reporte y edición con las mismas reglas de asociación de tareas.
- `components/reports/ReportViewer.tsx`
  - visualización estructurada del reporte.
- `components/reports/ReportEditor.tsx`
  - formulario que exige al menos una tarea activa y filtra por fecha del reporte.
- `components/reports/CommentSection.tsx`
  - comentarios tipo conversación.
- `lib/reportReviews.ts`
  - persistencia local de calificación de reportes.
- `app/dashboard/tasks/page.tsx`
  - entrada del módulo de tareas.
- `components/tasks/TaskBoard.tsx`
  - pestañas de visualización, asignación y calificación de tareas con permisos reforzados para edición estructural.
- `lib/tasks.ts`
  - persistencia local de tareas y revisión.
- `lib/permissions.ts`
  - reglas compartidas de permisos por rol/subgrupo.

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

- Los módulos `Reportes` y `Tareas` fueron reorganizados en pestañas para reducir saturación visual.
- Se añadió una capa de **calificación** para reportes con estados, etiquetas, checklist y notas.
- Se amplió la **calificación de tareas** con etiquetas, nivel de cumplimiento y checkbox de validación del líder.
- La edición estructural de tareas quedó restringida a líderes, mentores y modo dios.
- La asociación de reportes a tareas ahora es obligatoria y solo admite tareas vigentes para la fecha del reporte.
- La creación de reportes fija la fecha al día actual y ya no expone selector manual.
- La pestaña de asignación de tareas se oculta a miembros sin rol de líder, mentor o modo dios.
- El README quedó alineado con este nuevo flujo para que backend sepa qué información y endpoints hacen falta.


---

## 8. Ajustes finales sugeridos para backend

Estos puntos son necesarios o muy recomendables para que el frontend cumpla exactamente con lo pedido:

1. **Comentarios públicos por reporte**
   - El frontend ya intenta consumir `GET /comments?reportId=:id` para mostrar una conversación compartida.
   - `POST /comments` debe persistir realmente el comentario en base de datos y devolver el registro creado con `id`, `reportId`, `userId`, `content`, `createdAt` y `user.fullName`.
   - `PUT /comments/:commentId` debe persistir la edición y reflejarse luego en la lectura.
   - Si `GET /comments?reportId=:id` no existe o no devuelve los comentarios persistidos, la conversación no podrá reflejar la base real al recargar.

2. **Edición del grupo del reporte**
   - El frontend ahora envía `subgroupId` al editar un reporte (`PUT /reports/:id` o `PATCH /reports/:id`).
   - Backend debe aceptar ese campo para permitir mover un reporte entre proyectos cuando el usuario tenga permisos.

3. **Persistencia de calificación**
   - Hoy la calificación de reportes y tareas sigue siendo local.
   - Si se quiere consistencia multiusuario, backend debería exponer endpoints de revisión/calificación para ambos módulos.
