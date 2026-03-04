# Sistema de Chat en Vivo

## 📋 Descripción General

Sistema completo de chat en tiempo real que permite a los administradores recibir y responder mensajes de clientes directamente desde el backoffice. Los clientes inician el chat desde el bot de Telegram y todo se gestiona en una interfaz centralizada.

## 🔧 Componentes Implementados

### Backend (`/app/backend/server.py`)

#### 1. Modelos de Datos

**ChatMessage:**
```python
{
    id: str,
    conversation_id: str,
    chat_id: int,
    message: str,
    sender: str,  # "client" o "admin"
    timestamp: datetime,
    read: bool
}
```

**Conversation:**
```python
{
    id: str,
    chat_id: int,
    client_name: str,
    client_username: str,
    status: str,  # "active" o "closed"
    last_message: str,
    last_message_time: datetime,
    unread_count: int,
    created_at: datetime
}
```

#### 2. Gestión de Estado

- `active_chats = {}` - Tracking de conversaciones activas
- Cada entrada: `{chat_id: {"conversation_id": str, "active": bool}}`

#### 3. Endpoints API

**GET `/api/conversations`**
- Obtiene todas las conversaciones
- Ordenadas por última actividad
- Incluye contador de mensajes no leídos

**GET `/api/conversations/{conversation_id}/messages`**
- Obtiene todos los mensajes de una conversación
- Ordenados cronológicamente
- Marca automáticamente como leídos

**POST `/api/conversations/{conversation_id}/messages`**
- Envía mensaje del admin al cliente
- Guarda en BD
- Envía vía Telegram al cliente
- Body: `{"message": "texto del mensaje"}`

**PUT `/api/conversations/{conversation_id}/mark-read`**
- Marca todos los mensajes como leídos
- Resetea contador de no leídos

#### 4. Flujo del Bot

**Activar Chat:**
- Cliente presiona "💬 Chat en Vivo con Asesor"
- Se crea/recupera conversación en BD
- Se activa modo chat para ese `chat_id`
- Cliente ve confirmación y puede empezar a escribir

**Durante el Chat:**
- Todos los mensajes del cliente se guardan en BD
- Se incrementa contador de no leídos
- Se actualiza `last_message` y `last_message_time`
- Cliente recibe confirmación: "✅ Mensaje recibido"

**Finalizar Chat:**
- Cliente presiona "❌ Finalizar Chat"
- Estado cambia a "closed"
- Se desactiva modo chat
- Cliente ve confirmación

### Frontend (`/app/frontend/src/pages/LiveChat.jsx`)

#### 1. Diseño de Interfaz

**Layout de 2 Paneles:**
- **Panel Izquierdo (33%):** Lista de conversaciones
- **Panel Derecho (67%):** Área de chat

**Panel de Conversaciones:**
- Muestra todas las conversaciones (activas y cerradas)
- Información visible:
  - Nombre del cliente
  - Username de Telegram
  - Último mensaje (truncado)
  - Fecha y hora
  - Badge con mensajes no leídos
  - Estado (Activo/Cerrado)
- Highlight de conversación seleccionada
- Ordenadas por actividad reciente

**Panel de Chat:**
- Header: Info del cliente y estado
- Área de mensajes con scroll
- Mensajes del admin: fondo azul, alineados a la derecha
- Mensajes del cliente: fondo gris, alineados a la izquierda
- Timestamp en cada mensaje
- Input para responder
- Botón "Enviar"
- Deshabilitado si conversación está cerrada

#### 2. Funcionalidades en Tiempo Real

**Polling Automático:**
- Cada 3 segundos:
  - Actualiza lista de conversaciones
  - Actualiza mensajes de conversación activa
- Detecta nuevos mensajes automáticamente
- Actualiza contador de no leídos

**Auto-scroll:**
- Scroll automático a último mensaje
- Al enviar mensaje
- Al recibir mensaje nuevo

**Notificación Visual:**
- Badge rojo con número de mensajes no leídos
- Se resetea al abrir conversación

#### 3. Estados de UI

- `loading` - Cargando conversaciones iniciales
- `sending` - Enviando mensaje
- Estados vacíos:
  - Sin conversaciones: "No hay conversaciones activas"
  - Sin conversación seleccionada: "Selecciona una conversación"
  - Sin mensajes: "No hay mensajes en esta conversación"

## 🔄 Flujo Completo de Usuario

### Desde el Bot de Telegram:

1. **Cliente inicia chat:**
   - Va a "💬 Necesito Asesoramiento"
   - Presiona "💬 Chat en Vivo con Asesor"
   - Ve: "✅ Chat en Vivo Activado"

2. **Cliente envía mensajes:**
   - Escribe mensaje normal en el bot
   - Recibe: "✅ Mensaje recibido. Un asesor te responderá pronto."

3. **Cliente recibe respuesta:**
   - Llega mensaje: "💬 **Asesor:** [mensaje]"
   - Puede continuar conversación

4. **Cliente finaliza:**
   - Presiona "❌ Finalizar Chat"
   - Ve: "✅ Chat Finalizado"
   - Puede volver al menú principal

### Desde el Backoffice:

1. **Admin ve nueva conversación:**
   - Aparece en lista de conversaciones
   - Badge rojo muestra mensajes no leídos

2. **Admin abre conversación:**
   - Click en la conversación
   - Ve historial completo
   - Mensajes se marcan como leídos automáticamente

