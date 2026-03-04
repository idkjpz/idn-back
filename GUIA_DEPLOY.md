# Guía de Despliegue a Producción (IDN Backoffice)

Esta guía detalla los pasos exactos para subir tu aplicación (Frontend y Backend) a producción de forma gratuita o a bajo costo.

Actualmente, el proyecto ya cuenta con los archivos de configuración listos para las siguientes plataformas:
- **Frontend (React)**: Preparado para [Vercel](https://vercel.com) (usa `vercel.json`).
- **Backend (FastAPI)**: Preparado para [Railway](https://railway.app) (usa `railway.toml`) o [Render](https://render.com) (usa `render.yaml`).
- **Base de Datos**: MongoDB (recomendado [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)).

---

## 1. Preparar la Base de Datos (MongoDB Atlas)

Actualmente estás usando una base de datos local o ya tienes una URL de producción. Si aún no tienes una en la nube:
1. Crea una cuenta gratuita en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Crea un Cluster gratuito (M0).
3. En **Database Access**, crea un usuario de base de datos y guarda la contraseña.
4. En **Network Access**, permite el acceso desde cualquier IP (`0.0.0.0/0`).
5. Haz clic en **Connect** -> **Connect your application** y copia tu `URL de Conexión` (reemplazando `<password>` por tu contraseña real).
   - Ejemplo: `mongodb+srv://usuario:contraseña@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority`

---

## 2. Despliegue del Backend (API Python) - Opciones: Railway o Render

Recomendamos **Railway** por su facilidad con Python, pero el archivo `render.yaml` también está listo.

### Opción A: Usar Railway (Recomendado)
1. Sube todo el código de tu carpeta `backend` a un repositorio en **GitHub**. (O sube toda la carpeta del proyecto).
2. Crea una cuenta en [Railway.app](https://railway.app/).
3. Haz clic en **New Project** -> **Deploy from GitHub repo**.
4. Selecciona el repositorio de tu proyecto.
5. Si Railway te pregunta qué carpeta desplegar, asegúrate de indicarle el *Root Directory* de tu backend: `/backoffice-idn-main/backoffice-idn-main/backend`.
6. Ve a la pestaña **Variables** en Railway y agrega las siguientes variables de entorno (puedes copiarlas de tu `.env` del backend):
   - `MONGO_URL` = La URL de conexión a MongoDB Atlas que obtuviste en el paso 1.
   - `DB_NAME` = `idn_backoffice` (o el nombre que prefieras).
   - `TELEGRAM_BOT_TOKEN` = Tu token de Telegram.
   - `ADMIN_USERNAME` = `admin` (u otro).
   - `ADMIN_PASSWORD_HASH` = El hash bcrypt de la contraseña que estás usando.
   - `JWT_SECRET` = Una clave secreta difícil de adivinar.
   - `JWT_EXPIRE_HOURS` = `24`
   - `CORS_ORIGINS` = `*` (Ojo: una vez subas el frontend a Vercel, cambia esto por la URL de Vercel para más seguridad, ej: `https://tu-sitio.vercel.app`).
7. Railway construirá la app utilizando el archivo `railway.toml`.
8. Ve a la pestaña **Settings** -> **Public Networking** y genera un dominio público.
   - **Guarda esta URL generada**, la necesitarás para el Frontend.

### Opción B: Usar Render
1. Sube tu código a GitHub.
2. Inicia sesión en [Render.com](https://render.com).
3. Haz clic en **New** -> **Blueprint**.
4. Conecta tu repositorio. Render leerá automáticamente el archivo `render.yaml` que está en la raíz de tu proyecto.
5. Sigue los pasos y añade las variables de entorno (`Environment Variables`) que te pida en el panel de Render, basándote en la lista de arriba.

---

## 3. Despliegue del Frontend (Panel React) en Vercel

1. Entra a la carpeta del `frontend` en tu código local.
2. Abre el archivo `.env` del frontend (o créalo si no existe en producción).
3. Asegúrate de modificar (o que Vercel tenga configurada) la variable `REACT_APP_BACKEND_URL` para que apunte a la URL pública que te dio Railway o Render.
   - **Ejemplo**: `REACT_APP_BACKEND_URL=https://idn-backend-production.up.railway.app`
4. Sube tu carpeta de proyecto a **GitHub** (o asume que ya está subida si subiste todo el proyecto en el paso 2).
5. Crea una cuenta en [Vercel.com](https://vercel.com).
6. Haz clic en **Add New** -> **Project**.
7. Selecciona tu repositorio de GitHub.
8. En la configuración del proyecto (Build & Development Settings):
   - **Framework Preset**: `Create React App`
   - **Root Directory**: `backoffice-idn-main/backoffice-idn-main/frontend` (o la ruta donde esté la carpeta de React).
9. Expande la sección **Environment Variables** y agrega:
   - Name: `REACT_APP_BACKEND_URL`
   - Value: `URL_DE_TU_BACKEND` (Sin `/api` al final, ejemplo: `https://idn-backend-production.up.railway.app`).
10. Haz clic en **Deploy**.

Vercel instalará todo y te dará una URL en vivo (ejemplo: `https://mi-panel-idn.vercel.app`).

---

## 4. Pasos Finales
1. Entra a la URL que te dio Vercel. Deberías ver la pantalla de Login del Backoffice.
2. Comprueba que puede conectarse correctamente introduciendo el usuario administrador.
3. El archivo `vercel.json` incluido ya maneja las rutas de React, por lo que si recargas la página (F5) en cualquier sección del panel, no dará error "404 Not Found".
4. **Seguridad**: Ahora que sabes la URL final de Vercel, entra a las variables de entorno de tu Backend (en Railway o Render) y cambia `CORS_ORIGINS` para que tenga el valor de tu URL de Vercel (ej: `https://mi-panel-idn.vercel.app`). Reinicia el Backend.

¡Con esto tu plataforma estará completamente subida a producción y funcional 24/7!
