import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('authToken');
  const [status, setStatus] = useState('checking'); // 'checking' | 'valid' | 'invalid'

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }

    // Verificar token con el backend
    fetch(`${BACKEND_URL}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.ok) {
          setStatus('valid');
        } else {
          localStorage.removeItem('authToken');
          localStorage.removeItem('username');
          setStatus('invalid');
        }
      })
      .catch(() => {
        // Si no hay conexión al backend, permitir si hay token (modo offline graceful)
        setStatus(token ? 'valid' : 'invalid');
      });
  }, [token]);

  if (status === 'checking') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: '#6366f1' }}>Verificando sesión...</div>
      </div>
    );
  }

  if (status === 'invalid') {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
