# Bot de Telegram - TeleCommerce

## 🤖 Cómo usar el Bot

### 1. Encuentra tu bot en Telegram
Busca tu bot en Telegram usando el nombre de usuario que configuraste con @BotFather.

### 2. Comandos disponibles

#### `/start`
Inicia la interacción con el bot. Te mostrará opciones para:
- 🛍️ Ver Lista Minorista
- 📦 Ver Lista Mayorista
- 🛒 Ver Carrito

#### `/carrito`
Muestra el contenido actual de tu carrito de compras con el total a pagar.

### 3. Flujo de compra

1. **Seleccionar tipo de lista**: Al iniciar con `/start`, elige si quieres ver precios de lista minorista o mayorista.

2. **Ver productos**: El bot te mostrará los productos disponibles con:
   - Nombre del producto
   - Descripción
   - Precio (según la lista seleccionada)
   - Stock disponible
   - Botón "➕ Agregar al carrito"

3. **Agregar productos**: Presiona el botón "➕ Agregar al carrito" para añadir productos a tu carrito.

4. **Ver carrito**: Usa el comando `/carrito` o el botón "🛒 Ver Carrito" para revisar tu pedido.

5. **Confirmar pedido**: En el carrito, presiona "✅ Confirmar Pedido" para proceder al pago.

6. **Seleccionar método de pago**: Elige entre:
   - 💳 Transferencia
   - 💵 Efectivo
   - 🪙 USDT

7. **Proporcionar información de contacto**: El bot te pedirá que envíes tus datos en el siguiente formato:
   ```
   Nombre: [Tu nombre completo]
   Teléfono: [Tu número de teléfono]
   Dirección: [Tu dirección de entrega]
   ```

8. **Confirmación**: Recibirás un mensaje de confirmación con:
   - ID del pedido
   - Tus datos de contacto
   - Total a pagar
   - Método de pago seleccionado

### 4. Características

- ✅ Carritos independientes por usuario
- ✅ Precios diferenciados (minorista vs mayorista)
- ✅ Control de stock en tiempo real
- ✅ Múltiples métodos de pago
- ✅ Confirmación inmediata de pedidos

---

## 📊 Dashboard de Administración

Accede al dashboard en: https://gymbot-telegram.preview.emergentagent.com

### Secciones del Dashboard

#### 1. **Pedidos** (Principal)
- Vista en tiempo real de todos los pedidos recibidos
- **Información del cliente visible en cada pedido**:
  - 👤 Nombre completo
  - 📞 Teléfono de contacto
  - 📍 Dirección de entrega
  - 💬 Chat ID de Telegram
  - Botón "Ver detalles completos" para información expandida
- **Botón de contacto directo**: Comunicación instantánea con el cliente por Telegram
- Filtros por estado (pendiente, confirmado, en preparación, entregado, cancelado)
- Actualización de estado de pedidos
- Detalles completos de cada pedido:
  - ID del pedido
  - Tipo de lista (minorista/mayorista)
  - Productos y cantidades
  - Total
  - Método de pago
  - Fecha y hora

#### 2. **Productos**
- Gestión completa del catálogo
- Crear nuevos productos con:
  - Nombre
  - Descripción
  - Imagen (URL)
  - Precio minorista
  - Precio mayorista
  - Stock
  - Categoría
  - Estado (activo/inactivo)
- Editar productos existentes
- Eliminar productos
- Vista con imágenes y todos los detalles

#### 3. **Estadísticas**
- Total de ventas
- Total de pedidos
- Productos con bajo stock
- Gráficos de ventas por tipo de lista
- Gráficos de pedidos por estado
- Top 10 productos más vendidos
- Alertas de productos con stock bajo

### Actualización en Tiempo Real
El dashboard se actualiza automáticamente cada 5 segundos para mostrar los nuevos pedidos sin necesidad de recargar la página.

### 📱 Comunicación con Clientes

Cada pedido incluye:
- **Información de contacto completa del cliente**
- **Botón "Contactar por Telegram"**: Abre una conversación directa con el cliente
- **Modal de detalles**: Vista completa con toda la información del cliente y del pedido en un solo lugar

Desde el dashboard puedes:
1. Ver el nombre, teléfono y dirección del cliente directamente en la lista de pedidos
2. Hacer clic en "Ver detalles completos" para ver toda la información en un modal
3. Usar el botón "Contactar por Telegram" (icono 💬) para comunicarte directamente con el cliente
4. El sistema guarda el Chat ID de Telegram para facilitar la comunicación

---

## 🔧 Configuración Técnica

### Token del Bot
El token está configurado en: `/app/backend/.env`

```
TELEGRAM_BOT_TOKEN="8262481583:AAH1UFA8dHAc5p7X6nTkI2XIKdgfInYmVUg"
```

### Base de Datos
- MongoDB local
- Base de datos: `telegram_bot_db`
- Colecciones:
  - `products`: Productos del catálogo
  - `orders`: Pedidos recibidos

### Tecnologías
- **Backend**: FastAPI + Python Telegram Bot
- **Frontend**: React + Shadcn UI + Recharts
- **Database**: MongoDB
- **Actualizaciones**: Polling cada 5 segundos

---

## 📝 Notas Importantes

1. **Stock**: El sistema verifica el stock disponible antes de mostrar productos en el bot.

2. **Productos Activos**: Solo los productos marcados como "activos" aparecerán en el bot.

3. **Métodos de Pago**: Actualmente soporta transferencia, efectivo y USDT. Los pedidos se registran con el método seleccionado.

4. **Gestión de Estados**: Los estados de pedidos permiten hacer seguimiento completo desde que se recibe hasta la entrega:
   - Pendiente: Pedido recién recibido
   - Confirmado: Pedido verificado
   - En Preparación: Pedido siendo procesado
   - Entregado: Pedido completado
   - Cancelado: Pedido cancelado

5. **Notificaciones**: El dashboard muestra estadísticas en tiempo real de pedidos pendientes y entregados.

---

## 🚀 Próximos Pasos

Para empezar a usar el sistema:

1. Abre tu bot de Telegram
2. Envía el comando `/start`
3. Agrega productos desde el dashboard si no hay productos creados
4. Los clientes podrán empezar a hacer pedidos inmediatamente
5. Monitorea los pedidos desde el dashboard y actualiza sus estados

¡Tu sistema de ventas por Telegram está listo para usar! 🎉
