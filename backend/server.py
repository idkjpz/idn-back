from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import asyncio
import jwt
import bcrypt
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters, ContextTypes
from tronpy import Tron
from tronpy.providers import HTTPProvider

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Telegram Bot Configuration
BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
telegram_app = None
active_carts = {}  # {chat_id: {"tipo_lista": str, "items": [{"product_id": str, "quantity": int}]}}
active_chats = {}  # {chat_id: {"conversation_id": str, "active": bool}}

# JWT / Auth Configuration
ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD_HASH = os.environ.get('ADMIN_PASSWORD_HASH', '')
JWT_SECRET = os.environ.get('JWT_SECRET', 'changeme')
JWT_EXPIRE_HOURS = int(os.environ.get('JWT_EXPIRE_HOURS', 24))
security = HTTPBearer()

# Tron Configuration
TRON_WALLET = "TExampleAddress123456789ABC"  # Wallet ficticia por defecto
tron_client = Tron(provider=HTTPProvider(endpoint_uri="https://api.trongrid.io"))

# Models
class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nombre: str
    descripcion: str
    imagen_url: str
    precio_minorista: float
    precio_mayorista: float
    stock: int
    punto_pedido: Optional[int] = 0
    punto_critico: Optional[int] = 0
    categoria: str = "General"
    activo: bool = True
    fecha_creacion: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    nombre: str
    descripcion: str
    imagen_url: str
    precio_minorista: float
    precio_mayorista: float
    stock: int
    punto_pedido: Optional[int] = 0
    punto_critico: Optional[int] = 0
    categoria: str = "General"
    activo: bool = True

class ProductUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    precio_minorista: Optional[float] = None
    precio_mayorista: Optional[float] = None
    stock: Optional[int] = None
    punto_pedido: Optional[int] = None
    punto_critico: Optional[int] = None
    categoria: Optional[str] = None
    activo: Optional[bool] = None

class OrderItem(BaseModel):
    product_id: str
    nombre_producto: str
    cantidad: int
    precio_unitario: float
    subtotal: float

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    chat_id: int
    cliente_nombre: Optional[str] = None
    cliente_telefono: Optional[str] = None
    cliente_direccion: Optional[str] = None
    telegram_username: Optional[str] = None
    telegram_nombre_completo: Optional[str] = None
    productos: List[OrderItem]
    total: float
    tipo_lista: str  # "minorista" o "mayorista"
    metodo_pago: str  # "transferencia_pesos", "usdt"
    estado: str = "pendiente"  # pendiente (sin comprobante), a_confirmar (con comprobante), confirmado, en_preparacion, entregado, cancelado, spam
    comprobante_file_id: Optional[str] = None  # File ID de Telegram del comprobante
    fecha_creacion: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    fecha_actualizacion: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrderCreate(BaseModel):
    chat_id: int
    cliente_nombre: Optional[str] = None
    cliente_telefono: Optional[str] = None
    cliente_direccion: Optional[str] = None
    productos: List[OrderItem]
    total: float
    tipo_lista: str
    metodo_pago: str

class OrderUpdateStatus(BaseModel):
    estado: str

class BotMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    key: str  # clave única del mensaje (ej: "bienvenida", "datos_transferencia", etc)
    titulo: str  # título descriptivo para el backoffice
    mensaje: str  # contenido del mensaje
    activo: bool = True
    fecha_actualizacion: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BotMessageCreate(BaseModel):
    key: str
    titulo: str
    mensaje: str
    activo: bool = True

class BotMessageUpdate(BaseModel):
    titulo: Optional[str] = None
    mensaje: Optional[str] = None
    activo: Optional[bool] = None

class PaymentVerificationRequest(BaseModel):
    transaction_hash: str
    order_id: str
    expected_amount: float

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str
    chat_id: int
    message: str
    sender: str  # "client" o "admin"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    read: bool = False

class Conversation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    chat_id: int
    client_name: Optional[str] = None
    client_username: Optional[str] = None
    status: str = "active"  # active, closed
    last_message: Optional[str] = None
    last_message_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    unread_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Telegram Bot Handlers
async def is_bot_enabled() -> bool:
    """Verifica si el bot está activo"""
    config = await db.bot_config.find_one({"key": "bot_enabled"}, {"_id": 0})
    if config:
        return config.get("value", True)
    return True

async def get_bot_message(key: str, default: str) -> str:
    """Obtiene un mensaje del bot desde la base de datos o retorna el default"""
    message = await db.bot_messages.find_one({"key": key, "activo": True}, {"_id": 0})
    if message:
        return message["mensaje"]
    return default

async def get_tron_wallet() -> str:
    """Obtiene la wallet TRON configurada desde la base de datos"""
    config = await db.bot_config.find_one({"key": "tron_wallet"}, {"_id": 0})
    if config:
        return config.get("value", TRON_WALLET)
    return TRON_WALLET

async def get_whatsapp_support() -> str:
    """Obtiene el número de WhatsApp de soporte"""
    config = await db.bot_config.find_one({"key": "whatsapp_number"}, {"_id": 0})
    if config:
        return config.get("value", "")
    return ""

async def get_telegram_support() -> str:
    """Obtiene el usuario de Telegram de soporte"""
    config = await db.bot_config.find_one({"key": "telegram_support_user"}, {"_id": 0})
    if config:
        return config.get("value", "")
    return ""

