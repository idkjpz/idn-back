import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Edit, Trash2, Package, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    imagen_url: '',
    precio_minorista: '',
    precio_mayorista: '',
    stock: '',
    punto_pedido: '',
    punto_critico: '',
    categoria: 'General',
    activo: true
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API}/products`);
      setProducts(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Error al cargar los productos');
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
      nombre: '',
      descripcion: '',
      imagen_url: '',
      precio_minorista: '',
      precio_mayorista: '',
      stock: '',
      punto_pedido: '',
      punto_critico: '',
      categoria: 'Orales',
      activo: true
    });
    setEditingProduct(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const productData = {
      ...formData,
      precio_minorista: parseFloat(formData.precio_minorista),
      precio_mayorista: parseFloat(formData.precio_mayorista),
      stock: parseInt(formData.stock)
    };

    try {
      if (editingProduct) {
        await axios.put(`${API}/products/${editingProduct.id}`, productData);
        toast.success('Producto actualizado');
      } else {
        await axios.post(`${API}/products`, productData);
        toast.success('Producto creado');
      }
      
      fetchProducts();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Error al guardar el producto');
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      nombre: product.nombre,
      descripcion: product.descripcion,
      imagen_url: product.imagen_url,
      precio_minorista: product.precio_minorista.toString(),
      precio_mayorista: product.precio_mayorista.toString(),
      stock: product.stock.toString(),
      punto_pedido: (product.punto_pedido || 0).toString(),
      punto_critico: (product.punto_critico || 0).toString(),
      categoria: product.categoria,
      activo: product.activo
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('¿Estás seguro de eliminar este producto?')) return;
    
    try {
      await axios.delete(`${API}/products/${productId}`);
      toast.success('Producto eliminado');
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Error al eliminar el producto');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="page-container" data-testid="products-page">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title" data-testid="page-title">Productos</h1>
            <p className="page-description">Gestiona tu catálogo de productos</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button data-testid="add-product-btn" className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Producto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle data-testid="dialog-title">
                  {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      name="nombre"
                      value={formData.nombre}
                      onChange={handleInputChange}
                      required
                      data-testid="input-nombre"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="categoria">Categoría *</Label>
                    <Select
                      value={formData.categoria}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, categoria: value }))}
                    >
                      <SelectTrigger data-testid="select-categoria">
                        <SelectValue placeholder="Selecciona una categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Orales">💊 Orales</SelectItem>
                        <SelectItem value="Inyectables">💉 Inyectables</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descripcion">Descripción *</Label>
                  <Textarea
                    id="descripcion"
                    name="descripcion"
                    value={formData.descripcion}
                    onChange={handleInputChange}
                    rows={3}
                    required
                    data-testid="input-descripcion"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="imagen_url">URL de Imagen *</Label>
                  <Input
                    id="imagen_url"
                    name="imagen_url"
                    value={formData.imagen_url}
                    onChange={handleInputChange}
                    placeholder="https://ejemplo.com/imagen.jpg"
                    required
                    data-testid="input-imagen-url"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="precio_minorista">Precio Minorista *</Label>
                    <Input
                      id="precio_minorista"
                      name="precio_minorista"
                      type="number"
                      step="0.01"
                      value={formData.precio_minorista}
                      onChange={handleInputChange}
                      required
                      data-testid="input-precio-minorista"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="precio_mayorista">Precio Mayorista *</Label>
                    <Input
                      id="precio_mayorista"
                      name="precio_mayorista"
                      type="number"
                      step="0.01"
                      value={formData.precio_mayorista}
                      onChange={handleInputChange}
                      required
                      data-testid="input-precio-mayorista"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock">Stock *</Label>
                    <Input
                      id="stock"
                      name="stock"
                      type="number"
                      value={formData.stock}
                      onChange={handleInputChange}
                      required
                      data-testid="input-stock"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="punto_pedido">Punto de Pedido</Label>
                    <Input
                      id="punto_pedido"
                      name="punto_pedido"
                      type="number"
                      min="0"
                      value={formData.punto_pedido}
                      onChange={handleInputChange}
                      placeholder="Ej: 15"
                      data-testid="input-punto-pedido"
                    />
                    <p className="text-xs text-gray-500">Stock mínimo para realizar pedido</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="punto_critico">Punto Crítico</Label>
                    <Input
                      id="punto_critico"
                      name="punto_critico"
                      type="number"
                      min="0"
                      value={formData.punto_critico}
                      onChange={handleInputChange}
                      placeholder="Ej: 5"
                      data-testid="input-punto-critico"
                    />
                    <p className="text-xs text-gray-500">Stock mínimo crítico</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="activo"
                    checked={formData.activo}
                    onCheckedChange={handleSwitchChange}
                    data-testid="switch-activo"
                  />
                  <Label htmlFor="activo">Producto Activo</Label>
                </div>

                <DialogFooter>
                  <Button type="submit" data-testid="submit-product-btn">
                    {editingProduct ? 'Actualizar' : 'Crear'} Producto
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo de Productos</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imagen</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Precio Minorista</TableHead>
                  <TableHead>Precio Mayorista</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id} data-testid={`product-row-${product.id}`}>
                    <TableCell>
                      <img
                        src={product.imagen_url}
                        alt={product.nombre}
                        className="w-12 h-12 object-cover rounded-lg"
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/48';
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{product.nombre}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{product.categoria}</Badge>
                    </TableCell>
                    <TableCell>${product.precio_minorista.toFixed(2)}</TableCell>
                    <TableCell>${product.precio_mayorista.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={product.stock < 10 ? 'destructive' : 'secondary'}
                        data-testid={`stock-${product.id}`}
                      >
                        {product.stock}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={product.activo ? 'success' : 'secondary'}
                        className={product.activo ? 'bg-green-100 text-green-800' : ''}
                      >
                        {product.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(product)}
                          data-testid={`edit-product-${product.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(product.id)}
                          data-testid={`delete-product-${product.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {products.length === 0 && (
              <div className="text-center py-12" data-testid="no-products">
                <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No hay productos creados</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default Products;