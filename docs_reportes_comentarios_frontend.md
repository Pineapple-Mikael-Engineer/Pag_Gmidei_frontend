# Flujo detallado entre frontend, reportes y comentarios

Este documento explica exactamente **qué envía el frontend**, **qué espera recibir** y **cómo decide mostrar reportes/comentarios**.

## 1. Archivos involucrados

- `lib/api.ts`
- `app/dashboard/reports/page.tsx`
- `app/dashboard/reports/view/page.tsx`
- `components/reports/ReportEditor.tsx`
- `components/reports/CommentSection.tsx`
- `components/reports/ReportViewer.tsx`

---

## 2. Flujo de creación de reportes

La creación ocurre en `app/dashboard/reports/page.tsx`.

### 2.1 Qué llena el usuario

El usuario llena en `ReportEditor`:
- `title`
- bloques del markdown (`avance`, `problemas`, `siguiente paso`, `evidencia`)
- `comments` (comentarios adicionales del reporte, **no** son la conversación pública)
- links externos
- adjuntos
- `subgroupId`

### 2.2 Qué arma el frontend

El frontend construye un `FormData` y envía:

- `title`
- `markdown`
- `comments`
- `externalLinks`
- `subgroupId`
- `attachments` (0..n archivos)

### 2.3 Request real que manda el frontend

**Ruta:** `POST /reports`

Campos:

```text
FormData:
- title: string
- markdown: string
- comments: string
- externalLinks: string   (links separados por coma)
- subgroupId: string
- attachments: File[]
```

### 2.4 Respuesta que el frontend espera para reportes

El frontend trabaja mejor si backend devuelve algo parecido a esto:

```json
{
  "report": {
    "id": "report-1",
    "title": "Reporte semanal",
    "description": "## Avance\n...",
    "reportDate": "2026-03-22T10:00:00.000Z",
    "comments": "comentario inicial del reporte",
    "externalLinks": ["https://..."],
    "links": ["https://..."],
    "has_evidence": true,
    "updatedAt": "2026-03-22T10:00:00.000Z",
    "author": {
      "id": "user-1",
      "fullName": "Ana Pérez"
    },
    "subgroup": {
      "id": "subgroup-1",
      "name": "Proyecto X",
      "code": "PX-01"
    }
  }
}
```

---

## 3. Flujo de lectura de reportes

### 3.1 Listado de reportes

En `app/dashboard/reports/page.tsx` el frontend consulta:

**Ruta:** `GET /reports`

Parámetros opcionales:
- `authorId`
- `subgroupId`
- `status`
- `q`
- `from`
- `to`
- `limit`

### 3.2 Formato esperado

El frontend toma principalmente:

```json
{
  "data": [
    {
      "id": "report-1",
      "title": "Reporte semanal",
      "description": "## Avance\n...",
      "comments": "comentario inicial",
      "reportDate": "2026-03-22T10:00:00.000Z",
      "author": {
        "id": "user-1",
        "fullName": "Ana Pérez"
      },
      "subgroup": {
        "id": "subgroup-1",
        "name": "Proyecto X",
        "code": "PX-01"
      }
    }
  ]
}
```

### 3.3 Detalle de un reporte

En `app/dashboard/reports/view/page.tsx` el frontend consulta:

**Ruta:** `GET /reports/:id`

Y hoy consume principalmente:

```json
{
  "report": {
    "id": "report-1",
    "title": "Reporte semanal",
    "description": "## Avance\n...",
    "comments": "comentario inicial",
    "author": {
      "id": "user-1",
      "fullName": "Ana Pérez"
    },
    "subgroup": {
      "id": "subgroup-1",
      "name": "Proyecto X",
      "code": "PX-01"
    }
  }
}
```

---

## 4. Diferencia importante: `report.comments` vs comentarios públicos

Esto es clave para entendernos:

### 4.1 `report.comments`
Es un campo simple dentro del reporte. Se usa como:
- nota adicional del reporte
- comentario inicial
- texto descriptivo asociado al reporte

No representa necesariamente la conversación pública multiusuario.

### 4.2 Comentarios públicos (`/comments`)
La conversación pública del reporte vive en otro flujo distinto:
- `GET /comments?reportId=...`
- `POST /comments`
- `PUT /comments/:commentId`

Es decir:
- **reporte** y **comentarios públicos** están relacionados por `reportId`
- pero **no son el mismo campo**

---

## 5. Flujo real de comentarios en frontend

La UI de conversación pública está en:

- `components/reports/CommentSection.tsx`

Y se monta desde:

- `app/dashboard/reports/view/page.tsx`

con estas props:

```tsx
<CommentSection
  reportId={report.id}
  currentUserId={user?.id}
  currentUserName={user?.fullName}
  initialComment={report.comments}
/>
```

### 5.1 Qué significa cada prop

- `reportId`: id real del reporte para consultar la conversación
- `currentUserId`: usuario logueado
- `currentUserName`: nombre del usuario logueado
- `initialComment`: fallback visual usando `report.comments` si backend no devuelve una lista real

---

## 6. Cómo el frontend carga comentarios

El frontend intenta primero:

**Ruta:** `GET /comments?reportId=<reportId>`

### 6.1 Query enviada

```text
GET /comments?reportId=report-1
```

### 6.2 Qué formatos sabe leer el frontend ahora

El frontend fue ampliado para tolerar varios formatos de respuesta, por ejemplo:

