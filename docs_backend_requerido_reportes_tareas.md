# Requerimientos de backend para tareas y asociación con reportes

Este documento resume lo que el frontend ahora intenta hacer y lo que backend debe soportar para que quede persistido en base de datos, no solo en fallback local.

## 1. Tareas

El frontend ya intenta usar estas rutas primero:

- `GET /tasks`
- `POST /tasks`
- `PATCH /tasks/:taskId`

Si fallan o no existen, cae a persistencia local en navegador.

### 1.1 Modelo recomendado de tarea

```json
{
  "id": "task-1",
  "title": "Preparar pruebas de integración",
  "description": "Definir casos, ejecutar pruebas y documentar resultados.",
  "subgroupId": "subgroup-1",
  "subgroupName": "Proyecto X",
  "assigneeId": "user-1",
  "assigneeName": "Ana Pérez",
  "assigneeEmail": "ana@example.com",
  "assigneeRole": "Miembro",
  "mentorOrLeaderIds": ["leader-1", "mentor-1"],
  "startDate": "2026-03-20",
  "endDate": "2026-03-28",
  "status": "en_progreso",
  "progressNote": "Se avanzó en los casos críticos.",
  "labels": ["Alta prioridad"],
  "score": "parcial",
  "reviewNote": "Falta cerrar evidencia.",
  "subtasks": [
    {
      "id": "subtask-1",
      "title": "Definir casos críticos",
      "done": true
    },
    {
      "id": "subtask-2",
      "title": "Adjuntar capturas",
      "done": false
    }
  ],
  "linkedReportIds": ["report-1"],
  "leaderValidation": {
    "checked": false,
    "reviewerId": null,
    "reviewerName": null,
    "reviewedAt": null
  },
  "createdAt": "2026-03-22T10:00:00.000Z",
  "updatedAt": "2026-03-22T10:30:00.000Z"
}
```

## 2. Crear tarea

### Ruta
`POST /tasks`

### Payload esperado por frontend

```json
{
  "title": "Preparar pruebas de integración",
  "description": "Definir casos, ejecutar pruebas y documentar resultados.",
  "subgroupId": "subgroup-1",
  "subgroupName": "Proyecto X",
  "assigneeId": "user-1",
  "assigneeName": "Ana Pérez",
  "assigneeEmail": "ana@example.com",
  "assigneeRole": "Miembro",
  "mentorOrLeaderIds": ["leader-1", "mentor-1"],
  "startDate": "2026-03-20",
  "endDate": "2026-03-28",
  "status": "pendiente",
  "progressNote": "",
  "labels": [],
  "score": "sin_revisar",
  "reviewNote": "",
  "subtasks": [
    { "title": "Definir casos críticos", "done": false },
    { "title": "Adjuntar capturas", "done": false }
  ],
  "leaderValidation": { "checked": false }
}
```

## 3. Editar tarea

### Ruta
`PATCH /tasks/:taskId`

### Backend debe permitir modificar como mínimo
- `title`
- `description`
- `startDate`
- `endDate`
- `status`
- `progressNote`
- `labels`
- `score`
- `reviewNote`
- `subtasks`
- `leaderValidation`
- `linkedReportIds`

Esto es importante porque frontend ya deja:
- ampliar plazo
- cambiar descripción
- editar subtareas
- actualizar bitácora
- validar por líder

## 4. Listar tareas

### Ruta
`GET /tasks`

### Query params recomendados
- `subgroupId`
- `assigneeId`
- `from`
- `to`

### Shapes que el frontend ya tolera
- `{ "tasks": [...] }`
- `{ "data": [...] }`
- `{ "data": { "tasks": [...] } }`
- `{ "items": [...] }`
- `[...]`

### Identificación correcta del responsable
Para que el usuario asignado vea su tarea en frontend, backend debería devolver de forma consistente al menos uno de estos campos:

- `assigneeId`
- `assignee.id`
- `assignedToId`
- `assignedTo.id`
- `responsibleId`
- `responsible.id`

Y preferiblemente también:

- `assigneeEmail` o `assignee.email`

Esto ayuda a que el frontend resuelva correctamente la visibilidad aunque cambie el shape del objeto responsable.

## 5. Asociar reportes a tareas

El frontend ya deja seleccionar tareas al crear o editar un reporte, **pero solo muestra tareas cuyo rango cubre la fecha del reporte y que además estén asignadas al usuario que crea/edita el reporte**. Los administradores pueden ver todas.

### Regla funcional
Una tarea es elegible si:

```text
startDate <= reportDate <= endDate
```

## 6. Crear reporte con tareas asociadas

### Ruta
`POST /reports`

### Campos adicionales que backend debería aceptar
- `reportDate`
- `taskIds` (puede venir repetido en `FormData` o como arreglo)

Ejemplo conceptual:

```text
FormData:
- title
- markdown
- comments
- reportDate
- subgroupId
- externalLinks
- taskIds=task-1
- taskIds=task-2
- attachments[]
```

## 7. Editar reporte con tareas asociadas

### Rutas
- `PUT /reports/:id`
- fallback `PATCH /reports/:id`

### Payload esperado

```json
{
  "title": "Reporte semanal",
  "markdown": "## Avance\n...",
  "comments": "Nota adicional",
  "reportDate": "2026-03-22",
  "subgroupId": "subgroup-1",
  "externalLinks": "https://evidencia-1, https://evidencia-2",
  "taskIds": ["task-1", "task-2"]
}
```

## 8. Lectura de reporte con tareas

Cuando frontend pida:

- `GET /reports/:id`

sería ideal que backend devuelva también:

```json
{
  "report": {
    "id": "report-1",
    "title": "Reporte semanal",
    "description": "## Avance\n...",
    "reportDate": "2026-03-22T10:00:00.000Z",
    "taskIds": ["task-1", "task-2"]
  }
}
```

Mejor aún, si quieres evitar una segunda resolución en frontend, también puede devolver una relación expandida:

```json
{
  "report": {
    "id": "report-1",
    "taskIds": ["task-1", "task-2"],
    "tasks": [
      {
        "id": "task-1",
        "title": "Preparar pruebas de integración",
        "startDate": "2026-03-20",
        "endDate": "2026-03-28"
      }
    ]
  }
}
```

## 9. Qué falta en backend para completar lo pedido

Para cumplir al 100% con lo que pediste, backend debería implementar o confirmar:

1. Persistencia real de tareas en DB.
2. CRUD de tareas con edición de plazo y subtareas.
3. Asociación persistida entre reportes y tareas (`taskIds` o tabla pivote equivalente).
4. Filtro correcto por rango de fechas para que un reporte se vincule solo a tareas vigentes en su fecha.
5. Respuestas consistentes de `GET /tasks` y `GET /reports/:id` incluyendo ids de relación.

Si alguno de esos puntos no existe, el frontend puede mostrar parte del flujo, pero no podrá garantizar persistencia multiusuario en DB.
