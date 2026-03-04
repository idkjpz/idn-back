import { useEffect, useState } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Statistics from './pages/Statistics';
import BotConfig from './pages/BotConfig';
import OrderHistory from './pages/OrderHistory';
import LiveChat from './pages/LiveChat';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from '@/components/ui/sonner';
import { Package, ShoppingCart, TrendingUp, Settings, History, MessageCircle, LogOut } from 'lucide-react';

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', label: 'Pedidos', icon: ShoppingCart },
    { path: '/products', label: 'Productos', icon: Package },
    { path: '/chat', label: 'Chat en Vivo', icon: MessageCircle },
    { path: '/history', label: 'Historial', icon: History },
    { path: '/statistics', label: 'Estadísticas', icon: TrendingUp },
    { path: '/bot-config', label: 'Configuración Bot', icon: Settings },
  ];

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    navigate('/login');
  };

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <ShoppingCart className="logo-icon" />
          <span>IDN Backoffice</span>
        </div>
      </div>

      <div className="nav-links">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${isActive ? 'active' : ''}`}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <button
          onClick={handleLogout}
          className="nav-link logout-btn"
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: '#ef4444',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}
        >
          <LogOut size={20} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </nav>
  );
};

const AppContent = () => {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  return (
    <>
      {isLoginPage ? (
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      ) : (
        <div className="app-layout">
          <Navigation />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
              <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><LiveChat /></ProtectedRoute>} />
              <Route path="/history" element={<ProtectedRoute><OrderHistory /></ProtectedRoute>} />
              <Route path="/statistics" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
              <Route path="/bot-config" element={<ProtectedRoute><BotConfig /></ProtectedRoute>} />
            </Routes>
          </main>
        </div>
      )}
      <Toaster position="top-right" />
    </>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </div>
  );
}

export default App;