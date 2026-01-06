import React, { createContext, useContext, useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored auth on mount
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('authUser');
    
    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        // Verify token is still valid
        verifyToken(storedToken).catch(() => {
          logout();
        });
      } catch {
        logout();
      }
    }
    setLoading(false);
  }, []);

  const verifyToken = async (authToken) => {
    const response = await fetch(`${API_URL}/api/auth/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    if (!response.ok) {
      throw new Error('Invalid token');
    }
    return response.json();
  };

  const login = async (username, password) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    const data = await response.json();
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('authUser', JSON.stringify(data.user));
    return data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
  };

  const isAdmin = () => user?.role === 'admin';
  
  // Super-admin is the user with username 'admin'
  const isSuperAdmin = () => user?.role === 'admin' && user?.username === 'admin';
  
  const isObserver = () => user?.role === 'observer';
  
  const canEdit = () => user?.role === 'admin' || user?.role === 'employee';
  
  // Can view pricing pages (admin and observer)
  const canViewPricing = () => user?.role === 'admin' || user?.role === 'observer';

  const hasAccess = (calculator) => {
    if (!user) return false;
    
    // Admins have access to everything including driver panel
    if (user.role === 'admin') return true;
    if (user.role === 'observer') return true;
    
    // Driver role automatically has access to driver panel
    if (calculator === 'driver' && user.role === 'driver') return true;
    
    // Drivers only have access to driver panel
    if (user.role === 'driver') {
      return calculator === 'driver';
    }
    
    if (user.access === 'all') return true;
    // Support both string and array access
    if (Array.isArray(user.access)) {
      return user.access.includes(calculator);
    }
    return user.access === calculator;
  };
  
  const isDriver = () => user?.role === 'driver';

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAdmin,
    isSuperAdmin,
    isObserver,
    isDriver,
    canEdit,
    canViewPricing,
    hasAccess,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