```json
{ "comments": [ ... ] }
```

```json
{ "data": [ ... ] }
```

```json
{ "data": { "comments": [ ... ] } }
```

```json
{ "items": [ ... ] }
```

```json
[ ... ]
```

Incluso soporta objetos donde el comentario traiga:
- `id` o `_id`
- `reportId` o `report.id`
- `userId` o `user.id`
- `content`, `text` o `body`

### 6.3 Modelo ideal de comentario

```json
{
  "id": "comment-1",
  "reportId": "report-1",
  "userId": "user-1",
  "content": "Hola equipo",
  "createdAt": "2026-03-22T10:00:00.000Z",
  "editedAt": null,
  "user": {
    "id": "user-1",
    "fullName": "Ana Pérez"
  }
}
```

### 6.4 Si `/comments` falla o no trae nada útil

El frontend intenta fallback con:

**Ruta:** `GET /reports/:id`

Y busca posibles comentarios dentro de:
- `report.comments` si es string
- `report.comments` si es array
- `report.commentList`
- `report.commentsList`
- `report.thread`
- `report.conversation`

Si nada de eso existe, usa `initialComment` solo como respaldo visual.

---

## 7. Cómo el frontend crea un comentario

### 7.1 Request

**Ruta:** `POST /comments`

```json
{
  "reportId": "report-1",
  "content": "Este es un comentario público"
}
```

### 7.2 Qué hace el frontend después de crear

Después del `POST`, el frontend **no confía solo en el 201/200**.
Hace una lectura inmediata otra vez con:

```text
GET /comments?reportId=report-1
```

Y solo muestra el comentario como confirmado si aparece en esa lectura.

### 7.3 Qué espera como respuesta del POST

Idealmente algo así:

```json
{
  "comment": {
    "id": "comment-1",
    "reportId": "report-1",
    "userId": "user-1",
    "content": "Este es un comentario público",
    "createdAt": "2026-03-22T10:00:00.000Z",
    "user": {
      "id": "user-1",
      "fullName": "Ana Pérez"
    }
  }
}
```

---

## 8. Cómo el frontend edita un comentario

### 8.1 Request

**Ruta:** `PUT /comments/:commentId`

```json
{
  "content": "Texto actualizado"
}
```

### 8.2 Qué hace después

Después del `PUT`, vuelve a consultar:

```text
GET /comments?reportId=report-1
```

Y solo considera la edición exitosa si el nuevo texto reaparece en la lectura posterior.

---

## 9. Problema exacto que estamos persiguiendo

Según lo que reportaste:

- el comentario sí se crea en Neon
- el comentario pertenece al reporte
- pero el frontend no lo muestra

Eso deja estas posibilidades reales:

### Caso A. El endpoint `GET /comments?reportId=...` sí responde, pero con una forma distinta
Ejemplos:
- devuelve array plano en vez de `{ comments: [] }`
- usa `_id` en vez de `id`
- manda `report: { id: ... }` en vez de `reportId`
- manda `text` o `body` en vez de `content`

Esto sí lo intenté reparar haciendo al frontend mucho más tolerante.

### Caso B. El endpoint devuelve comentarios de varios reportes
En ese caso el frontend ahora intenta quedarse solo con los que coinciden con el `reportId` actual.

### Caso C. El endpoint de lectura no devuelve el comentario recién persistido
Si Neon sí tiene el dato pero `GET /comments?reportId=...` no lo incluye, el problema ya no sería del render sino del backend de lectura/filtro.

### Caso D. El `reportId` viene con otro nombre o dentro de otra relación
También amplié el frontend para leer:
- `reportId`
- `report.id`
- `report._id`
- `report.reportId`
- `report_id`

---

## 10. Qué necesito del backend para que esto quede estable

Idealmente el backend debería garantizar:

### Listar comentarios por reporte
**Ruta:** `GET /comments?reportId=report-1`

Respuesta recomendada:

```json
{
  "comments": [
    {
      "id": "comment-1",
      "reportId": "report-1",
      "userId": "user-1",
      "content": "Hola equipo",
      "createdAt": "2026-03-22T10:00:00.000Z",
      "editedAt": null,
      "user": {
        "id": "user-1",
        "fullName": "Ana Pérez"
      }
    }
  ]
}
```

### Crear comentario
**Ruta:** `POST /comments`

```json
{
  "reportId": "report-1",
  "content": "Nuevo comentario"
}
```

### Editar comentario
**Ruta:** `PUT /comments/:commentId`

```json
{
  "content": "Comentario editado"
}
```

---

## 11. Regla funcional importante para evitar confusiones

En este frontend:

- `report.comments` = comentario/nota del reporte
- `/comments` = conversación pública del reporte

Si quieres que “cada comentario y reporte vayan de la mano”, entonces backend debe asegurar que **cada comentario público tenga un `reportId` válido y que `GET /comments?reportId=:id` devuelva todos los comentarios de ese reporte**.

---

## 12. Recomendación práctica para depurar ya mismo

Para un reporte real, revisa en backend o Postman estas tres llamadas seguidas:

1. `POST /comments`
2. verificar en Neon que existe el registro
3. `GET /comments?reportId=<mismo reportId>`

Si el comentario existe en Neon pero no aparece en el paso 3, el fallo está en el endpoint de lectura o en su serialización.

Si aparece en el paso 3 pero con nombres de campo distintos, este frontend ahora tiene más tolerancia para absorberlo.
