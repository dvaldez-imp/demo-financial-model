# Frontend MVP de Modelado Financiero

Frontend en Next.js 16 + App Router para un tablero de modelado financiero conectado a FastAPI.

## Correr local

1. Crear `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

2. Instalar dependencias:

```bash
npm install
```

3. Levantar la app:

```bash
npm run dev
```

La entrada principal redirige al primer modelo disponible en `GET /models`.

## Scripts

- `npm run dev`
- `npm run lint`
- `npm run build`
- `npm run test`

## Alcance actual

- Rutas separadas por modelo:
	- `/models/[modelId]` resumen del modelo.
	- `/models/[modelId]/board` tablero principal.
	- `/models/[modelId]/library` biblioteca de premisas + outputs de otros modelos.
	- `/models/[modelId]/outputs` outputs exportables del modelo.
	- `/models/[modelId]/dependencies` arbol de dependencias con React Flow.
- Board principal con zonas claras de Historico, Proyeccion y Resumen anual.
- Timeline editable del modelo con "Historico hasta" y "Proyectar hasta" sin hardcode de anios.
- Colapso/expansion anual por doble click sobre encabezado de anio; mantiene visible la columna de resumen anual.
- Edicion de prediccion base y overrides por escenario con labels amigables.
- El rango de proyeccion de cada premisa hereda siempre el timeline del board (no se configura por premisa).
- Configuracion de resumen anual por premisa (Suma, Promedio, Ultimo valor).
- Accion de eliminar premisa desde el board con confirmacion y manejo de error backend.
- Biblioteca separada con busqueda, creacion de premisa y alta al modelo (incluye importacion desde outputs externos).
- Outputs en ruta dedicada con alta, renombre visible y cambio de estado reutilizable.
- Dependencias con seleccion de raiz, arbol interactivo, colapso por doble click y lista textual de dependencias unicas.

## Endpoints consumidos en frontend

- `GET /models/{model_id}/board`
- `PATCH /models/{model_id}/timeline`
- `POST /models/{model_id}/premises`
- `POST /models/{model_id}/premises/from-output`
- `DELETE /models/{model_id}/premises/{premise_id}`
- `GET /models/{model_id}/dependencies/tree?root_premise_id=...`
- `GET /models/{model_id}/outputs`
- `POST /models/{model_id}/outputs`
- `PATCH /models/{model_id}/outputs/{output_id}`
- `GET /catalog/model-outputs`
- `GET /library/premises`
- `POST /library/premises`
- `PATCH /premises/{premise_id}/prediction-config`
- `PATCH /premises/{premise_id}/variable-name`
- `PATCH /premises/{premise_id}/year-summary-config`
- `PATCH /library/premises/{premise_id}/variable-name`
- `POST /admin/reset-data`
