# Sistema de Asesoramiento del Bot de Telegram

## 📋 Descripción General

Se ha implementado un sistema completo de asesoramiento que permite a los clientes solicitar ayuda directamente desde el bot de Telegram, pudiendo elegir entre contactar por WhatsApp o Telegram.

## 🔧 Componentes Implementados

### Backend (`/app/backend/server.py`)

#### 1. Nuevos Endpoints API

**Configuración de Usuario de Telegram de Soporte:**
```python
GET  /api/telegram-support-config  # Obtiene el usuario configurado
PUT  /api/telegram-support-config  # Actualiza el usuario de soporte
```

**Funciones auxiliares:**
```python
async def get_whatsapp_support() -> str
async def get_telegram_support() -> str
```

#### 2. Flujo del Bot

**Botón en Menú Principal:**
- Nuevo botón: "💬 Necesito Asesoramiento"
- Aparece en el menú principal junto a las opciones de listas

**Handler de Asesoramiento:**
- Cuando el usuario presiona "Necesito Asesoramiento"
- El bot muestra dos opciones (si están configuradas):
  1. "💚 Contactar por WhatsApp" - Abre WhatsApp Web con el número configurado
  2. "💙 Contactar por Telegram" - Abre chat con el usuario de soporte configurado
- Incluye botón "⬅️ Volver al Menú"
- Si ningún método está configurado, muestra mensaje de servicio no disponible

### Frontend (`/app/frontend/src/pages/BotConfig.jsx`)

#### Nueva Sección: Usuario de Telegram de Asesoramiento

**Características:**
- Ubicación: Después de la sección de WhatsApp en Configuración Bot
- Campo editable para ingresar usuario de Telegram (sin @)
- Validación y formato automático
- Toast de confirmación al actualizar
- Muestra "@usuario" en modo visualización

**Funciones agregadas:**
```javascript
fetchTelegramSupportConfig()
handleSaveTelegramSupport()
```

## 🔄 Flujo Completo del Usuario

### Desde el Bot de Telegram:

1. **Usuario inicia el bot** (`/start`)
   - Ve el menú principal con las opciones habituales

2. **Usuario presiona "💬 Necesito Asesoramiento"**
   - El bot verifica qué métodos de contacto están configurados

3. **El bot muestra las opciones disponibles:**
   - Si hay WhatsApp: botón "💚 Contactar por WhatsApp"
   - Si hay Telegram: botón "💙 Contactar por Telegram"
   - Siempre: botón "⬅️ Volver al Menú"

4. **Usuario selecciona su preferencia:**
   - **WhatsApp**: Se abre WhatsApp Web con el número configurado
   - **Telegram**: Se abre el chat con el usuario de soporte
   - **Volver**: Regresa al menú principal

### Desde el Backoffice:

1. Ir a "Configuración Bot"
2. Configurar:
   - Número de WhatsApp (si no está configurado)
   - Usuario de Telegram de Asesoramiento
3. Guardar cambios
4. Los clientes verán las opciones automáticamente en el bot

## 💬 Mensajes del Bot

### Mensaje de Asesoramiento:
```
💬 **¿Necesitas Asesoramiento?**

Elige cómo prefieres contactarnos y un asesor te atenderá:
```

### Mensaje de Servicio No Disponible:
```
⚠️ Lo sentimos, el servicio de asesoramiento no está disponible en este momento.

Por favor, intenta más tarde.
```

## 🧪 Testing

### Backend
```bash
# Obtener configuración actual
curl http://localhost:8001/api/telegram-support-config

# Actualizar usuario de soporte
curl -X PUT http://localhost:8001/api/telegram-support-config \
  -H "Content-Type: application/json" \
  -d '{"username":"soporte_idn"}'
```

### Frontend
1. Navegar a "Configuración Bot"
2. Verificar sección "Usuario de Telegram de Asesoramiento"
3. Hacer clic en "Editar"
4. Ingresar usuario (ej: soporte_idn)
5. Guardar y verificar mensaje de éxito

### Bot (Telegram)
1. Iniciar bot con `/start`
2. Presionar "💬 Necesito Asesoramiento"
3. Verificar que aparezcan ambas opciones (WhatsApp y Telegram)
4. Hacer clic en cada opción y verificar que abra correctamente:
   - WhatsApp: debe abrir wa.me/[número]
   - Telegram: debe abrir t.me/[usuario]

## 🔒 Validaciones

### Usuario de Telegram
- Se elimina automáticamente el símbolo @ si el usuario lo incluye
- Campo requerido (no puede estar vacío)

### Disponibilidad de Opciones
- Si solo WhatsApp está configurado: solo muestra esa opción
- Si solo Telegram está configurado: solo muestra esa opción
- Si ambos están configurados: muestra ambas opciones
- Si ninguno está configurado: mensaje de servicio no disponible

## 📝 Base de Datos

### Colección: `bot_config`

**Documento de WhatsApp:**
```javascript
{
  key: "whatsapp_number",
  value: "5491123456789",
  updated_at: "2025-11-30T04:30:00.000Z"
}
```

**Documento de Telegram Support:**
```javascript
{
  key: "telegram_support_user",
  value: "soporte_idn",
  updated_at: "2025-11-30T04:30:00.000Z"
}
```

## 🚀 Mejoras Futuras

1. **Horarios de Atención:** Configurar horarios y mostrar disponibilidad
2. **Múltiples Asesores:** Permitir configurar varios usuarios de soporte
3. **Sistema de Turnos:** Implementar cola de espera o asignación automática
4. **Mensajes Personalizados:** Permitir personalizar el mensaje de asesoramiento
5. **Estadísticas:** Trackear cuántos usuarios solicitan asesoramiento y por qué canal
6. **Auto-respuesta:** Agregar respuestas automáticas fuera de horario

## 🎯 Estado Actual

✅ **COMPLETADO**
- Configuración de WhatsApp en backoffice
- Configuración de usuario de Telegram en backoffice
- Botón de asesoramiento en menú del bot
- Flujo completo con opciones dinámicas
- Validaciones y manejo de errores
- UI completa en backoffice

⏳ **PENDIENTE DE TESTING**
- Prueba real con bot de Telegram activo
- Verificación de enlaces generados
- Testing de edge cases (configuraciones vacías, etc.)
