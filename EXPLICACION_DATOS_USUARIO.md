# Explicación: Datos de Usuario en el Sistema

## 🔄 Flujo Completo de Datos

### Paso 1: Usuario Selecciona Método de Pago
**Estado de la Orden: PENDIENTE**

Datos que el bot puede obtener de Telegram automáticamente:
- ✅ **Nombre:** `first_name` + `last_name` (ej: "IDN Test")
- ✅ **Username:** `@username` (ej: "@IDNtestbot")
- ❌ **Número de Teléfono:** NO disponible automáticamente

**¿Por qué el número NO está disponible?**
Por seguridad, Telegram NO comparte el número de teléfono del usuario con los bots automáticamente. Solo está disponible si:
1. El usuario usa el botón "Compartir contacto" 
2. El bot solicita permiso explícito (requiere configuración especial)

**Datos mostrados en el backoffice:**
```
Nombre: IDN Test (nombre de Telegram)
Teléfono: @IDNtestbot (username de Telegram)
Dirección: Pendiente
```

---

### Paso 2: Usuario Envía Comprobante
**Estado de la Orden: A CONFIRMAR**

- ✅ Comprobante guardado
- ✅ Bot pide datos de contacto
- Los datos siguen siendo los de Telegram hasta que el usuario los proporcione

**Datos mostrados en el backoffice:**
```
Nombre: IDN Test (todavía datos de Telegram)
Teléfono: @IDNtestbot (todavía username de Telegram)
Dirección: Pendiente
```

---

### Paso 3: Usuario Envía Sus Datos Reales
**Estado de la Orden: A CONFIRMAR (con datos completos)**

El usuario envía sus datos en el formato:
```
Nombre: Juan Pérez
Teléfono: +54 9 11 1234-5678
Dirección: Av. Corrientes 1234, CABA
```

**¡AUTOMÁTICAMENTE los datos se actualizan!**

**Datos mostrados en el backoffice DESPUÉS:**
```
Nombre: Juan Pérez ← ACTUALIZADO
Teléfono: +54 9 11 1234-5678 ← ACTUALIZADO
Dirección: Av. Corrientes 1234, CABA ← ACTUALIZADO
```

**Información de Telegram conservada en el modal:**
```
Usuario: @IDNtestbot
Nombre TG: IDN Test
Chat ID: 8444568318
```

---

## 📊 Comparación Visual

### Orden SIN datos reales (Pendiente/A Confirmar)
```
┌─────────────────────────────────────┐
│ Nombre: IDN Test                    │ ← Dato de Telegram
│ Teléfono: @IDNtestbot              │ ← Username de Telegram
│ Dirección: Pendiente                │ ← Esperando datos
└─────────────────────────────────────┘
```

### Orden CON datos reales (A Confirmar - completa)
```
┌─────────────────────────────────────┐
│ Nombre: Juan Pérez                  │ ← DATO REAL
│ Teléfono: +54 9 11 1234-5678       │ ← NÚMERO REAL
│ Dirección: Av. Corrientes 1234     │ ← DIRECCIÓN REAL
└─────────────────────────────────────┘

Información de Telegram (conservada):
  Usuario: @IDNtestbot
  Nombre TG: IDN Test
  Chat ID: 8444568318
```

---

## 🔑 Puntos Clave

1. **Datos Iniciales (automáticos de Telegram):**
   - ✅ Nombre: Obtenido de Telegram
   - ⚠️ Teléfono: Username de Telegram (NO el número real)
   - ❌ Dirección: "Pendiente"

2. **Datos Finales (proporcionados por el usuario):**
   - ✅ Nombre: Dato real del usuario
   - ✅ Teléfono: Número real del usuario
   - ✅ Dirección: Dirección real del usuario

3. **Actualización Automática:**
   - Cuando el usuario envía sus datos, el sistema REEMPLAZA automáticamente los datos de Telegram con los datos reales
   - Los datos de Telegram se conservan en una sección separada para referencia

---

## ⚙️ Configuración Actual del Sistema

El sistema está configurado para:
1. ✅ Capturar datos de Telegram automáticamente al crear la orden
2. ✅ Mostrar estos datos mientras el usuario no proporcione los suyos
3. ✅ Reemplazar automáticamente con datos reales cuando el usuario los envía
4. ✅ Conservar información de Telegram para referencia del admin

**Esto proporciona la mejor experiencia:**
- El admin ve información inmediatamente (aunque sea temporal)
- El sistema se actualiza automáticamente con datos reales
- No se pierde la trazabilidad (datos de Telegram conservados)

---

## 🚀 Mejora Futura (Opcional)

Si necesitas obtener el número de teléfono real de Telegram, puedes:
1. Agregar un botón "Compartir mi contacto" en el bot
2. Configurar el bot para solicitar contacto explícitamente
3. El usuario acepta compartir su número
4. El número real de Telegram se guarda automáticamente

**Sin embargo, esto requiere una configuración especial y puede reducir la tasa de conversión (algunos usuarios no quieren compartir su número).**
