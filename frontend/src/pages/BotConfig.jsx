import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Edit, Plus, Loader2, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const defaultMessages = [
  {
    key: 'bienvenida',
    titulo: 'Mensaje de Bienvenida',
    descripcion: 'Primer mensaje que ve el usuario al iniciar el bot',
  },
  {
    key: 'datos_transferencia_pesos',
    titulo: 'Datos Transferencia en Pesos',
    descripcion: 'Información bancaria para transferencias en pesos argentinos',
  },
  {
    key: 'datos_usdt',
    titulo: 'Datos para USDT',
    descripcion: 'Información de wallet para pagos en USDT',
  },
  {
    key: 'solicitar_contacto',
    titulo: 'Solicitud de Datos de Contacto',
    descripcion: 'Mensaje para solicitar nombre, teléfono y dirección del cliente',
  },
];

const BotConfig = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [botEnabled, setBotEnabled] = useState(true);
  const [updatingBotStatus, setUpdatingBotStatus] = useState(false);
  const [tronWallet, setTronWallet] = useState('');
  const [editingWallet, setEditingWallet] = useState(false);
  const [tempWallet, setTempWallet] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [editingWhatsapp, setEditingWhatsapp] = useState(false);
  const [tempWhatsapp, setTempWhatsapp] = useState('');
  const [telegramSupport, setTelegramSupport] = useState('');
  const [editingTelegramSupport, setEditingTelegramSupport] = useState(false);
  const [tempTelegramSupport, setTempTelegramSupport] = useState('');
  const [usdtPrice, setUsdtPrice] = useState('');
  const [editingUsdtPrice, setEditingUsdtPrice] = useState(false);
  const [tempUsdtPrice, setTempUsdtPrice] = useState('');
  const [formData, setFormData] = useState({
    key: '',
    titulo: '',
    mensaje: '',
    activo: true
  });

  useEffect(() => {
    fetchMessages();
    fetchBotStatus();
    fetchTronWallet();
    fetchWhatsappConfig();
    fetchTelegramSupportConfig();
    fetchUsdtPriceConfig();
  }, []);

  const fetchBotStatus = async () => {
    try {
      const response = await axios.get(`${API}/bot-status`);
      setBotEnabled(response.data.enabled);
    } catch (error) {
      console.error('Error fetching bot status:', error);
    }
  };

  const fetchTronWallet = async () => {
    try {
      const response = await axios.get(`${API}/tron-wallet`);
      setTronWallet(response.data.wallet);
      setTempWallet(response.data.wallet);
    } catch (error) {
      console.error('Error fetching TRON wallet:', error);
    }
  };

  const handleSaveTronWallet = async () => {
    if (!tempWallet.startsWith('T') || tempWallet.length !== 34) {
      toast.error('Formato de wallet TRON inválido. Debe comenzar con "T" y tener 34 caracteres.');
      return;
    }

    try {
      await axios.put(`${API}/tron-wallet`, { wallet: tempWallet });
      setTronWallet(tempWallet);
      setEditingWallet(false);
      toast.success('Wallet TRON actualizada exitosamente');
    } catch (error) {
      console.error('Error updating TRON wallet:', error);
      toast.error(error.response?.data?.detail || 'Error al actualizar la wallet TRON');
    }
  };

  const fetchWhatsappConfig = async () => {
    try {
      const response = await axios.get(`${API}/whatsapp-config`);
      setWhatsappNumber(response.data.number);
      setTempWhatsapp(response.data.number);
    } catch (error) {
      console.error('Error fetching WhatsApp config:', error);
    }
  };

  const handleSaveWhatsapp = async () => {
    if (!tempWhatsapp) {
      toast.error('Por favor ingresa un número de WhatsApp');
      return;
    }

    try {
      await axios.put(`${API}/whatsapp-config`, { number: tempWhatsapp });
      setWhatsappNumber(tempWhatsapp);
      setEditingWhatsapp(false);
      toast.success('Número de WhatsApp actualizado exitosamente');
    } catch (error) {
      console.error('Error updating WhatsApp config:', error);
      toast.error(error.response?.data?.detail || 'Error al actualizar el número de WhatsApp');
    }
  };

  const fetchTelegramSupportConfig = async () => {
    try {
      const response = await axios.get(`${API}/telegram-support-config`);
      setTelegramSupport(response.data.username);
      setTempTelegramSupport(response.data.username);
    } catch (error) {
      console.error('Error fetching Telegram support config:', error);
    }
  };

  const handleSaveTelegramSupport = async () => {
    if (!tempTelegramSupport) {
      toast.error('Por favor ingresa un usuario de Telegram');
      return;
    }

    try {
      await axios.put(`${API}/telegram-support-config`, { username: tempTelegramSupport });
      setTelegramSupport(tempTelegramSupport);
      setEditingTelegramSupport(false);
      toast.success('Usuario de Telegram de soporte actualizado exitosamente');
    } catch (error) {
      console.error('Error updating Telegram support config:', error);
      toast.error(error.response?.data?.detail || 'Error al actualizar el usuario de Telegram');
    }
  };

  const fetchUsdtPriceConfig = async () => {
    try {
      const response = await axios.get(`${API}/usdt-price-config`);
      setUsdtPrice(response.data.price);
      setTempUsdtPrice(response.data.price);
    } catch (error) {
      console.error('Error fetching USDT price config:', error);
    }
  };

  const handleSaveUsdtPrice = async () => {
    const price = parseFloat(tempUsdtPrice);
    
    if (!tempUsdtPrice || price <= 0) {
      toast.error('Por favor ingresa un precio válido mayor a 0');
      return;
    }

    try {
      await axios.put(`${API}/usdt-price-config`, { price: tempUsdtPrice });
      setUsdtPrice(tempUsdtPrice);
      setEditingUsdtPrice(false);
      toast.success('Precio de USDT actualizado exitosamente');
    } catch (error) {
      console.error('Error updating USDT price config:', error);
      toast.error(error.response?.data?.detail || 'Error al actualizar el precio de USDT');
    }
  };

  const toggleBotStatus = async (enabled) => {
    setUpdatingBotStatus(true);
    try {
      await axios.put(`${API}/bot-status`, { enabled });
      setBotEnabled(enabled);
      toast.success(enabled ? 'Bot activado exitosamente' : 'Bot desactivado exitosamente');
    } catch (error) {
      console.error('Error updating bot status:', error);
      toast.error('Error al actualizar el estado del bot');
    } finally {
      setUpdatingBotStatus(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await axios.get(`${API}/bot-messages`);
      setMessages(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Error al cargar los mensajes');
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (checked) => {
    setFormData(prev => ({ ...prev, activo: checked }));
  };

  const resetForm = () => {
    setFormData({
      key: '',
      titulo: '',
      mensaje: '',
      activo: true
    });
    setEditingMessage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingMessage) {
        await axios.put(`${API}/bot-messages/${editingMessage.id}`, {
          titulo: formData.titulo,
          mensaje: formData.mensaje,
          activo: formData.activo
        });
        toast.success('Mensaje actualizado');
      } else {
        await axios.post(`${API}/bot-messages`, formData);
        toast.success('Mensaje creado');
      }
      
      fetchMessages();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving message:', error);
      toast.error('Error al guardar el mensaje');
    }
  };

  const handleEdit = (message) => {
    setEditingMessage(message);
    setFormData({
      key: message.key,
      titulo: message.titulo,
      mensaje: message.mensaje,
      activo: message.activo
    });
    setIsDialogOpen(true);
  };

  const handleCreateFromDefault = (defaultMsg) => {
    setEditingMessage(null);
    setFormData({
      key: defaultMsg.key,
      titulo: defaultMsg.titulo,
      mensaje: getDefaultMessageContent(defaultMsg.key),
      activo: true
    });
    setIsDialogOpen(true);
  };

  const getDefaultMessageContent = (key) => {
    const defaults = {
      'bienvenida': '¡Bienvenido a IDN! 🏋️\n\nSelecciona el tipo de lista que deseas ver:',
      'datos_transferencia_pesos': '💳 **DATOS PARA TRANSFERENCIA EN PESOS**\n\nBanco: Banco Example\nCBU: 0000000000000000000000\nAlias: GIMNASIO.IDN\nTitular: IDN Gimnasio\nCUIT: 00-00000000-0',
      'datos_usdt': '🪙 **DATOS PARA PAGO EN USDT**\n\nRed: TRC20\nWallet: TExampleAddress123456789',
      'solicitar_contacto': '📝 Para completar tu pedido, necesito los siguientes datos:\n\nPor favor envía tu información en este formato:\nNombre: [Tu nombre completo]\nTeléfono: [Tu número de teléfono]\nDirección: [Tu dirección de entrega]'
    };
    return defaults[key] || '';
  };

  const findMessageByKey = (key) => {
    return messages.find(msg => msg.key === key);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="page-container" data-testid="bot-config-page">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title" data-testid="page-title">Configuración del Bot</h1>
            <p className="page-description">Gestiona el estado y mensajes del bot de Telegram</p>
          </div>
        </div>
      </div>

      {/* Estado del Bot */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Estado del Bot de Telegram
            </span>
            <Badge variant={botEnabled ? 'success' : 'secondary'} className={botEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
              {botEnabled ? '🟢 Activo' : '🔴 Inactivo'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-1">
                {botEnabled ? 'El bot está respondiendo a los usuarios' : 'El bot está desactivado'}
              </h3>
              <p className="text-sm text-gray-600">
                {botEnabled 
                  ? 'Los clientes pueden interactuar con el bot y realizar pedidos normalmente.'
                  : 'El bot no responderá a ningún mensaje de los usuarios hasta que lo actives.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={botEnabled}
                onCheckedChange={toggleBotStatus}
                disabled={updatingBotStatus}
                data-testid="bot-status-switch"
              />
              <span className="text-sm font-medium">
                {botEnabled ? 'Encendido' : 'Apagado'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuración de Wallet TRON */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🪙 Wallet TRON (TRC20)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Configura tu dirección de wallet TRON para recibir pagos en USDT. Esta wallet se mostrará a los clientes cuando seleccionen pago con USDT.
            </p>
            
            {!editingWallet ? (
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                <div className="flex-1">
                  <Label className="text-xs text-gray-500 mb-1">Dirección de Wallet TRC20</Label>
                  <p className="font-mono text-sm break-all">{tronWallet}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingWallet(true)}
                  data-testid="edit-tron-wallet-btn"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="tron-wallet">Dirección de Wallet TRON (TRC20)</Label>
                  <Input
                    id="tron-wallet"
                    value={tempWallet}
                    onChange={(e) => setTempWallet(e.target.value)}
                    placeholder="TExampleAddress123456789..."
                    className="font-mono text-sm mt-1"
                    data-testid="tron-wallet-input"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    La dirección debe comenzar con "T" y tener 34 caracteres
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveTronWallet}
                    size="sm"
                    data-testid="save-tron-wallet-btn"
                  >
                    Guardar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTempWallet(tronWallet);
                      setEditingWallet(false);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuración de WhatsApp */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📱 Número de WhatsApp de asesoramiento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Configura tu número de WhatsApp para que aparezca un botón de contacto en el bot. Los clientes podrán contactarte directamente.
            </p>
            
            {!editingWhatsapp ? (
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                <div className="flex-1">
                  <Label className="text-xs text-gray-500 mb-1">Número de WhatsApp</Label>
                  <p className="font-mono text-sm">{whatsappNumber || 'No configurado'}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingWhatsapp(true)}
                  data-testid="edit-whatsapp-btn"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="whatsapp-number">Número de WhatsApp (con código de país)</Label>
                  <Input
                    id="whatsapp-number"
                    value={tempWhatsapp}
                    onChange={(e) => setTempWhatsapp(e.target.value)}
                    placeholder="5491123456789"
                    className="font-mono text-sm mt-1"
                    data-testid="whatsapp-input"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Ejemplo: 5491123456789 (código de país + número sin espacios ni símbolos)
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveWhatsapp}
                    size="sm"
                    data-testid="save-whatsapp-btn"
                  >
                    Guardar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTempWhatsapp(whatsappNumber);
                      setEditingWhatsapp(false);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuración de Usuario de Telegram de Soporte */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            💙 Usuario de Telegram de Asesoramiento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Configura el usuario de Telegram que recibirá las consultas de asesoramiento. Los clientes podrán contactar directamente desde el bot.
            </p>
            
            {!editingTelegramSupport ? (
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                <div className="flex-1">
                  <Label className="text-xs text-gray-500 mb-1">Usuario de Telegram</Label>
                  <p className="font-mono text-sm">
                    {telegramSupport ? `@${telegramSupport}` : 'No configurado'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingTelegramSupport(true)}
                  data-testid="edit-telegram-support-btn"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="telegram-support">Usuario de Telegram (sin @)</Label>
                  <Input
                    id="telegram-support"
                    value={tempTelegramSupport}
                    onChange={(e) => setTempTelegramSupport(e.target.value)}
                    placeholder="usuario_soporte"
                    className="font-mono text-sm mt-1"
                    data-testid="telegram-support-input"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Ejemplo: usuario_soporte (sin el símbolo @)
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveTelegramSupport}
                    size="sm"
                    data-testid="save-telegram-support-btn"
                  >
                    Guardar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTempTelegramSupport(telegramSupport);
                      setEditingTelegramSupport(false);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuración del Precio de USDT */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            💵 Precio del USDT en ARS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Configura el precio actual del USDT en pesos argentinos. El bot usará este valor para convertir los precios de ARS a USDT automáticamente.
            </p>
            
            {!editingUsdtPrice ? (
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                <div className="flex-1">
                  <Label className="text-xs text-gray-500 mb-1">Precio USDT/ARS</Label>
                  <p className="font-mono text-xl font-bold text-green-600">
                    ${usdtPrice || '0'} ARS
                  </p>
                  {usdtPrice > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Ejemplo: $1000 ARS = {(1000 / usdtPrice).toFixed(2)} USDT
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingUsdtPrice(true)}
                  data-testid="edit-usdt-price-btn"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="usdt-price">Precio de USDT en ARS</Label>
                  <Input
                    id="usdt-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={tempUsdtPrice}
                    onChange={(e) => setTempUsdtPrice(e.target.value)}
                    placeholder="1150.50"
                    className="font-mono text-sm mt-1"
                    data-testid="usdt-price-input"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Ingresa el precio actual del USDT (ej: 1150.50)
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveUsdtPrice}
                    size="sm"
                    data-testid="save-usdt-price-btn"
                  >
                    Guardar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTempUsdtPrice(usdtPrice);
                      setEditingUsdtPrice(false);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Los mensajes del bot se pueden personalizar para incluir datos de transferencia bancaria, información de USDT, y más.
          Usa formato Markdown para **negrita** y saltos de línea.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {defaultMessages.map((defaultMsg) => {
          const existingMessage = findMessageByKey(defaultMsg.key);
          
          return (
            <Card key={defaultMsg.key}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      {defaultMsg.titulo}
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">{defaultMsg.descripcion}</p>
                  </div>
                  {existingMessage && (
                    <Badge variant={existingMessage.activo ? 'success' : 'secondary'} className={existingMessage.activo ? 'bg-green-100 text-green-800' : ''}>
                      {existingMessage.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {existingMessage ? (
                  <>
                    <div className="bg-gray-50 rounded-lg p-3 mb-3 max-h-32 overflow-y-auto">
                      <pre className="text-sm whitespace-pre-wrap font-sans">{existingMessage.mensaje}</pre>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(existingMessage)}
                      data-testid={`edit-message-${defaultMsg.key}`}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Editar Mensaje
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleCreateFromDefault(defaultMsg)}
                    data-testid={`create-message-${defaultMsg.key}`}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Mensaje
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="dialog-title">
              {editingMessage ? 'Editar Mensaje' : 'Nuevo Mensaje'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key">Clave del Mensaje *</Label>
              <Input
                id="key"
                name="key"
                value={formData.key}
                onChange={handleInputChange}
                required
                disabled={editingMessage !== null}
                data-testid="input-key"
              />
              <p className="text-xs text-gray-500">
                Identificador único (ej: bienvenida, datos_transferencia_pesos)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                name="titulo"
                value={formData.titulo}
                onChange={handleInputChange}
                required
                data-testid="input-titulo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mensaje">Mensaje *</Label>
              <Textarea
                id="mensaje"
                name="mensaje"
                value={formData.mensaje}
                onChange={handleInputChange}
                rows={10}
                required
                data-testid="input-mensaje"
                placeholder="Usa ** para negrita. Ejemplo: **DATOS BANCARIOS**"
              />
              <p className="text-xs text-gray-500">
                Soporta formato Markdown. Usa **texto** para negrita.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="activo"
                checked={formData.activo}
                onCheckedChange={handleSwitchChange}
                data-testid="switch-activo"
              />
              <Label htmlFor="activo">Mensaje Activo</Label>
            </div>

            <DialogFooter>
              <Button type="submit" data-testid="submit-message-btn">
                {editingMessage ? 'Actualizar' : 'Crear'} Mensaje
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BotConfig;