3. **Admin responde:**
   - Escribe en el input
   - Presiona "Enviar" o Enter
   - Mensaje llega instantáneamente al cliente vía Telegram

4. **Admin ve actualizaciones:**
   - Nuevos mensajes aparecen automáticamente (cada 3 seg)
   - No necesita refrescar página

## 📊 Base de Datos

### Colecciones:

**`conversations`**
```javascript
{
  id: "uuid",
  chat_id: 987654321,
  client_name: "Juan Pérez",
  client_username: "@juanperez",
  status: "active",
  last_message: "Hola, necesito ayuda",
  last_message_time: "2025-11-30T04:50:00.000Z",
  unread_count: 2,
  created_at: "2025-11-30T04:45:00.000Z"
}
```

**`chat_messages`**
```javascript
{
  id: "uuid",
  conversation_id: "conv-uuid",
  chat_id: 987654321,
  message: "Hola, ¿en qué puedo ayudarte?",
  sender: "admin",
  timestamp: "2025-11-30T04:50:30.000Z",
  read: true
}
```

## 🎨 Diseño y UX

### Colores:
- **Mensajes Admin:** `bg-indigo-600` (azul)
- **Mensajes Cliente:** `bg-gray-100` (gris claro)
- **Badge No Leídos:** `bg-red-500` (rojo)
- **Conversación Activa:** `bg-indigo-50` (azul claro)
- **Estado Activo:** `bg-green-100` (verde)

### Tipografía:
- Nombres: `font-semibold`
- Mensajes: `text-sm`
- Timestamps: `text-xs`

### Íconos:
- Lista: `MessageCircle`
- Usuario: `User`
- Reloj: `Clock`
- Enviar: `Send`

## 🧪 Testing

### Backend:
```bash
# Obtener conversaciones
curl http://localhost:8001/api/conversations

# Obtener mensajes
curl http://localhost:8001/api/conversations/{id}/messages

# Enviar mensaje
curl -X POST http://localhost:8001/api/conversations/{id}/messages \
  -H "Content-Type: application/json" \
  -d '{"message":"Hola desde el backoffice"}'
```

### Frontend:
1. Abrir página "Chat en Vivo"
2. Iniciar chat desde bot de Telegram
3. Verificar que aparece en lista
4. Enviar mensaje desde bot
5. Verificar que aparece en backoffice
6. Responder desde backoffice
7. Verificar que llega al bot
8. Finalizar chat desde bot

## ⚠️ Consideraciones Importantes

### Limitaciones Actuales:
- **Polling:** Usa polling (3 seg) en lugar de WebSockets
- **Escalabilidad:** No optimizado para miles de conversaciones simultáneas
- **Persistencia:** Mensajes se guardan indefinidamente (considerar archivado)

### Seguridad:
- ✅ Validación de mensajes vacíos
- ✅ Manejo de errores al enviar vía Telegram
- ✅ Sanitización de entrada (básica)
- ⚠️ Falta: Rate limiting
- ⚠️ Falta: Autenticación de admin

### Performance:
- Polling cada 3 segundos puede generar carga
- Considerar aumentar intervalo si hay muchas conversaciones
- Implementar WebSockets para producción

## 🚀 Mejoras Futuras

### Corto Plazo:
1. **Notificaciones de Sonido:** Alert cuando llega mensaje nuevo
2. **Typing Indicator:** "Admin está escribiendo..."
3. **Adjuntar Archivos:** Imágenes, documentos
4. **Emojis:** Selector de emojis en el input

### Mediano Plazo:
5. **WebSockets:** Mensajes en tiempo real sin polling
6. **Respuestas Rápidas:** Templates de respuestas frecuentes
7. **Transferir Chat:** A otro admin
8. **Notas Internas:** Comentarios privados sobre el cliente

### Largo Plazo:
9. **Chatbot IA:** Respuestas automáticas inteligentes
10. **Analytics:** Tiempo de respuesta, satisfacción
11. **Multi-idioma:** Traducción automática
12. **Integraciones:** Slack, WhatsApp, Email

## 📈 Métricas Sugeridas

- Número de conversaciones iniciadas por día
- Tiempo promedio de primera respuesta
- Tiempo promedio de resolución
- Mensajes enviados/recibidos por conversación
- Tasa de conversaciones cerradas por cliente
- Horarios pico de consultas

## 🎯 Estado Actual

✅ **COMPLETADO:**
- Interfaz completa de chat
- Gestión de conversaciones
- Mensajería bidireccional
- Historial persistente
- Contador de no leídos
- Estados de conversación
- Polling automático
- Auto-scroll
- Formato de mensajes
- Timestamps

⏳ **PENDIENTE DE TESTING REAL:**
- Prueba con bot de Telegram activo
- Múltiples conversaciones simultáneas
- Prueba de carga (muchos mensajes)
- Edge cases (bot desconectado, etc.)

## 💡 Tips de Uso

**Para Admins:**
- Mantén abierta la página de Chat en Vivo en una pestaña
- Responde rápido para mejorar satisfacción
- Usa mensajes claros y concisos
- Cierra conversaciones resueltas desde el bot (pide al cliente)

**Monitoreo:**
- Badge rojo indica mensajes sin leer
- Conversaciones más recientes aparecen arriba
- Estado "Cerrado" indica que el cliente finalizó

**Mejores Prácticas:**
- Saluda siempre al iniciar
- Pregunta en qué puedes ayudar
- Resume lo acordado antes de finalizar
- Invita al cliente a contactarte nuevamente
