# Sistema de Verificación Automática de Pagos USDT (TRC20)

## 📋 Descripción General

Se ha implementado un sistema completo de verificación automática de pagos en USDT sobre la red TRC20 (TRON). El sistema permite:

1. Configurar la wallet TRON desde el backoffice
2. Validar transacciones automáticamente mediante la blockchain
3. Marcar pedidos como "pagado" de forma automática cuando la transacción es válida

## 🔧 Componentes Implementados

### Backend (`/app/backend/server.py`)

#### 1. Integración con TronPy
```python
from tronpy import Tron
from tronpy.providers import HTTPProvider

tron_client = Tron(provider=HTTPProvider(endpoint_uri="https://api.trongrid.io"))
```

#### 2. Gestión de Wallet TRON

**Endpoints nuevos:**
- `GET /api/tron-wallet` - Obtiene la wallet configurada
- `PUT /api/tron-wallet` - Actualiza la wallet TRON
  - Validación: Debe empezar con "T" y tener 34 caracteres

**Función auxiliar:**
```python
async def get_tron_wallet() -> str
```

#### 3. Flujo de Verificación en el Bot

**Cuando el usuario selecciona pago USDT:**
1. Se muestra la wallet TRON configurada
2. Se solicita el hash de transacción
3. Bot valida el formato del hash (64 caracteres hexadecimales)
4. Se consulta la blockchain TRC20 usando `tronpy`
5. Se valida:
   - Transacción existe y está confirmada
   - Estado: SUCCESS
   - Destinatario coincide con la wallet configurada
6. Si es válida, se solicitan datos de contacto
7. Se crea el pedido con estado "pagado" automáticamente

### Frontend (`/app/frontend/src/pages/BotConfig.jsx`)

#### Sección de Wallet TRON

**Características:**
- Visualización de wallet actual
- Botón "Editar" para modificar
- Validación en frontend (formato de 34 caracteres, empieza con "T")
- Toast de confirmación al actualizar
- Diseño consistente con el resto del backoffice

**Funciones agregadas:**
```javascript
fetchTronWallet()
handleSaveTronWallet()
```

## 🔄 Flujo Completo del Usuario (Bot)

1. Usuario selecciona productos y confirma pedido
2. Usuario elige método de pago "USDT"
3. Bot muestra:
   ```
   🪙 DATOS PARA PAGO EN USDT
   
   Red: TRC20
   Wallet: [wallet configurada]
   
   ⚠️ Importante: Asegúrate de usar la red TRC20
   ```
4. Bot solicita: "Envía el hash de transacción (TX ID)"
5. Usuario envía el hash
6. Bot verifica en blockchain (muestra "Verificando...")
7. Si es válida:
   - ✅ "Transacción verificada exitosamente"
   - Solicita datos de contacto
   - Crea pedido con estado "en_preparacion"
8. Si no es válida:
   - ❌ Mensaje de error específico

## 📊 Estados de Orden

Estado asignado automáticamente:
- **"en_preparacion"** - Para órdenes con USDT verificado automáticamente (pago confirmado, listo para preparar)

El hash de transacción se guarda en el documento de la orden:
```javascript
{
  ...order_data,
  transaction_hash: "abc123...",
  estado: "en_preparacion"
}
```

## 🧪 Testing

### Backend
```bash
# Obtener wallet actual
curl http://localhost:8001/api/tron-wallet

# Actualizar wallet
curl -X PUT http://localhost:8001/api/tron-wallet \
  -H "Content-Type: application/json" \
  -d '{"wallet":"TNuevoTestWallet123456789ABCDEFGH"}'
```

### Frontend
1. Navegar a "Configuración Bot"
2. Verificar que la wallet TRON se muestra
3. Hacer clic en "Editar"
4. Cambiar la wallet
5. Hacer clic en "Guardar"
6. Verificar mensaje de éxito

### Bot (Telegram)
⚠️ Requiere prueba real con una transacción USDT en TRC20

## 🔒 Validaciones Implementadas

### Formato de Wallet
- Debe empezar con "T"
- Debe tener exactamente 34 caracteres

### Hash de Transacción
- Debe tener 64 caracteres
- Solo caracteres hexadecimales (0-9, a-f, A-F)

### Transacción en Blockchain
- Transacción debe existir
- Estado debe ser "SUCCESS"
- Destinatario debe coincidir con wallet configurada

## 📝 Notas Importantes

1. **Wallet Ficticia**: Por defecto se usa `TExampleAddress123456789ABC`. El administrador debe configurar su wallet real desde el backoffice.

2. **API TronGrid**: Se usa el endpoint público de TronGrid. Para producción, considera obtener una API key para mayor confiabilidad.

3. **Validación de Monto**: La implementación actual no valida el monto exacto de la transacción. Esto puede agregarse en el futuro comparando el `amount` de la transacción con el `total` del pedido.

4. **Confirmaciones**: La implementación asume que la transacción está confirmada si aparece en la blockchain. Para mayor seguridad, se podría esperar N confirmaciones.

## 🚀 Mejoras Futuras

1. Validar monto exacto de la transacción
2. Esperar confirmaciones de la blockchain
3. Agregar logs detallados de verificaciones
4. Permitir configurar múltiples wallets
5. Implementar webhook de TronGrid para notificaciones en tiempo real
6. Agregar reporte de transacciones verificadas en el dashboard

## 📚 Dependencias

- `tronpy==0.6.1` - Librería para interactuar con la blockchain TRON
- TronGrid API (endpoint público)

## 🎯 Estado Actual

✅ **COMPLETADO**
- Configuración de wallet desde backoffice
- Endpoints API para gestión de wallet
- Integración con TronPy
- Flujo completo en el bot
- Validaciones de formato
- Verificación en blockchain
- Creación automática de orden con estado "pagado"
- UI en backoffice

⏳ **PENDIENTE DE TESTING REAL**
- Prueba con transacción USDT real en TRC20
- Verificación de edge cases en producción
