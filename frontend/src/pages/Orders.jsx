import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShoppingCart, Package, Clock, CheckCircle, XCircle, Loader2, User, Phone, MapPin, MessageCircle, AlertTriangle, Filter, MessageSquare, Trash2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const estadoLabels = {
  pendiente: 'Pendiente',
  a_confirmar: 'A Confirmar',
  confirmado: 'Confirmado',
  en_preparacion: 'En Preparación',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  spam: 'Spam'
};

const estadoIcons = {
  pendiente: Clock,
  a_confirmar: AlertTriangle,
  confirmado: CheckCircle,
  en_preparacion: Package,
  entregado: CheckCircle,
  cancelado: XCircle,
  spam: AlertTriangle
};

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [updatingOrder, setUpdatingOrder] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');

  useEffect(() => {
    fetchOrders();
    fetchWhatsappConfig();
    
    // Poll para actualizaciones en tiempo real
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/orders`);
      
      // Marcar automáticamente como spam pedidos viejos
      const now = new Date();
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      
      const ordersWithSpam = response.data.map(order => {
        const orderDate = new Date(order.fecha_creacion);
        
        // Si el pedido tiene más de 5 días y está en "pendiente", marcarlo como spam
        if (order.estado === 'pendiente' && orderDate < fiveDaysAgo) {
          // Auto-actualizar a spam
          updateOrderStatus(order.id, 'spam', true);
          return { ...order, estado: 'spam' };
        }
        
        return order;
      });
      
      setOrders(ordersWithSpam);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Error al cargar los pedidos');
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus, silent = false) => {
    setUpdatingOrder(orderId);
    try {
      await axios.put(`${API}/orders/${orderId}/status`, { estado: newStatus });
      if (!silent) {
        toast.success('Estado del pedido actualizado');
      }
      fetchOrders();
    } catch (error) {
      console.error('Error updating order:', error);
      if (!silent) {
        toast.error('Error al actualizar el pedido');
      }
    } finally {
      setUpdatingOrder(null);
    }
  };

  const deleteOrder = async (orderId, clienteName) => {
    if (!window.confirm(`¿Estás seguro de eliminar el pedido de ${clienteName}?`)) {
      return;
    }
    
    try {
      await axios.delete(`${API}/orders/${orderId}`);
      toast.success('Pedido eliminado correctamente');
      fetchOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Error al eliminar el pedido');
    }
  };

  let filteredOrders = filterEstado === 'all' 
    ? orders 
    : orders.filter(order => order.estado === filterEstado);

  // Aplicar filtros de fecha
  if (startDate) {
    filteredOrders = filteredOrders.filter(order => {
      const orderDate = new Date(order.fecha_creacion);
      return orderDate >= new Date(startDate);
    });
  }

  if (endDate) {
    filteredOrders = filteredOrders.filter(order => {
      const orderDate = new Date(order.fecha_creacion);
      return orderDate <= new Date(endDate + 'T23:59:59');
    });
  };

  const openOrderDetails = (order) => {
    setSelectedOrder(order);
    setShowDetailsDialog(true);
  };

  const fetchWhatsappConfig = async () => {
    try {
      const response = await axios.get(`${API}/whatsapp-config`);
      setWhatsappNumber(response.data.number);
    } catch (error) {
      console.error('Error fetching WhatsApp config:', error);
    }
  };

  const openTelegramChat = (chatId) => {
    window.open(`https://t.me/user?id=${chatId}`, '_blank');
  };

  const openWhatsAppChat = (phoneNumber) => {
    if (!whatsappNumber) {
      toast.error('Número de WhatsApp no configurado. Ve a Configuración Bot.');
      return;
    }
    const message = encodeURIComponent(`Hola! Me contacto desde el backoffice de IDN. Cliente: ${phoneNumber || 'Sin teléfono'}`);
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="page-container" data-testid="orders-page">
      <div className="page-header">
        <h1 className="page-title" data-testid="page-title">Pedidos</h1>
        <p className="page-description">Gestiona todos los pedidos recibidos desde el bot de Telegram</p>
      </div>

      <div className="stats-grid">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Pedidos</p>
                <h3 className="text-3xl font-bold mt-2" data-testid="total-orders">{orders.length}</h3>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pendientes</p>
                <h3 className="text-3xl font-bold mt-2" data-testid="pending-orders">
                  {orders.filter(o => o.estado === 'pendiente').length}
                </h3>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Entregados</p>
                <h3 className="text-3xl font-bold mt-2" data-testid="delivered-orders">
                  {orders.filter(o => o.estado === 'entregado').length}
                </h3>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filter-estado-main">Estado</Label>
              <Select value={filterEstado} onValueChange={setFilterEstado}>
                <SelectTrigger id="filter-estado-main" data-testid="filter-estado">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="a_confirmar">A Confirmar</SelectItem>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                  <SelectItem value="en_preparacion">En Preparación</SelectItem>
                  <SelectItem value="entregado">Entregado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                  <SelectItem value="spam">Spam</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="start-date">Fecha Desde</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">Fecha Hasta</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setFilterEstado('all');
                }}
                className="w-full"
                data-testid="clear-filters-btn"
              >
                Limpiar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo Lista</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Método Pago</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id} data-testid={`order-row-${order.id}`}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="font-medium text-sm">
                            {order.cliente_nombre || 'No especificado'}
                          </span>
                        </div>
                        {order.cliente_telefono && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Phone className="w-3 h-3" />
                            {order.cliente_telefono}
                          </div>
                        )}
                        <Button 
                          size="sm" 
                          variant="link" 
                          className="p-0 h-auto text-xs"
                          onClick={() => openOrderDetails(order)}
                          data-testid={`view-details-${order.id}`}
                        >
                          Ver detalles completos →
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {order.tipo_lista}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {order.productos.slice(0, 2).map((prod, idx) => (
                          <div key={idx} className="text-sm">
                            {prod.nombre_producto} x{prod.cantidad}
                          </div>
                        ))}
                        {order.productos.length > 2 && (
                          <div className="text-xs text-gray-500">
                            +{order.productos.length - 2} más
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      ${order.total.toFixed(2)}
                    </TableCell>
                    <TableCell className="capitalize">
                      {order.metodo_pago}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={`status-badge ${order.estado}`}
                        data-testid={`order-status-${order.id}`}
                      >
                        {estadoLabels[order.estado]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      <div className="space-y-1">
                        <div>
                          {new Date(order.fecha_creacion).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="text-xs font-semibold text-indigo-600">
                          {new Date(order.fecha_creacion).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })} hs
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Select
                          value={order.estado}
                          onValueChange={(value) => updateOrderStatus(order.id, value)}
                          disabled={updatingOrder === order.id}
                        >
                          <SelectTrigger className="w-[140px]" data-testid={`change-status-${order.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendiente">Pendiente</SelectItem>
                            <SelectItem value="a_confirmar">A Confirmar</SelectItem>
                            <SelectItem value="confirmado">Confirmado</SelectItem>
                            <SelectItem value="en_preparacion">En Preparación</SelectItem>
                            <SelectItem value="entregado">Entregado</SelectItem>
                            <SelectItem value="cancelado">Cancelado</SelectItem>
                            <SelectItem value="spam">Spam</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openTelegramChat(order.chat_id)}
                          data-testid={`contact-telegram-${order.id}`}
                          title="Contactar por Telegram"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteOrder(order.id, order.cliente_nombre)}
                          data-testid={`delete-order-${order.id}`}
                          title="Eliminar pedido"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredOrders.length === 0 && (
              <div className="text-center py-12" data-testid="no-orders">
                <ShoppingCart className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No hay pedidos para mostrar</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Dialog de Detalles del Pedido */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles del Pedido</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              {/* Información del Cliente */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-lg mb-3">📋 Información del Cliente</h3>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-indigo-600 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Nombre</p>
                      <p className="font-medium">{selectedOrder.cliente_nombre || 'No especificado'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-indigo-600 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Teléfono</p>
                      <p className="font-medium">{selectedOrder.cliente_telefono || 'No especificado'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-indigo-600 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Dirección de Entrega</p>
                      <p className="font-medium">{selectedOrder.cliente_direccion || 'No especificada'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MessageCircle className="w-5 h-5 text-indigo-600 mt-0.5" />
                    <div className="w-full">
                      <p className="text-xs text-gray-500">Información de Telegram</p>
                      <div className="space-y-1 mt-1">
                        {selectedOrder.telegram_username && (
                          <p className="font-medium text-sm">Usuario: {selectedOrder.telegram_username}</p>
                        )}
                        {selectedOrder.telegram_nombre_completo && selectedOrder.telegram_nombre_completo !== "No disponible" && (
                          <p className="text-sm text-gray-700">Nombre TG: {selectedOrder.telegram_nombre_completo}</p>
                        )}
                        <p className="text-xs text-gray-500">Chat ID: {selectedOrder.chat_id}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {selectedOrder.comprobante_file_id && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-2">📎 Comprobante de Pago</p>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={async () => {
                        try {
                          const response = await axios.get(`${API}/orders/${selectedOrder.id}/comprobante`);
                          window.open(response.data.file_url, '_blank');
                        } catch (error) {
                          console.error('Error obteniendo comprobante:', error);
                          const errorMessage = error.response?.data?.detail || 'Error al abrir el comprobante';
                          toast.error(errorMessage);
                        }
                      }}
                    >
                      Ver Comprobante
                    </Button>
                  </div>
                )}
                
                <div className="space-y-2 mt-3">
                  <Button 
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                    onClick={() => openTelegramChat(selectedOrder.chat_id)}
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Contactar por Telegram
                  </Button>
                  {whatsappNumber && (
                    <Button 
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => openWhatsAppChat(selectedOrder.cliente_telefono)}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Contactar por WhatsApp
                    </Button>
                  )}
                </div>
              </div>

              {/* Detalles del Pedido */}
              <div>
                <h3 className="font-semibold text-lg mb-3">🛒 Detalles del Pedido</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">ID del Pedido:</span>
                    <span className="font-mono">{selectedOrder.id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tipo de Lista:</span>
                    <Badge variant="outline" className="capitalize">{selectedOrder.tipo_lista}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Método de Pago:</span>
                    <span className="capitalize font-medium">{selectedOrder.metodo_pago}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Estado:</span>
                    <Badge className={`status-badge ${selectedOrder.estado}`}>
                      {estadoLabels[selectedOrder.estado]}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Fecha y Hora:</span>
                    <div className="text-right">
                      <div className="font-medium">
                        {new Date(selectedOrder.fecha_creacion).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </div>
                      <div className="text-xs text-indigo-600 font-semibold">
                        {new Date(selectedOrder.fecha_creacion).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false
                        })} hs
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Productos */}
              <div>
                <h3 className="font-semibold text-lg mb-3">📦 Productos</h3>
                <div className="space-y-2">
                  {selectedOrder.productos.map((prod, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{prod.nombre_producto}</p>
                        <p className="text-sm text-gray-600">
                          Cantidad: {prod.cantidad} × ${prod.precio_unitario.toFixed(2)}
                        </p>
                      </div>
                      <p className="font-semibold">${prod.subtotal.toFixed(2)}</p>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg border-2 border-indigo-200 mt-3">
                    <p className="font-bold text-lg">Total</p>
                    <p className="font-bold text-lg text-indigo-600">${selectedOrder.total.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;