# Flujo Correcto del Pedido

## 📊 Diagrama del Flujo

```
┌─────────────────────────────────────────────────────────────────┐
│ PASO 1: Usuario selecciona método de pago                      │
├─────────────────────────────────────────────────────────────────┤
│ Bot Actions:                                                     │
│  1. ✅ Crear orden en estado "pendiente" en el backoffice       │
│  2. 📤 Enviar datos bancarios (CBU/Wallet USDT)                │
│  3. 📸 Solicitar comprobante de pago                            │
│                                                                  │
│ Estado en Backoffice: 🟡 PENDIENTE                             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ PASO 2: Usuario envía comprobante (foto/PDF)                   │
├─────────────────────────────────────────────────────────────────┤
│ Bot Actions:                                                     │
│  1. ✅ Recibir y guardar file_id del comprobante                │
│  2. 🔄 Cambiar estado a "a_confirmar"                           │
│  3. 📋 Mostrar mensaje "Pedido registrado" con ID y total      │
│  4. 📝 Solicitar datos de contacto (nombre, teléfono, dirección)│
│                                                                  │
│ Estado en Backoffice: 🟠 A CONFIRMAR                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ PASO 3: Usuario envía datos de contacto                        │
├─────────────────────────────────────────────────────────────────┤
│ Bot Actions:                                                     │
│  1. ✅ Actualizar orden con nombre, teléfono y dirección        │
│  2. ✅ Confirmar que los datos fueron recibidos                 │
│                                                                  │
│ Estado en Backoffice: 🟠 A CONFIRMAR (listo para revisión)    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ PASO 4: Admin revisa en el backoffice                          │
├─────────────────────────────────────────────────────────────────┤
│ Admin Actions:                                                   │
│  1. 👁️ Ver detalles del pedido                                 │
│  2. 📸 Ver comprobante de pago                                  │
│  3. ✅ Cambiar estado a "confirmado", "en_preparacion", etc.   │
│                                                                  │
│ Estado en Backoffice: 🟢 CONFIRMADO → 📦 EN PREPARACIÓN →     │
│                       🚚 ENTREGADO                              │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 Estados del Pedido

| Estado | Descripción | Cuándo ocurre |
|--------|-------------|---------------|
| 🟡 **pendiente** | Pedido creado, esperando comprobante | Al seleccionar método de pago |
| 🟠 **a_confirmar** | Comprobante recibido, esperando confirmación del admin | Al enviar comprobante |
| 🟢 **confirmado** | Admin confirmó el pago | Manual por admin |
| 📦 **en_preparacion** | Pedido está siendo preparado | Manual por admin |
| 🚚 **entregado** | Pedido entregado al cliente | Manual por admin |
| ❌ **cancelado** | Pedido cancelado | Manual por admin |
| 🚫 **spam** | Marcado como spam | Manual por admin |

## 💬 Mensajes del Bot

### Paso 1: Selección de método de pago
```
[Datos bancarios o wallet USDT]

📸 COMPROBANTE DE PAGO

Por favor, envía el comprobante de tu pago como imagen o PDF.
Una vez que recibamos tu comprobante, te pediremos tus datos de contacto para completar el pedido.
```

### Paso 2: Recepción de comprobante
```
✅ ¡Comprobante recibido! Pedido registrado.

📋 ID del Pedido: [ID]
💰 Total: $[TOTAL]
📅 Fecha: [FECHA]
📊 Estado: A Confirmar

Tu pedido ha sido registrado en nuestro sistema y está pendiente de confirmación.

---

📝 Para completar tu pedido, necesito los siguientes datos:

Por favor envía tu información en este formato:
Nombre: [Tu nombre completo]
Teléfono: [Tu número de teléfono]
Dirección: [Tu dirección de entrega]
```

### Paso 3: Recepción de datos
```
✅ ¡Perfecto! Tus datos han sido registrados.

Tu pedido está completo y nuestro equipo lo revisará pronto.
Te contactaremos para confirmar el envío.

¡Gracias por tu compra! 💪
```

## 🔍 Puntos Clave

1. ✅ La orden se crea INMEDIATAMENTE al seleccionar método de pago
2. ✅ El estado "pendiente" significa "esperando comprobante"
3. ✅ El estado "a_confirmar" significa "comprobante recibido, esperando confirmación del admin"
4. ✅ Los datos de contacto se piden DESPUÉS del comprobante
5. ✅ El admin puede ver el comprobante desde el backoffice para verificar el pago
