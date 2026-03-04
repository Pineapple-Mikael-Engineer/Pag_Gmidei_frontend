# Pag_Gmidei Frontend

Frontend en Next.js exportado como sitio estático para desplegar en **GitHub Pages** y consumir un backend desplegado en **Render**.

## Configuración para producción (GitHub Pages + Render)

1. En GitHub, abre tu repositorio → **Settings → Secrets and variables → Actions → Variables**.
2. Crea la variable de repositorio:
   - `NEXT_PUBLIC_API_URL` = URL pública de tu backend en Render + `/api`
   - Ejemplo: `https://mi-backend.onrender.com/api`
3. En **Settings → Pages**, selecciona **Build and deployment: GitHub Actions**.
4. Haz push a `main`. El workflow `.github/workflows/deploy.yml` compila y publica automáticamente en Pages.

## Desarrollo local

```bash
npm install
npm run dev
```

Opcionalmente define en local:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_BASE_PATH=
```

## Notas importantes

- El `basePath` se calcula automáticamente durante GitHub Actions usando el nombre del repositorio.
- El frontend redirige correctamente a login respetando `basePath` cuando el token expira.
