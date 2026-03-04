import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, DollarSign, Package, TrendingUp, Loader2, Filter } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const OrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filteredData, setFilteredData] = useState([]);

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (orders.length > 0) {
      processOrderHistory();
    }
  }, [orders, startDate, endDate]);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/orders`);
      setOrders(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Error al cargar el historial');
      setLoading(false);
    }
  };

  const processOrderHistory = () => {
    // Filtrar solo pedidos entregados
    let completedOrders = orders.filter(order => order.estado === 'entregado');

    // Aplicar filtros de fecha
    if (startDate) {
      completedOrders = completedOrders.filter(order => {
        const orderDate = new Date(order.fecha_creacion);
        return orderDate >= new Date(startDate);
      });
    }

    if (endDate) {
      completedOrders = completedOrders.filter(order => {
        const orderDate = new Date(order.fecha_creacion);
        return orderDate <= new Date(endDate + 'T23:59:59');
      });
    }

    // Agrupar por fecha
    const groupedByDate = {};
    completedOrders.forEach(order => {
      const date = new Date(order.fecha_creacion).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      if (!groupedByDate[date]) {
        groupedByDate[date] = {
          date,
          count: 0,
          total: 0,
          orders: []
        };
      }

      groupedByDate[date].count++;
      groupedByDate[date].total += order.total;
      groupedByDate[date].orders.push(order);
    });

    // Convertir a array y ordenar por fecha (más reciente primero)
    const historyArray = Object.values(groupedByDate).sort((a, b) => {
      const dateA = a.date.split('/').reverse().join('-');
      const dateB = b.date.split('/').reverse().join('-');
      return dateB.localeCompare(dateA);
    });

    setFilteredData(historyArray);
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  const totalCompleted = filteredData.reduce((sum, day) => sum + day.count, 0);
  const totalRevenue = filteredData.reduce((sum, day) => sum + day.total, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="page-container" data-testid="order-history-page">
      <div className="page-header">
        <h1 className="page-title" data-testid="page-title">Historial de Pedidos</h1>
        <p className="page-description">Pedidos completados agrupados por fecha</p>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtrar por Fecha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                onClick={clearFilters}
                className="w-full"
                data-testid="clear-filters-btn"
              >
                Limpiar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="stats-grid mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Completados</p>
                <h3 className="text-3xl font-bold mt-2" data-testid="total-completed">
                  {totalCompleted}
                </h3>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ingresos Totales</p>
                <h3 className="text-3xl font-bold mt-2" data-testid="total-revenue">
                  ${totalRevenue.toFixed(2)}
                </h3>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Promedio por Día</p>
                <h3 className="text-3xl font-bold mt-2" data-testid="avg-per-day">
                  {filteredData.length > 0 ? (totalCompleted / filteredData.length).toFixed(1) : '0'}
                </h3>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Historial */}
      <Card>
        <CardHeader>
          <CardTitle>Historial por Fecha</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Pedidos Completados</TableHead>
                  <TableHead>Ingresos del Día</TableHead>
                  <TableHead>Promedio por Pedido</TableHead>
                  <TableHead>Tipo de Lista</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((dayData, index) => {
                  const avgPerOrder = dayData.total / dayData.count;
                  const minorista = dayData.orders.filter(o => o.tipo_lista === 'minorista').length;
                  const mayorista = dayData.orders.filter(o => o.tipo_lista === 'mayorista').length;

                  return (
                    <TableRow key={index} data-testid={`history-row-${index}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          {dayData.date}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-2xl font-bold text-green-600">
                          {dayData.count}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold text-indigo-600">
                        ${dayData.total.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        ${avgPerOrder.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {minorista > 0 && (
                            <div>🛍️ Minorista: {minorista}</div>
                          )}
                          {mayorista > 0 && (
                            <div>📦 Mayorista: {mayorista}</div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {filteredData.length === 0 && (
              <div className="text-center py-12" data-testid="no-history">
                <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No hay pedidos completados en el rango seleccionado</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderHistory;