async def log_bot_interaction(chat_id: int, username: str = None, interaction_type: str = "message"):
    """Registra cada interacción del bot con usuarios"""
    try:
        interaction = {
            "id": str(uuid.uuid4()),
            "chat_id": chat_id,
            "username": username,
            "interaction_type": interaction_type,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.bot_interactions.insert_one(interaction)
    except Exception as e:
        logging.error(f"Error logging interaction: {e}")

async def handle_receipt(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler para recibir comprobantes de pago (fotos o documentos)"""
    if not await is_bot_enabled():
        await update.message.reply_text(
            "🔴 Lo sentimos, el bot está temporalmente desactivado."
        )
        return
    
    chat_id = update.message.chat_id
    
    # Verificar si hay un pedido pendiente esperando comprobante
    if chat_id not in active_carts or "pending_orders" not in active_carts[chat_id] or not active_carts[chat_id]["pending_orders"]:
        await update.message.reply_text(
            "⚠️ No tienes un pedido pendiente. Primero agrega productos al carrito y completa tu pedido."
        )
        return
    
    pending = active_carts[chat_id]["pending_orders"][0]
    
    if not pending.get("waiting_for_receipt"):
        await update.message.reply_text(
            "⚠️ Ya has enviado el comprobante. Ahora necesito tus datos de contacto."
        )
        return
    
    # Obtener file_id del comprobante
    file_id = None
    if update.message.photo:
        # Es una foto, tomar la de mejor calidad
        file_id = update.message.photo[-1].file_id
        logging.info(f"Comprobante recibido como foto. File ID: {file_id}")
    elif update.message.document:
        # Es un documento
        file_id = update.message.document.file_id
        logging.info(f"Comprobante recibido como documento. File ID: {file_id}")
    
    if file_id:
        # Actualizar la orden existente con el comprobante y cambiar estado a "a_confirmar"
        order_id = pending.get("order_id")
        
        if order_id:
            logging.info(f"Actualizando orden {order_id} con comprobante file_id: {file_id}")
            await db.orders.update_one(
                {"id": order_id},
                {
                    "$set": {
                        "comprobante_file_id": file_id,
                        "estado": "a_confirmar",
                        "fecha_actualizacion": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
        
        # Guardar file_id en pending order también
        pending["comprobante_file_id"] = file_id
        pending["waiting_for_receipt"] = False
        
        # Obtener los datos de la orden para mostrar el ID y total
        order = await db.orders.find_one({"id": order_id}, {"_id": 0})
        if order:
            fecha_hora = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M")
            await update.message.reply_text(
                f"✅ **¡Comprobante recibido! Pedido registrado.**\n\n"
                f"📋 ID del Pedido: {order['id']}\n"
                f"💰 Total: ${order['total']:.2f}\n"
                f"📅 Fecha: {fecha_hora}\n"
                f"📊 Estado: A Confirmar\n\n"
                f"Tu pedido ha sido registrado en nuestro sistema y está pendiente de confirmación.",
                parse_mode="Markdown"
            )
        else:
            await update.message.reply_text(
                "✅ ¡Comprobante recibido!\n\n"
                "Tu pedido ha sido actualizado a estado 'A Confirmar'."
            )
        
        # Solicitar información de contacto
        contact_msg = await get_bot_message(
            "solicitar_contacto",
            "📝 Para completar tu pedido, necesito los siguientes datos:\n\n"
            "Por favor envía tu información en este formato:\n"
            "Nombre: [Tu nombre completo]\n"
            "Teléfono: [Tu número de teléfono]\n"
            "Dirección: [Tu dirección de entrega]"
        )
        await update.message.reply_text(contact_msg)

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Verificar si el bot está activo
    if not await is_bot_enabled():
        await update.message.reply_text(
            "🔴 Lo sentimos, el bot está temporalmente desactivado.\n"
            "Por favor, intenta más tarde o contacta al administrador."
        )
        return
    
    chat_id = update.message.chat_id
    telegram_user = update.message.from_user
    username = f"@{telegram_user.username}" if telegram_user.username else None
    
    # Registrar interacción
    await log_bot_interaction(chat_id, username, "start_command")
    
    # Limpiar carrito al reiniciar
    if chat_id in active_carts:
        active_carts[chat_id] = {"tipo_lista": "", "items": []}
    
    welcome_msg = await get_bot_message(
        "bienvenida",
        "¡Bienvenido a IDN! 🏋️\n\n"
        "Selecciona el tipo de lista que deseas ver:"
    )
    
    keyboard = [
        [InlineKeyboardButton("💪 Ver Lista Minorista", callback_data="lista_minorista")],
        [InlineKeyboardButton("📦 Quiero Comprar por Mayor", callback_data="comprar_por_mayor")],
        [InlineKeyboardButton("🛒 Ver Carrito", callback_data="ver_carrito")],
        [InlineKeyboardButton("💬 Necesito Asesoramiento", callback_data="asesoramiento")],
        [InlineKeyboardButton("🔄 Reiniciar Bot", callback_data="reiniciar")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(welcome_msg, reply_markup=reply_markup)

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Verificar si el bot está activo
    if not await is_bot_enabled():
        await update.message.reply_text(
            "🔴 Lo sentimos, el bot está temporalmente desactivado.\n"
            "Por favor, intenta más tarde o contacta al administrador."
        )
        return
    
    chat_id = update.message.chat_id
    text = update.message.text
    telegram_user = update.message.from_user
    username = f"@{telegram_user.username}" if telegram_user.username else None
    
    # Registrar interacción
    await log_bot_interaction(chat_id, username, "text_message")
    
    # Si está en modo chat en vivo, guardar el mensaje
    if chat_id in active_chats and active_chats[chat_id]["active"]:
        conversation_id = active_chats[chat_id]["conversation_id"]
        
        # Guardar mensaje en BD
        message = ChatMessage(
            conversation_id=conversation_id,
            chat_id=chat_id,
            message=text,
            sender="client"
        )
        msg_dict = message.model_dump()
        msg_dict['timestamp'] = msg_dict['timestamp'].isoformat()
        await db.chat_messages.insert_one(msg_dict)
        
        # Actualizar conversación
        await db.conversations.update_one(
            {"id": conversation_id},
            {
                "$set": {
                    "last_message": text,
                    "last_message_time": datetime.now(timezone.utc).isoformat()
                },
                "$inc": {"unread_count": 1}
            }
        )
        
        # Confirmar recepción al cliente
        await update.message.reply_text("✅ Mensaje recibido. Un asesor te responderá pronto.")
        return
    
    # Verificar si hay un pedido pendiente esperando comprobante o datos
    if chat_id in active_carts and "pending_orders" in active_carts[chat_id] and active_carts[chat_id]["pending_orders"]:
        pending = active_carts[chat_id]["pending_orders"][0]
        
        # Si está esperando comprobante pero recibió texto, pedirle que envíe la imagen
        if pending.get("waiting_for_receipt") and text:
            await update.message.reply_text(
                "⚠️ Por favor, envía el comprobante como imagen o documento PDF, no como texto."
            )
            return
        
        # Si ya tiene comprobante, procesar datos de contacto
        if not pending.get("waiting_for_receipt"):
            # Pop del pending ya que vamos a procesar
            active_carts[chat_id]["pending_orders"].pop(0)
            
            # Obtener información del usuario de Telegram
            telegram_nombre = f"{telegram_user.first_name or ''} {telegram_user.last_name or ''}".strip()
            telegram_username = f"@{telegram_user.username}" if telegram_user.username else ""
            telegram_phone = telegram_user.phone_number if hasattr(telegram_user, 'phone_number') and telegram_user.phone_number else None
            
            # Parsear información del cliente
            lines = text.split('\n')
            cliente_info = {
                "nombre": "",
                "telefono": "",
                "direccion": ""
            }
            
            for line in lines:
                if ':' in line:
                    key, value = line.split(':', 1)
                    key = key.strip().lower()
                    value = value.strip()
                    
                    if 'nombre' in key:
                        cliente_info["nombre"] = value
                    elif 'tel' in key or 'teléfono' in key:
                        cliente_info["telefono"] = value
                    elif 'direc' in key or 'direcc' in key:
                        cliente_info["direccion"] = value
            
            if not cliente_info["nombre"]:
                if telegram_nombre:
                    cliente_info["nombre"] = telegram_nombre
                else:
                    cliente_info["nombre"] = text.split('\n')[0] if '\n' in text else text
            
            if not cliente_info["telefono"]:
                if telegram_phone:
                    cliente_info["telefono"] = telegram_phone
                elif telegram_username:
                    cliente_info["telefono"] = telegram_username
                else:
                    cliente_info["telefono"] = f"Chat ID: {chat_id}"
            
            if not cliente_info["direccion"]:
                cliente_info["direccion"] = "Pendiente de confirmación"
            
            # Actualizar la orden existente con los datos de contacto
            order_id = pending.get("order_id")
            
            if order_id:
                # Actualizar orden existente
                await db.orders.update_one(
                    {"id": order_id},
                    {
                        "$set": {
                            "cliente_nombre": cliente_info["nombre"],
                            "cliente_telefono": cliente_info["telefono"],
                            "cliente_direccion": cliente_info["direccion"],
                            "fecha_actualizacion": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
                
                # Obtener la orden actualizada para mostrar
                updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
                
                fecha_hora = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M")
                
                await update.message.reply_text(
                    f"✅ **¡Perfecto! Tus datos han sido registrados.**\n\n"
                    f"📋 ID del Pedido: {order_id}\n"
                    f"👤 Nombre: {cliente_info['nombre']}\n"
                    f"📞 Contacto: {cliente_info['telefono']}\n"
                    f"📍 Dirección: {cliente_info['direccion']}\n"
                    f"💰 Total: ${updated_order['total']:.2f}\n\n"
                    f"Tu pedido está completo y nuestro equipo lo revisará pronto.\n"
                    f"Te contactaremos para confirmar el envío.\n\n"
                    f"¡Gracias por tu compra! 💪",
                    parse_mode="Markdown"
                )
            return
    
    # Verificar si hay un pedido pendiente esperando datos
    if chat_id in active_carts and "pending_orders" in active_carts[chat_id] and active_carts[chat_id]["pending_orders"]:
        pending = active_carts[chat_id]["pending_orders"].pop(0)
        
        # Obtener información del usuario de Telegram
        telegram_user = update.message.from_user
        
        # Información automática de Telegram
        telegram_nombre = f"{telegram_user.first_name or ''} {telegram_user.last_name or ''}".strip()
        telegram_username = f"@{telegram_user.username}" if telegram_user.username else ""
        telegram_phone = telegram_user.phone_number if hasattr(telegram_user, 'phone_number') and telegram_user.phone_number else None
        
        # Logging
        logging.warning(f"⚠️ CÓDIGO VIEJO ejecutándose - crear orden desde handle_message")
        logging.info(f"Chat ID: {chat_id}, Username: {telegram_username}, Nombre: {telegram_nombre}")
        
        # Intentar parsear la información adicional del cliente
        lines = text.split('\n')
        cliente_info = {
            "nombre": "",
            "telefono": "",
            "direccion": ""
        }
        
        for line in lines:
            if ':' in line:
                key, value = line.split(':', 1)
                key = key.strip().lower()
                value = value.strip()
                
                if 'nombre' in key:
                    cliente_info["nombre"] = value
                elif 'tel' in key or 'teléfono' in key:
                    cliente_info["telefono"] = value
                elif 'direc' in key or 'direcc' in key:
                    cliente_info["direccion"] = value
        
        # Si no se proporcionó nombre, usar info de Telegram o el texto completo
        if not cliente_info["nombre"]:
            if telegram_nombre:
                cliente_info["nombre"] = telegram_nombre
            else:
                cliente_info["nombre"] = text.split('\n')[0] if '\n' in text else text
        
        # Si no se proporcionó teléfono, usar el de Telegram o username
        if not cliente_info["telefono"]:
            if telegram_phone:
                cliente_info["telefono"] = telegram_phone
            elif telegram_username:
                cliente_info["telefono"] = telegram_username
            else:
                cliente_info["telefono"] = f"Chat ID: {chat_id}"
        
        # Si no hay dirección, marcar como pendiente
        if not cliente_info["direccion"]:
            cliente_info["direccion"] = "Pendiente de confirmación"
        
        # Calcular total y preparar items
        order_items = []
        total = 0
        
        for item in pending["items"]:
            product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
            if product:
                precio = product[f"precio_{pending['tipo_lista']}"]
                subtotal = precio * item["quantity"]
                total += subtotal
                
                order_items.append({
                    "product_id": product["id"],
                    "nombre_producto": product["nombre"],
                    "cantidad": item["quantity"],
                    "precio_unitario": precio,
                    "subtotal": subtotal
                })
        
        # Crear orden con información completa incluyendo username de Telegram
        order = Order(
            chat_id=chat_id,
            cliente_nombre=cliente_info["nombre"],
            cliente_telefono=cliente_info["telefono"],
            cliente_direccion=cliente_info["direccion"],
            productos=order_items,
            total=total,
            tipo_lista=pending["tipo_lista"],
            metodo_pago=pending["metodo_pago"]
        )
        
        # Agregar username de Telegram al documento si existe
        order_dict = order.model_dump()
        if telegram_username:
            order_dict['telegram_username'] = telegram_username
        order_dict['telegram_nombre_completo'] = telegram_nombre if telegram_nombre else "No disponible"
        order_dict['fecha_creacion'] = order_dict['fecha_creacion'].isoformat()
        order_dict['fecha_actualizacion'] = order_dict['fecha_actualizacion'].isoformat()
        
        await db.orders.insert_one(order_dict)
        
        # Formatear fecha y hora en formato de 24hs
        fecha_hora = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M")
        
        await update.message.reply_text(
            f"✅ ¡Pedido confirmado!\n\n"
            f"📋 ID: {order.id}\n"
            f"👤 Nombre: {order.cliente_nombre}\n"
            f"📞 Contacto: {order.cliente_telefono}\n"
            f"📍 Dirección: {order.cliente_direccion}\n"
            f"💰 Total: ${total:.2f}\n"
            f"💳 Método de pago: {pending['metodo_pago']}\n"
            f"📅 Fecha y hora: {fecha_hora}\n\n"
            f"Nos pondremos en contacto contigo pronto. ¡Gracias por tu compra!"
        )

async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    # Verificar si el bot está activo
    if not await is_bot_enabled():
        await query.message.reply_text(
            "🔴 Lo sentimos, el bot está temporalmente desactivado.\n"
            "Por favor, intenta más tarde o contacta al administrador."
        )
        return
    
    chat_id = query.message.chat_id
    data = query.data
    telegram_user = query.from_user
    username = f"@{telegram_user.username}" if telegram_user.username else None
    
    # Registrar interacción
    await log_bot_interaction(chat_id, username, f"button_{data}")
    
    # Reiniciar bot
    if data == "reiniciar":
        if chat_id in active_carts:
            active_carts[chat_id] = {"tipo_lista": "", "items": []}
        
        welcome_msg = await get_bot_message(
            "bienvenida",
            "¡Bienvenido a IDN! 🏋️\n\n"
            "Selecciona el tipo de lista que deseas ver:"
        )
        
        keyboard = [
            [InlineKeyboardButton("💪 Ver Lista Minorista", callback_data="lista_minorista")],
            [InlineKeyboardButton("📦 Quiero Comprar por Mayor", callback_data="comprar_por_mayor")],
            [InlineKeyboardButton("🛒 Ver Carrito", callback_data="ver_carrito")],
            [InlineKeyboardButton("💬 Necesito Asesoramiento", callback_data="asesoramiento")],
            [InlineKeyboardButton("🔄 Reiniciar Bot", callback_data="reiniciar")],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.message.reply_text("🔄 Bot reiniciado\n\n" + welcome_msg, reply_markup=reply_markup)
        return
    
    # Manejar asesoramiento
    if data == "asesoramiento":
        whatsapp_num = await get_whatsapp_support()
        telegram_user = await get_telegram_support()
        
        keyboard = []
        
        # Siempre agregar opción de chat en vivo primero
        keyboard.append([InlineKeyboardButton("💬 Chat en Vivo con Asesor", callback_data="start_live_chat")])
        
        if whatsapp_num:
            keyboard.append([InlineKeyboardButton("💚 Contactar por WhatsApp", url=f"https://wa.me/{whatsapp_num}")])
        
        if telegram_user:
            keyboard.append([InlineKeyboardButton("💙 Contactar por Telegram", url=f"https://t.me/{telegram_user}")])
        
        keyboard.append([InlineKeyboardButton("⬅️ Volver al Menú", callback_data="reiniciar")])
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.message.reply_text(
            "💬 **¿Necesitas Asesoramiento?**\n\n"
            "Elige cómo prefieres contactarnos y un asesor te atenderá:",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )
        return
    
    # Iniciar chat en vivo
    if data == "start_live_chat":
        telegram_user = query.from_user
        chat_id = query.message.chat_id
        
        # Crear o recuperar conversación
        existing_conv = await db.conversations.find_one(
            {"chat_id": chat_id, "status": "active"},
            {"_id": 0}
        )
        
        if existing_conv:
            conversation_id = existing_conv["id"]
        else:
            conversation = Conversation(
                chat_id=chat_id,
                client_name=f"{telegram_user.first_name or ''} {telegram_user.last_name or ''}".strip(),
                client_username=f"@{telegram_user.username}" if telegram_user.username else None
            )
            conv_dict = conversation.model_dump()
            conv_dict['created_at'] = conv_dict['created_at'].isoformat()
            conv_dict['last_message_time'] = conv_dict['last_message_time'].isoformat()
            await db.conversations.insert_one(conv_dict)
            conversation_id = conversation.id
        
        # Activar modo chat
        active_chats[chat_id] = {
            "conversation_id": conversation_id,
            "active": True
        }
        
        keyboard = [[InlineKeyboardButton("❌ Finalizar Chat", callback_data="end_live_chat")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.message.reply_text(
            "✅ **Chat en Vivo Activado**\n\n"
            "Ahora estás conectado con nuestro equipo de soporte.\n"
            "Escribe tu consulta y un asesor te responderá en breve.\n\n"
            "Para finalizar el chat, presiona el botón de abajo.",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )
        return
    
    # Finalizar chat en vivo
    if data == "end_live_chat":
        chat_id = query.message.chat_id
        
        if chat_id in active_chats:
            conversation_id = active_chats[chat_id]["conversation_id"]
            active_chats[chat_id]["active"] = False
            
            # Actualizar estado de conversación
            await db.conversations.update_one(
                {"id": conversation_id},
                {"$set": {"status": "closed"}}
            )
        
        keyboard = [[InlineKeyboardButton("⬅️ Volver al Menú", callback_data="reiniciar")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.message.reply_text(
            "✅ **Chat Finalizado**\n\n"
            "Gracias por contactarnos. ¿Hay algo más en lo que podamos ayudarte?",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )
        return
    
    # Comprar por mayor - mostrar opciones de contacto
    if data == "comprar_por_mayor":
        # Obtener configuración de contacto
        whatsapp_config = await db.bot_config.find_one({"key": "whatsapp_number"}, {"_id": 0})
        telegram_config = await db.bot_config.find_one({"key": "telegram_support_user"}, {"_id": 0})
        
        whatsapp_number = whatsapp_config.get("value", "") if whatsapp_config else ""
        telegram_user = telegram_config.get("value", "") if telegram_config else ""
        
        keyboard = []
        
        # Botón de WhatsApp
        if whatsapp_number:
            # Limpiar el número y crear URL de WhatsApp
            whatsapp_clean = whatsapp_number.replace("+", "").replace(" ", "").replace("-", "")
            whatsapp_url = f"https://wa.me/{whatsapp_clean}"
            keyboard.append([InlineKeyboardButton("💬 Contactar por WhatsApp", url=whatsapp_url)])
        
        # Botón de Telegram
        if telegram_user:
            telegram_url = f"https://t.me/{telegram_user.lstrip('@')}"
            keyboard.append([InlineKeyboardButton("💙 Contactar por Telegram", url=telegram_url)])
        
        # Botón volver
        keyboard.append([InlineKeyboardButton("⬅️ Volver al Menú", callback_data="reiniciar")])
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.message.reply_text(
            "📦 **Compras por Mayor**\n\n"
            "Para compras mayoristas, por favor contáctanos directamente:\n\n"
            "Nuestro equipo te atenderá personalmente y te brindará precios especiales para compras por mayor.\n\n"
            "Selecciona tu método de contacto preferido:",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )
        return
    
    if data.startswith("lista_"):
        tipo_lista = data.replace("lista_", "")
        
        # Si es mayorista, redirigir a comprar_por_mayor
        if tipo_lista == "mayorista":
            # Obtener configuración de contacto
            whatsapp_config = await db.bot_config.find_one({"key": "whatsapp_number"}, {"_id": 0})
            telegram_config = await db.bot_config.find_one({"key": "telegram_support_user"}, {"_id": 0})
            
            whatsapp_number = whatsapp_config.get("value", "") if whatsapp_config else ""
            telegram_user = telegram_config.get("value", "") if telegram_config else ""
            
            keyboard = []
            
            # Botón de WhatsApp
            if whatsapp_number:
                whatsapp_clean = whatsapp_number.replace("+", "").replace(" ", "").replace("-", "")
                whatsapp_url = f"https://wa.me/{whatsapp_clean}"
                keyboard.append([InlineKeyboardButton("💬 Contactar por WhatsApp", url=whatsapp_url)])
            
            # Botón de Telegram
            if telegram_user:
                telegram_url = f"https://t.me/{telegram_user.lstrip('@')}"
                keyboard.append([InlineKeyboardButton("💙 Contactar por Telegram", url=telegram_url)])
            
            # Botón volver
            keyboard.append([InlineKeyboardButton("⬅️ Volver al Menú", callback_data="reiniciar")])
            
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await query.message.reply_text(
                "📦 **Compras por Mayor**\n\n"
                "Para compras mayoristas, por favor contáctanos directamente:\n\n"
                "Nuestro equipo te atenderá personalmente y te brindará precios especiales para compras por mayor.\n\n"
                "Selecciona tu método de contacto preferido:",
                reply_markup=reply_markup,
                parse_mode="Markdown"
            )
            return
        
        # Para minorista, continuar con el flujo normal
        if chat_id not in active_carts:
            active_carts[chat_id] = {"tipo_lista": tipo_lista, "items": []}
        else:
            active_carts[chat_id]["tipo_lista"] = tipo_lista
        
        # Mostrar selector de categoría
        keyboard = [
            [InlineKeyboardButton("💊 Orales", callback_data=f"cat_{tipo_lista}_orales")],
            [InlineKeyboardButton("💉 Inyectables", callback_data=f"cat_{tipo_lista}_inyectables")],
            [InlineKeyboardButton("🔄 Reiniciar", callback_data="reiniciar")],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.message.reply_text(
            f"📋 Lista **{tipo_lista.upper()}** seleccionada\n\n"
            f"Ahora elige la categoría de productos que deseas ver:",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )
    
    elif data.startswith("cat_"):
        # Formato: cat_{tipo_lista}_{categoria}
        parts = data.replace("cat_", "").split("_")
        tipo_lista = parts[0]
        categoria = parts[1]
        
        # Si es mayorista, redirigir a contacto
        if tipo_lista == "mayorista":
            whatsapp_config = await db.bot_config.find_one({"key": "whatsapp_number"}, {"_id": 0})
            telegram_config = await db.bot_config.find_one({"key": "telegram_support_user"}, {"_id": 0})
            
            whatsapp_number = whatsapp_config.get("value", "") if whatsapp_config else ""
            telegram_user = telegram_config.get("value", "") if telegram_config else ""
            
            keyboard = []
            if whatsapp_number:
                whatsapp_clean = whatsapp_number.replace("+", "").replace(" ", "").replace("-", "")
                keyboard.append([InlineKeyboardButton("💬 Contactar por WhatsApp", url=f"https://wa.me/{whatsapp_clean}")])
            if telegram_user:
                keyboard.append([InlineKeyboardButton("💙 Contactar por Telegram", url=f"https://t.me/{telegram_user.lstrip('@')}")])
            keyboard.append([InlineKeyboardButton("⬅️ Volver al Menú", callback_data="reiniciar")])
            
            await query.message.reply_text(
                "📦 **Compras por Mayor**\n\n"
                "Para compras mayoristas, por favor contáctanos directamente:",
                reply_markup=InlineKeyboardMarkup(keyboard),
                parse_mode="Markdown"
            )
            return
        
        if chat_id not in active_carts:
            active_carts[chat_id] = {"tipo_lista": tipo_lista, "items": []}
        else:
            active_carts[chat_id]["tipo_lista"] = tipo_lista
        
        # Guardar categoría actual en el carrito
        active_carts[chat_id]["last_categoria"] = categoria
        
        # Obtener productos activos de la categoría seleccionada
        products = await db.products.find({
            "activo": True, 
            "stock": {"$gt": 0},
            "categoria": categoria.capitalize()
        }, {"_id": 0}).to_list(100)
        
        if not products:
            keyboard = [
                [InlineKeyboardButton("⬅️ Volver a Categorías", callback_data=f"lista_{tipo_lista}")],
                [InlineKeyboardButton("🔄 Reiniciar Bot", callback_data="reiniciar")]
            ]
            await query.message.reply_text(
                f"No hay productos disponibles en la categoría {categoria.capitalize()} en este momento.",
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
            return
        
        # Mostrar lista de productos como botones
        categoria_emoji = "💊" if categoria == "orales" else "💉"
        keyboard = []
        
        for product in products:
            keyboard.append([InlineKeyboardButton(
                f"{categoria_emoji} {product['nombre']}", 
                callback_data=f"prod_{product['id']}"
            )])
        
        keyboard.append([InlineKeyboardButton("🛒 Ver Carrito", callback_data="ver_carrito")])
        keyboard.append([
            InlineKeyboardButton("⬅️ Volver", callback_data=f"lista_{tipo_lista}"),
            InlineKeyboardButton("🔄 Reiniciar", callback_data="reiniciar")
        ])
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.message.reply_text(
            f"{categoria_emoji} **Categoría: {categoria.upper()}**\n"
            f"📋 Lista: {tipo_lista.capitalize()}\n\n"
            f"Selecciona un producto para ver más detalles:",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )
        return
    
    # Ver detalles de un producto específico
    elif data.startswith("prod_"):
        product_id = data.replace("prod_", "")
        
        # Obtener producto
        product = await db.products.find_one({"id": product_id}, {"_id": 0})
        
        if not product or chat_id not in active_carts:
            await query.message.reply_text("❌ Producto no encontrado o sesión expirada.")
            return
        
        tipo_lista = active_carts[chat_id]["tipo_lista"]
        precio = product[f"precio_{tipo_lista}"]
        categoria = active_carts[chat_id].get("last_categoria", "orales")
        
        keyboard = [
            [InlineKeyboardButton("➕ Agregar al carrito", callback_data=f"add_{product['id']}")],
            [InlineKeyboardButton("🛒 Ver Carrito", callback_data="ver_carrito")],
            [InlineKeyboardButton("⬅️ Volver a Lista", callback_data=f"cat_{tipo_lista}_{categoria}"),
             InlineKeyboardButton("🔄 Reiniciar", callback_data="reiniciar")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        # Obtener precio de USDT y calcular equivalente
        usdt_price = await get_usdt_price()
        precio_usdt_text = ""
        if usdt_price > 0:
            precio_usdt = precio / usdt_price
            precio_usdt_text = f" (≈ {precio_usdt:.2f} USDT)"
        
        categoria_emoji = "💊" if product.get('categoria', '').lower() == 'orales' else "💉"
        caption = (
            f"{categoria_emoji} **{product['nombre']}**\n"
            f"📝 {product['descripcion']}\n"
            f"💰 Precio: ${precio:.2f}{precio_usdt_text}\n"
            f"📦 Stock: {product['stock']} unidades"
        )
        
        try:
            # Intentar enviar con imagen
            await query.message.reply_photo(
                photo=product['imagen_url'],
                caption=caption,
                reply_markup=reply_markup,
                parse_mode="Markdown"
            )
        except Exception:
            # Si falla la imagen, enviar solo texto
            await query.message.reply_text(
                caption,
                reply_markup=reply_markup,
                parse_mode="Markdown"
            )
        return
    
    elif data.startswith("add_"):
        product_id = data.replace("add_", "")
        
        if chat_id not in active_carts:
            keyboard = [[InlineKeyboardButton("🔄 Reiniciar Bot", callback_data="reiniciar")]]
            await query.message.reply_text(
                "Por favor, primero selecciona un tipo de lista con /start",
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
            return
        
        # Agregar producto al carrito
        cart = active_carts[chat_id]
        existing_item = next((item for item in cart["items"] if item["product_id"] == product_id), None)
        
        if existing_item:
            existing_item["quantity"] += 1
        else:
            cart["items"].append({"product_id": product_id, "quantity": 1})
        
        # Obtener la última categoría del último producto agregado
        last_product_id = cart["items"][-1]["product_id"] if cart["items"] else None
        last_categoria = "orales"
        if last_product_id:
            last_product = await db.products.find_one({"id": last_product_id}, {"_id": 0})
            if last_product:
                last_categoria = last_product.get('categoria', 'Orales').lower()
        
        keyboard = [
            [InlineKeyboardButton("🛒 Ver Carrito", callback_data="ver_carrito")],
            [InlineKeyboardButton("➕ Seguir Comprando", callback_data=f"cat_{cart['tipo_lista']}_{last_categoria}")],
            [InlineKeyboardButton("⬅️ Cambiar Categoría", callback_data=f"lista_{cart['tipo_lista']}")],
            [InlineKeyboardButton("🔄 Reiniciar", callback_data="reiniciar")]
        ]
        
        await query.message.reply_text(
            "✅ Producto agregado al carrito\n\n¿Qué deseas hacer?",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
    
    elif data == "ver_carrito":
        await show_cart(query.message, chat_id)
    
    elif data == "confirmar_pedido":
        await process_order(query.message, chat_id)
    
    elif data == "vaciar_carrito":
        if chat_id in active_carts:
            active_carts[chat_id]["items"] = []
        keyboard = [[InlineKeyboardButton("🔄 Reiniciar Bot", callback_data="reiniciar")]]
        await query.message.reply_text("🗑️ Carrito vaciado.", reply_markup=InlineKeyboardMarkup(keyboard))
    
    elif data.startswith("pago_"):
        metodo_pago = data.replace("pago_", "")
        await finalize_order(query.message, chat_id, metodo_pago, telegram_user)

async def show_cart(message, chat_id):
    if chat_id not in active_carts or not active_carts[chat_id]["items"]:
        keyboard = [[InlineKeyboardButton("🔄 Reiniciar Bot", callback_data="reiniciar")]]
        await message.reply_text("🛒 Tu carrito está vacío.", reply_markup=InlineKeyboardMarkup(keyboard))
        return
    
    cart = active_carts[chat_id]
    tipo_lista = cart["tipo_lista"]
    
    # Obtener precio de USDT
    usdt_price = await get_usdt_price()
    
    total = 0
    cart_text = f"🛒 **Tu Carrito ({tipo_lista.capitalize()})**\n\n"
    
    for item in cart["items"]:
        product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
        if product:
            precio = product[f"precio_{tipo_lista}"]
            subtotal = precio * item["quantity"]
            total += subtotal
            cart_text += f"• {product['nombre']} x{item['quantity']} - ${subtotal:.2f}\n"
    
    # Agregar total en ARS y USDT
    cart_text += f"\n💰 **Total: ${total:.2f}**"
    if usdt_price > 0:
        total_usdt = total / usdt_price
        cart_text += f"\n🪙 **Total en USDT: {total_usdt:.2f} USDT**"
    
    keyboard = [
        [InlineKeyboardButton("✅ Confirmar Pedido", callback_data="confirmar_pedido")],
        [InlineKeyboardButton("➕ Seguir Comprando", callback_data=f"lista_{tipo_lista}")],
        [InlineKeyboardButton("🗑️ Vaciar Carrito", callback_data="vaciar_carrito"),
         InlineKeyboardButton("🔄 Reiniciar", callback_data="reiniciar")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await message.reply_text(cart_text, reply_markup=reply_markup, parse_mode="Markdown")

async def carrito_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await show_cart(update.message, update.message.chat_id)

async def process_order(message, chat_id):
    keyboard = [
        [InlineKeyboardButton("💳 Transferencia Pesos", callback_data="pago_transferencia_pesos")],
        [InlineKeyboardButton("🪙 USDT", callback_data="pago_usdt")],
        [InlineKeyboardButton("🔄 Reiniciar", callback_data="reiniciar")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await message.reply_text(
        "Selecciona tu método de pago:",
        reply_markup=reply_markup
    )

async def finalize_order(message, chat_id, metodo_pago, telegram_user):
    if chat_id not in active_carts or not active_carts[chat_id]["items"]:
        keyboard = [[InlineKeyboardButton("🔄 Reiniciar Bot", callback_data="reiniciar")]]
        await message.reply_text("Tu carrito está vacío.", reply_markup=InlineKeyboardMarkup(keyboard))
        return
    
    cart = active_carts[chat_id]
    tipo_lista = cart["tipo_lista"]
    
    # Crear la orden inmediatamente con estado "pendiente"
    telegram_nombre = f"{telegram_user.first_name or ''} {telegram_user.last_name or ''}".strip()
    telegram_username = f"@{telegram_user.username}" if telegram_user.username else ""
    
    # Logging para depuración
    logging.info(f"=== CREANDO ORDEN PARA USUARIO ===")
    logging.info(f"Chat ID: {chat_id}")
    logging.info(f"Telegram first_name: {telegram_user.first_name}")
    logging.info(f"Telegram last_name: {telegram_user.last_name}")
    logging.info(f"Telegram username: {telegram_user.username}")
    logging.info(f"Nombre completo construido: {telegram_nombre}")
    logging.info(f"Username construido: {telegram_username}")
    
    # Intentar obtener el número de teléfono de Telegram (normalmente no está disponible sin permiso)
    telegram_phone = None
    if hasattr(telegram_user, 'phone_number') and telegram_user.phone_number:
        telegram_phone = telegram_user.phone_number
    
    # Preparar datos del cliente (usar datos de Telegram inicialmente)
    cliente_nombre_inicial = telegram_nombre if telegram_nombre else "Usuario Telegram"
    # Prioridad: 1) Número de Telegram, 2) Username, 3) Chat ID
    if telegram_phone:
        cliente_telefono_inicial = telegram_phone
    elif telegram_username:
        cliente_telefono_inicial = telegram_username
    else:
        cliente_telefono_inicial = f"Chat ID: {chat_id}"
    
    # Calcular total y preparar items
    order_items = []
    total = 0
    
    for item in cart["items"]:
        product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
        if product:
            precio = product[f"precio_{tipo_lista}"]
            total += precio * item["quantity"]
            
            order_items.append({
                "product_id": product["id"],
                "nombre_producto": product["nombre"],
                "cantidad": item["quantity"],
                "precio_unitario": precio,
                "subtotal": precio * item["quantity"]
            })
    
    # Crear orden con estado "pendiente" usando datos de Telegram
    order = Order(
        chat_id=chat_id,
        cliente_nombre=cliente_nombre_inicial,
        cliente_telefono=cliente_telefono_inicial,
        cliente_direccion="Pendiente",  # Se actualizará cuando envíe datos
        productos=order_items,
        total=total,
        tipo_lista=tipo_lista,
        metodo_pago=metodo_pago,
        estado="pendiente"
    )
    
    order_dict = order.model_dump()
    if telegram_username:
        order_dict['telegram_username'] = telegram_username
    order_dict['telegram_nombre_completo'] = telegram_nombre if telegram_nombre else "No disponible"
    order_dict['fecha_creacion'] = order_dict['fecha_creacion'].isoformat()
    order_dict['fecha_actualizacion'] = order_dict['fecha_actualizacion'].isoformat()
    
    await db.orders.insert_one(order_dict)
    
    # Mostrar datos de cuenta según método de pago
    if metodo_pago == "transferencia_pesos":
        datos_cuenta = await get_bot_message(
            "datos_transferencia_pesos",
            "💳 **DATOS PARA TRANSFERENCIA EN PESOS**\n\n"
            "Banco: Banco Example\n"
            "CBU: 0000000000000000000000\n"
            "Alias: GIMNASIO.IDN\n"
            "Titular: IDN Gimnasio\n"
            "CUIT: 00-00000000-0"
        )
        await message.reply_text(datos_cuenta, parse_mode="Markdown")
    elif metodo_pago == "usdt":
        tron_wallet = await get_tron_wallet()
        await message.reply_text(
            f"🪙 **DATOS PARA PAGO EN USDT**\n\n"
            f"Red: TRC20\n"
            f"Wallet: `{tron_wallet}`\n\n"
            f"⚠️ Importante: Asegúrate de usar la red TRC20",
            parse_mode="Markdown"
        )
    
    # Solicitar comprobante de pago (para todos los métodos)
    await message.reply_text(
        "📸 **COMPROBANTE DE PAGO**\n\n"
        "Por favor, envía el comprobante de tu pago como imagen o PDF.\n"
        "Una vez que recibamos tu comprobante, te pediremos tus datos de contacto para completar el pedido."
    )
    
    # Guardar estado para esperar comprobante y datos
    if "pending_orders" not in cart:
        cart["pending_orders"] = []
    
    cart["pending_orders"].append({
        "order_id": order.id,  # Guardar ID para actualizar después
        "metodo_pago": metodo_pago,
        "tipo_lista": tipo_lista,
        "waiting_for_receipt": True  # Primero espera comprobante
    })
    
    cart["items"] = []

# Initialize Telegram Bot
async def init_telegram_bot():
    global telegram_app
    if not BOT_TOKEN:
        logging.warning("TELEGRAM_BOT_TOKEN no configurado")
        return
    
    telegram_app = Application.builder().token(BOT_TOKEN).job_queue(None).build()
    
    telegram_app.add_handler(CommandHandler("start", start_command))
    telegram_app.add_handler(CommandHandler("carrito", carrito_command))
    telegram_app.add_handler(CallbackQueryHandler(button_callback))
    telegram_app.add_handler(MessageHandler(filters.PHOTO | filters.Document.ALL, handle_receipt))
    telegram_app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    
    await telegram_app.initialize()
    await telegram_app.start()
    await telegram_app.updater.start_polling()

# API Endpoints
@api_router.get("/")
async def root():
    return {"message": "Bot de Telegram - API"}

# Auth Endpoints
class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str

def create_jwt_token(username: str) -> str:
    """Genera un JWT firmado con expiración"""
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {
        "sub": username,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_jwt_token(token: str) -> dict:
    """Verifica y decodifica un JWT. Lanza excepción si es inválido."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Dependencia reutilizable para proteger endpoints"""
    return verify_jwt_token(credentials.credentials)["sub"]

@api_router.post("/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """Login con usuario y contraseña — devuelve JWT"""
    # Verificar usuario
    if request.username != ADMIN_USERNAME:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    
    # Verificar contraseña con bcrypt
    if not ADMIN_PASSWORD_HASH:
        raise HTTPException(status_code=500, detail="Configuración de autenticación incompleta")
    
    password_valid = bcrypt.checkpw(
        request.password.encode('utf-8'),
        ADMIN_PASSWORD_HASH.encode('utf-8')
    )
    
    if not password_valid:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    
    token = create_jwt_token(request.username)
    return LoginResponse(access_token=token, username=request.username)

@api_router.get("/auth/verify")
async def verify_token(current_user: str = Depends(get_current_user)):
    """Verifica si el token JWT enviado en el header es válido"""
    return {"valid": True, "username": current_user}


@api_router.post("/products", response_model=Product)
async def create_product(product: ProductCreate):
    product_obj = Product(**product.model_dump())
    doc = product_obj.model_dump()
    doc['fecha_creacion'] = doc['fecha_creacion'].isoformat()
    
    await db.products.insert_one(doc)
    return product_obj

@api_router.get("/products", response_model=List[Product])
async def get_products():
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    
    for product in products:
        if isinstance(product.get('fecha_creacion'), str):
            product['fecha_creacion'] = datetime.fromisoformat(product['fecha_creacion'])
    
    return products

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    if isinstance(product.get('fecha_creacion'), str):
        product['fecha_creacion'] = datetime.fromisoformat(product['fecha_creacion'])
    
    return product

@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, product_update: ProductUpdate):
    existing_product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not existing_product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    update_data = {k: v for k, v in product_update.model_dump().items() if v is not None}
    
    if update_data:
        await db.products.update_one({"id": product_id}, {"$set": update_data})
    
    updated_product = await db.products.find_one({"id": product_id}, {"_id": 0})
    
    if isinstance(updated_product.get('fecha_creacion'), str):
        updated_product['fecha_creacion'] = datetime.fromisoformat(updated_product['fecha_creacion'])
    
    return updated_product

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {"message": "Producto eliminado"}

@api_router.get("/products/alerts/stock")
async def get_stock_alerts():
    """Obtiene productos con alertas de stock (crítico y punto de pedido)"""
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    
    alertas_criticas = []
    alertas_pedido = []
    
    for product in products:
        stock = product.get('stock', 0)
        punto_critico = product.get('punto_critico', 0)
        punto_pedido = product.get('punto_pedido', 0)
        
        # Alerta crítica: stock <= punto_critico
        if punto_critico > 0 and stock <= punto_critico:
            alertas_criticas.append({
                'id': product['id'],
                'nombre': product['nombre'],
                'stock': stock,
                'punto_critico': punto_critico,
                'punto_pedido': punto_pedido,
                'categoria': product.get('categoria', 'General'),
                'tipo': 'critico'
            })
        # Alerta de pedido: stock <= punto_pedido (pero no crítico)
        elif punto_pedido > 0 and stock <= punto_pedido:
            alertas_pedido.append({
                'id': product['id'],
                'nombre': product['nombre'],
                'stock': stock,
                'punto_critico': punto_critico,
                'punto_pedido': punto_pedido,
                'categoria': product.get('categoria', 'General'),
                'tipo': 'pedido'
            })
    
    return {
        'alertas_criticas': alertas_criticas,
        'alertas_pedido': alertas_pedido,
        'total_criticas': len(alertas_criticas),
        'total_pedido': len(alertas_pedido)
    }

# Orders Endpoints
@api_router.get("/orders", response_model=List[Order])
async def get_orders():
    orders = await db.orders.find({}, {"_id": 0}).sort("fecha_creacion", -1).to_list(1000)
    
    for order in orders:
        if isinstance(order.get('fecha_creacion'), str):
            order['fecha_creacion'] = datetime.fromisoformat(order['fecha_creacion'])
        if isinstance(order.get('fecha_actualizacion'), str):
            order['fecha_actualizacion'] = datetime.fromisoformat(order['fecha_actualizacion'])
    
    return orders

@api_router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    
    if isinstance(order.get('fecha_creacion'), str):
        order['fecha_creacion'] = datetime.fromisoformat(order['fecha_creacion'])
    if isinstance(order.get('fecha_actualizacion'), str):
        order['fecha_actualizacion'] = datetime.fromisoformat(order['fecha_actualizacion'])
    
    return order

@api_router.put("/orders/{order_id}/status", response_model=Order)
async def update_order_status(order_id: str, status_update: OrderUpdateStatus):
    existing_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing_order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    
    update_data = {
        "estado": status_update.estado,
        "fecha_actualizacion": datetime.now(timezone.utc).isoformat()
    }
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    
    if isinstance(updated_order.get('fecha_creacion'), str):
        updated_order['fecha_creacion'] = datetime.fromisoformat(updated_order['fecha_creacion'])
    if isinstance(updated_order.get('fecha_actualizacion'), str):
        updated_order['fecha_actualizacion'] = datetime.fromisoformat(updated_order['fecha_actualizacion'])
    
    return updated_order

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str):
    """Eliminar una orden"""
    result = await db.orders.delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return {"message": "Pedido eliminado correctamente"}

@api_router.get("/orders/{order_id}/comprobante")
async def get_order_comprobante(order_id: str):
    """Obtiene el URL del archivo de comprobante desde Telegram"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    
    if not order.get("comprobante_file_id"):
        raise HTTPException(status_code=404, detail="Este pedido no tiene comprobante adjunto")
    
    try:
        # Verificar si el bot está inicializado
        if not telegram_app or not telegram_app.bot:
            logging.error("Bot de Telegram no está inicializado")
            raise HTTPException(status_code=503, detail="Bot de Telegram no disponible")
        
        file_id = order["comprobante_file_id"]
        logging.info(f"Intentando obtener archivo de Telegram con file_id: {file_id}")
        
        # Obtener el archivo de Telegram
        file = await telegram_app.bot.get_file(file_id)
        
        logging.info(f"Archivo obtenido exitosamente. File path: {file.file_path}")
        
        # El file_path puede venir como URL completa o como path relativo
        # Verificar si ya es una URL completa
        if file.file_path.startswith('http'):
            file_url = file.file_path
            logging.info(f"File path ya es URL completa: {file_url}")
        else:
            # Construir URL: https://api.telegram.org/file/bot<token>/<file_path>
            file_url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file.file_path}"
            logging.info(f"URL construida desde path relativo: {file_url}")
        
        return {
            "file_url": file_url, 
            "file_id": file_id,
            "file_path": file.file_path
        }
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        logging.error(f"Error al obtener comprobante de Telegram: {error_msg}")
        logging.error(f"Order ID: {order_id}, File ID: {order.get('comprobante_file_id')}")
        
        # Si el error es un 404 de Telegram, dar un mensaje más claro
        if "404" in error_msg or "Not Found" in error_msg:
            raise HTTPException(
                status_code=404, 
                detail="El archivo no existe en Telegram. Puede que haya expirado o el ID sea inválido."
            )
        
        raise HTTPException(status_code=500, detail=f"Error al obtener el comprobante: {error_msg}")

# Bot Messages Endpoints
@api_router.post("/bot-messages", response_model=BotMessage)
async def create_bot_message(message: BotMessageCreate):
    message_obj = BotMessage(**message.model_dump())
    doc = message_obj.model_dump()
    doc['fecha_actualizacion'] = doc['fecha_actualizacion'].isoformat()
    
    await db.bot_messages.insert_one(doc)
    return message_obj

@api_router.get("/bot-messages", response_model=List[BotMessage])
async def get_bot_messages():
    messages = await db.bot_messages.find({}, {"_id": 0}).to_list(1000)
    
    for msg in messages:
        if isinstance(msg.get('fecha_actualizacion'), str):
            msg['fecha_actualizacion'] = datetime.fromisoformat(msg['fecha_actualizacion'])
    
    return messages

@api_router.get("/bot-messages/{message_id}", response_model=BotMessage)
async def get_bot_message_by_id(message_id: str):
    message = await db.bot_messages.find_one({"id": message_id}, {"_id": 0})
    if not message:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    if isinstance(message.get('fecha_actualizacion'), str):
        message['fecha_actualizacion'] = datetime.fromisoformat(message['fecha_actualizacion'])
    
    return message

@api_router.put("/bot-messages/{message_id}", response_model=BotMessage)
async def update_bot_message(message_id: str, message_update: BotMessageUpdate):
    existing_message = await db.bot_messages.find_one({"id": message_id}, {"_id": 0})
    if not existing_message:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    update_data = {k: v for k, v in message_update.model_dump().items() if v is not None}
    update_data['fecha_actualizacion'] = datetime.now(timezone.utc).isoformat()
    
    if update_data:
        await db.bot_messages.update_one({"id": message_id}, {"$set": update_data})
    
    updated_message = await db.bot_messages.find_one({"id": message_id}, {"_id": 0})
    
    if isinstance(updated_message.get('fecha_actualizacion'), str):
        updated_message['fecha_actualizacion'] = datetime.fromisoformat(updated_message['fecha_actualizacion'])
    
    return updated_message

# Bot Status Endpoints
@api_router.get("/bot-status")
async def get_bot_status():
    config = await db.bot_config.find_one({"key": "bot_enabled"}, {"_id": 0})
    if config:
        return {"enabled": config.get("value", True)}
    return {"enabled": True}

@api_router.put("/bot-status")
async def update_bot_status(status: dict):
    enabled = status.get("enabled", True)
    
    await db.bot_config.update_one(
        {"key": "bot_enabled"},
        {"$set": {"key": "bot_enabled", "value": enabled, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"enabled": enabled, "message": "Estado del bot actualizado"}

# Tron Wallet Endpoints
@api_router.get("/tron-wallet")
async def get_tron_wallet_config():
    wallet = await get_tron_wallet()
    return {"wallet": wallet}

@api_router.put("/tron-wallet")
async def update_tron_wallet(wallet_data: dict):
    wallet = wallet_data.get("wallet", "")
    
    if not wallet:
        raise HTTPException(status_code=400, detail="Wallet address is required")
    
    # Validación básica de formato de wallet TRON
    if not wallet.startswith("T") or len(wallet) != 34:
        raise HTTPException(status_code=400, detail="Invalid TRON wallet address format")
    
    await db.bot_config.update_one(
        {"key": "tron_wallet"},
        {"$set": {"key": "tron_wallet", "value": wallet, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"wallet": wallet, "message": "Wallet TRON actualizada"}

# WhatsApp Configuration Endpoints
@api_router.get("/whatsapp-config")
async def get_whatsapp_config():
    config = await db.bot_config.find_one({"key": "whatsapp_number"}, {"_id": 0})
    if config:
        return {"number": config.get("value", "")}
    return {"number": ""}

@api_router.put("/whatsapp-config")
async def update_whatsapp_config(data: dict):
    number = data.get("number", "")
    
    if not number:
        raise HTTPException(status_code=400, detail="WhatsApp number is required")
    
    await db.bot_config.update_one(
        {"key": "whatsapp_number"},
        {"$set": {"key": "whatsapp_number", "value": number, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"number": number, "message": "Número de WhatsApp actualizado"}

# Telegram Support User Configuration
@api_router.get("/telegram-support-config")
async def get_telegram_support_config():
    config = await db.bot_config.find_one({"key": "telegram_support_user"}, {"_id": 0})
    if config:
        return {"username": config.get("value", "")}
    return {"username": ""}

@api_router.put("/telegram-support-config")
async def update_telegram_support_config(data: dict):
    username = data.get("username", "")
    
    if not username:
        raise HTTPException(status_code=400, detail="Telegram username is required")
    
    # Eliminar @ si lo tiene al inicio
    username = username.lstrip("@")
    
    await db.bot_config.update_one(
        {"key": "telegram_support_user"},
        {"$set": {"key": "telegram_support_user", "value": username, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"username": username, "message": "Usuario de Telegram de soporte actualizado"}

# USDT Price Configuration
@api_router.get("/usdt-price-config")
async def get_usdt_price_config():
    config = await db.bot_config.find_one({"key": "usdt_price_ars"}, {"_id": 0})
    if config:
        return {"price": float(config.get("value", 0))}
    return {"price": 0}

@api_router.put("/usdt-price-config")
async def update_usdt_price_config(data: dict):
    price = data.get("price", 0)
    
    try:
        price = float(price)
        if price <= 0:
            raise ValueError("Price must be greater than 0")
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Precio inválido")
    
    await db.bot_config.update_one(
        {"key": "usdt_price_ars"},
        {"$set": {"key": "usdt_price_ars", "value": str(price), "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"price": price, "message": "Precio de USDT actualizado"}

# Helper function to get USDT price
async def get_usdt_price():
    """Obtiene el precio del USDT en ARS desde la configuración"""
    config = await db.bot_config.find_one({"key": "usdt_price_ars"}, {"_id": 0})
    if config and config.get("value"):
        try:
            return float(config.get("value"))
        except (ValueError, TypeError):
            return 0
    return 0

# Bot Interactions Endpoints
@api_router.get("/bot-interactions")
async def get_bot_interactions(start_date: str = None, end_date: str = None):
    """Obtiene las interacciones del bot con filtros por fecha"""
    query = {}
    
    if start_date:
        query["timestamp"] = {"$gte": start_date}
    
    if end_date:
        if "timestamp" in query:
            query["timestamp"]["$lte"] = end_date + "T23:59:59Z"
        else:
            query["timestamp"] = {"$lte": end_date + "T23:59:59Z"}
    
    interactions = await db.bot_interactions.find(query, {"_id": 0}).sort("timestamp", -1).to_list(10000)
    
    # Estadísticas agregadas
    total_interactions = len(interactions)
    unique_users = len(set([i["chat_id"] for i in interactions]))
    
    # Agrupar por fecha
    interactions_by_date = {}
    for interaction in interactions:
        date = interaction["timestamp"][:10]  # YYYY-MM-DD
        if date not in interactions_by_date:
            interactions_by_date[date] = {
                "date": date,
                "count": 0,
                "unique_users": set()
            }
        interactions_by_date[date]["count"] += 1
        interactions_by_date[date]["unique_users"].add(interaction["chat_id"])
    
    # Convertir sets a conteo
    by_date = []
    for date, data in sorted(interactions_by_date.items(), reverse=True):
        by_date.append({
            "date": date,
            "count": data["count"],
            "unique_users": len(data["unique_users"])
        })
    
    return {
        "total_interactions": total_interactions,
        "unique_users": unique_users,
        "by_date": by_date,
        "interactions": interactions[:100]  # Últimas 100 interacciones
    }

# Statistics Endpoints
@api_router.get("/stats")
async def get_statistics():
    # Total de órdenes
    total_orders = await db.orders.count_documents({})
    
    # Órdenes por estado
    pipeline_estado = [
        {"$group": {"_id": "$estado", "count": {"$sum": 1}}}
    ]
    orders_by_status = await db.orders.aggregate(pipeline_estado).to_list(100)
    
    # Ventas totales
    pipeline_ventas = [
        {"$group": {"_id": None, "total_ventas": {"$sum": "$total"}}}
    ]
    ventas_result = await db.orders.aggregate(pipeline_ventas).to_list(1)
    total_ventas = ventas_result[0]["total_ventas"] if ventas_result else 0
    
    # Ventas por tipo de lista
    pipeline_tipo = [
        {"$group": {"_id": "$tipo_lista", "total": {"$sum": "$total"}, "count": {"$sum": 1}}}
    ]
    ventas_por_tipo = await db.orders.aggregate(pipeline_tipo).to_list(100)
    
    # Productos más vendidos
    pipeline_productos = [
        {"$unwind": "$productos"},
        {"$group": {
            "_id": "$productos.product_id",
            "nombre": {"$first": "$productos.nombre_producto"},
            "cantidad_vendida": {"$sum": "$productos.cantidad"},
            "ingresos": {"$sum": "$productos.subtotal"}
        }},
        {"$sort": {"cantidad_vendida": -1}},
        {"$limit": 10}
    ]
    top_productos = await db.orders.aggregate(pipeline_productos).to_list(100)
    
    # Productos con bajo stock
    low_stock = await db.products.find({"stock": {"$lt": 10}}, {"_id": 0}).to_list(100)
    
    return {
        "total_orders": total_orders,
        "orders_by_status": orders_by_status,
        "total_ventas": total_ventas,
        "ventas_por_tipo": ventas_por_tipo,
        "top_productos": top_productos,
        "low_stock_products": low_stock
    }

# Chat Endpoints
@api_router.get("/conversations")
async def get_conversations():
    """Obtiene todas las conversaciones"""
    conversations = await db.conversations.find({}, {"_id": 0}).sort("last_message_time", -1).to_list(1000)
    
    for conv in conversations:
        if isinstance(conv.get('created_at'), str):
            conv['created_at'] = datetime.fromisoformat(conv['created_at'])
        if isinstance(conv.get('last_message_time'), str):
            conv['last_message_time'] = datetime.fromisoformat(conv['last_message_time'])
    
    return conversations

@api_router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(conversation_id: str):
    """Obtiene todos los mensajes de una conversación"""
    messages = await db.chat_messages.find(
        {"conversation_id": conversation_id},
        {"_id": 0}
    ).sort("timestamp", 1).to_list(1000)
    
    for msg in messages:
        if isinstance(msg.get('timestamp'), str):
            msg['timestamp'] = datetime.fromisoformat(msg['timestamp'])
    
    return messages

@api_router.post("/conversations/{conversation_id}/messages")
async def send_message_to_client(conversation_id: str, message_data: dict):
    """Envía un mensaje del admin al cliente"""
    message_text = message_data.get("message", "")
    
    if not message_text:
        raise HTTPException(status_code=400, detail="Message is required")
    
    # Obtener conversación
    conversation = await db.conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    chat_id = conversation["chat_id"]
    
    # Guardar mensaje en BD
    message = ChatMessage(
        conversation_id=conversation_id,
        chat_id=chat_id,
        message=message_text,
        sender="admin",
        read=True
    )
    msg_dict = message.model_dump()
    msg_dict['timestamp'] = msg_dict['timestamp'].isoformat()
    await db.chat_messages.insert_one(msg_dict)
    
    # Actualizar conversación
    await db.conversations.update_one(
        {"id": conversation_id},
        {
            "$set": {
                "last_message": message_text,
                "last_message_time": datetime.now(timezone.utc).isoformat(),
                "unread_count": 0
            }
        }
    )
    
    # Enviar mensaje al cliente vía Telegram
    try:
        await telegram_app.bot.send_message(
            chat_id=chat_id,
            text=f"💬 **Asesor:**\n{message_text}",
            parse_mode="Markdown"
        )
    except Exception as e:
        logging.error(f"Error sending message to Telegram: {e}")
        raise HTTPException(status_code=500, detail="Failed to send message to client")
    
    return {"success": True, "message": "Message sent"}

@api_router.put("/conversations/{conversation_id}/mark-read")
async def mark_conversation_read(conversation_id: str):
    """Marca todos los mensajes de una conversación como leídos"""
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"unread_count": 0}}
    )
    
    await db.chat_messages.update_many(
        {"conversation_id": conversation_id, "sender": "client"},
        {"$set": {"read": True}}
    )
    
    return {"success": True}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(init_telegram_bot())

@app.on_event("shutdown")
async def shutdown_db_client():
    if telegram_app:
        try:
            await telegram_app.stop()
            await telegram_app.shutdown()
        except Exception as e:
            logging.warning(f"Error al detener el bot: {e}")
    client.close()