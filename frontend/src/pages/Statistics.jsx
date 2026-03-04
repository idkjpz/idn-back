import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, TrendingUp, Package, AlertTriangle, Loader2, MessageSquare, Users, Filter, Eye, Award, Target } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

const Statistics = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [botInteractions, setBotInteractions] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [dayDetails, setDayDetails] = useState(null);
  const [stockAlerts, setStockAlerts] = useState(null);

  useEffect(() => {
    fetchStatistics();
    fetchBotInteractions();
    fetchStockAlerts();
  }, []);

  useEffect(() => {
    fetchBotInteractions();
  }, [selectedMonth]);

  const fetchStatistics = async () => {
    try {
      const response = await axios.get(`${API}/stats`);
      setStats(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching statistics:', error);
      toast.error('Error al cargar las estadísticas');
      setLoading(false);
    }
  };

  const fetchBotInteractions = async () => {
    try {
      const params = new URLSearchParams();
      
      if (selectedMonth) {
        const [year, month] = selectedMonth.split('-');
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0);
        
        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];
        
        params.append('start_date', startStr);
        params.append('end_date', endStr);
      }
      
      const response = await axios.get(`${API}/bot-interactions?${params}`);
      setBotInteractions(response.data);
    } catch (error) {
      console.error('Error fetching bot interactions:', error);
    }
  };

  const fetchStockAlerts = async () => {
    try {
      const response = await axios.get(`${API}/products/alerts/stock`);
      setStockAlerts(response.data);
    } catch (error) {
      console.error('Error fetching stock alerts:', error);
      toast.error('Error al cargar alertas de stock');
    }
  };

  const fetchDayDetails = async (date) => {
    try {
      const params = new URLSearchParams();
      params.append('start_date', date);
      params.append('end_date', date);
      
      const response = await axios.get(`${API}/bot-interactions?${params}`);
      
      // Agrupar por usuario
      const userStats = {};
      response.data.interactions.forEach(interaction => {
        const userId = interaction.chat_id;
        if (!userStats[userId]) {
          userStats[userId] = {
            chat_id: userId,
            username: interaction.username || 'Sin username',
            count: 0,
            interactions: []
          };
        }
        userStats[userId].count++;
        userStats[userId].interactions.push(interaction);
      });
      
      // Convertir a array y ordenar por cantidad de mensajes
      const sortedUsers = Object.values(userStats).sort((a, b) => b.count - a.count);
      
      setDayDetails(sortedUsers);
      setSelectedDate(date);
      setShowDetailsDialog(true);
    } catch (error) {
      console.error('Error fetching day details:', error);
      toast.error('Error al cargar los detalles del día');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No hay datos disponibles</p>
      </div>
    );
  }

  const ordersByStatusData = stats.orders_by_status.map(item => ({
    name: item._id || 'Sin estado',
    value: item.count
  }));

  const ventasPorTipoData = stats.ventas_por_tipo.map(item => ({
    tipo: item._id,
    ventas: item.total,
    pedidos: item.count
  }));

  return (
    <div className="page-container" data-testid="statistics-page">
      <div className="page-header">
        <h1 className="page-title" data-testid="page-title">Estadísticas y Reportes</h1>
        <p className="page-description">Análisis detallado de ventas y productos</p>
      </div>

      <div className="stats-grid">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Ventas</p>
                <h3 className="text-3xl font-bold mt-2" data-testid="total-sales">
                  ${stats.total_ventas.toFixed(2)}
                </h3>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Pedidos</p>
                <h3 className="text-3xl font-bold mt-2" data-testid="total-orders-stat">
                  {stats.total_orders}
                </h3>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Productos Bajo Stock</p>
                <h3 className="text-3xl font-bold mt-2" data-testid="low-stock-count">
                  {stats.low_stock_products.length}
                </h3>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de Stock */}
      {stockAlerts && (stockAlerts.total_criticas > 0 || stockAlerts.total_pedido > 0) && (
        <Card className="mb-6 border-l-4 border-l-red-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Alertas de Recompra de Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Alertas Críticas */}
              {stockAlerts.alertas_criticas.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Stock Crítico ({stockAlerts.total_criticas})
                  </h3>
                  <div className="space-y-2">
                    {stockAlerts.alertas_criticas.map((alert) => (
                      <div 
                        key={alert.id} 
                        className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <Package className="w-5 h-5 text-red-600" />
                          <div>
                            <p className="font-medium text-sm">{alert.nombre}</p>
                            <p className="text-xs text-gray-600">
                              <Badge variant="outline" className="mr-2">{alert.categoria}</Badge>
                              Stock actual: <span className="font-bold text-red-600">{alert.stock}</span> | 
                              Punto crítico: {alert.punto_critico}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-red-600 text-white">URGENTE</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Alertas de Punto de Pedido */}
              {stockAlerts.alertas_pedido.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-yellow-600 mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Punto de Pedido Alcanzado ({stockAlerts.total_pedido})
                  </h3>
                  <div className="space-y-2">
                    {stockAlerts.alertas_pedido.map((alert) => (
                      <div 
                        key={alert.id} 
                        className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <Package className="w-5 h-5 text-yellow-600" />
                          <div>
                            <p className="font-medium text-sm">{alert.nombre}</p>
                            <p className="text-xs text-gray-600">
                              <Badge variant="outline" className="mr-2">{alert.categoria}</Badge>
                              Stock actual: <span className="font-bold text-yellow-600">{alert.stock}</span> | 
                              Punto de pedido: {alert.punto_pedido}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-yellow-600 text-white">PEDIDO</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Ventas por Tipo de Lista</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ventasPorTipoData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tipo" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="ventas" fill="#6366f1" name="Ventas ($)" />
                <Bar dataKey="pedidos" fill="#8b5cf6" name="Pedidos" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pedidos por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={ordersByStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {ordersByStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Estadísticas de Interacciones del Bot */}
      {botInteractions && (
        <>
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-4">📱 Estadísticas del Bot</h2>
            
            {/* Filtro Simple por Mes */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Filtrar por Mes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="month-selector">Seleccionar Mes</Label>
                    <Input
                      id="month-selector"
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      data-testid="input-month-selector"
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-gray-500">
                      {selectedMonth ? 'Mostrando datos del mes seleccionado' : 'Mostrando todos los datos'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedMonth('')}
                    className="w-full"
                    data-testid="clear-filters-interactions-btn"
                    disabled={!selectedMonth}
                  >
                    Ver Todos los Meses
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Resumen de Interacciones */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Mensajes Respondidos</p>
                      <h3 className="text-3xl font-bold mt-2" data-testid="total-bot-interactions">
                        {botInteractions.total_interactions}
                      </h3>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Usuarios Únicos</p>
                      <h3 className="text-3xl font-bold mt-2" data-testid="unique-users">
                        {botInteractions.unique_users}
                      </h3>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabla de Interacciones por Fecha */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Interacciones por Fecha</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-center">Mensajes Respondidos</TableHead>
                        <TableHead className="text-center">Usuarios Únicos</TableHead>
                        <TableHead className="text-center">Promedio por Usuario</TableHead>
                        <TableHead className="text-center">Detalles</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {botInteractions.by_date.map((dayData, index) => {
                        const avgPerUser = (dayData.count / dayData.unique_users).toFixed(1);
                        const formattedDate = new Date(dayData.date).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        });

                        return (
                          <TableRow key={index} data-testid={`interaction-row-${index}`}>
                            <TableCell className="font-medium">
                              {formattedDate}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-2xl font-bold text-blue-600">
                                {dayData.count}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-lg font-semibold text-purple-600">
                                {dayData.unique_users}
                              </span>
                            </TableCell>
                            <TableCell className="text-center text-gray-600">
                              {avgPerUser} msg/usuario
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => fetchDayDetails(dayData.date)}
                                data-testid={`view-details-${dayData.date}`}
                                className="gap-2"
                              >
                                <Eye className="w-4 h-4" />
                                Ver Usuarios
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {botInteractions.by_date.length === 0 && (
                    <div className="text-center py-12" data-testid="no-interactions">
                      <MessageSquare className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500">No hay interacciones en el rango seleccionado</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <h2 className="text-2xl font-bold mb-4">📊 Estadísticas de Ventas</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Productos Más Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {stats.top_productos.map((producto, index) => (
                  <div 
                    key={producto._id} 
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    data-testid={`top-product-${index}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center font-bold text-indigo-600">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{producto.nombre}</p>
                        <p className="text-sm text-gray-600">
                          {producto.cantidad_vendida} unidades vendidas
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">
                        ${producto.ingresos.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
                {stats.top_productos.length === 0 && (
                  <div className="text-center py-8" data-testid="no-top-products">
                    <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">No hay datos de productos vendidos</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Detalles por Usuario */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" />
              Detalle de Usuarios - {selectedDate && new Date(selectedDate).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })}
            </DialogTitle>
          </DialogHeader>
          
          {dayDetails && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Marketing: Usuarios por Actividad
                </h3>
                <p className="text-sm text-blue-700">
                  Los usuarios con más interacciones son candidatos ideales para campañas dirigidas.
                </p>
              </div>

              <div className="space-y-3">
                {dayDetails.map((user, index) => {
                  const percentage = ((user.count / dayDetails.reduce((sum, u) => sum + u.count, 0)) * 100).toFixed(1);
                  
                  return (
                    <Card key={user.chat_id} className={index === 0 ? 'border-2 border-green-500' : ''}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {index === 0 && (
                              <div className="bg-green-100 rounded-full p-2">
                                <Award className="w-5 h-5 text-green-600" />
                              </div>
                            )}
                            {index === 1 && (
                              <div className="bg-blue-100 rounded-full p-2">
                                <Award className="w-5 h-5 text-blue-600" />
                              </div>
                            )}
                            {index === 2 && (
                              <div className="bg-orange-100 rounded-full p-2">
                                <Award className="w-5 h-5 text-orange-600" />
                              </div>
                            )}
                            {index > 2 && (
                              <div className="bg-gray-100 rounded-full p-2 w-9 h-9 flex items-center justify-center">
                                <span className="text-sm font-semibold text-gray-600">#{index + 1}</span>
                              </div>
                            )}
                            
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-lg">
                                  {user.username}
                                </span>
                                {index === 0 && (
                                  <Badge className="bg-green-100 text-green-800">
                                    🎯 Top Usuario
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">
                                Chat ID: {user.chat_id}
                              </p>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-3xl font-bold text-indigo-600">
                              {user.count}
                            </div>
                            <p className="text-sm text-gray-600">
                              mensajes ({percentage}%)
                            </p>
                          </div>
                        </div>
                        
                        {/* Barra de progreso */}
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                index === 0 ? 'bg-green-500' : 
                                index === 1 ? 'bg-blue-500' : 
                                index === 2 ? 'bg-orange-500' : 
                                'bg-gray-400'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Statistics;