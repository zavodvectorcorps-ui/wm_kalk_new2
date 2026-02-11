import React, { createContext, useContext, useState, useEffect } from 'react';

// Smart API URL - auto-detect on production
const getApiUrl = () => { 
  if (typeof window !== 'undefined') { 
    const o = window.location.origin; 
    if (o.includes('wm-kalkulator.pl') || o.includes('.emergent.host') || o.includes('.emergentagent.com')) return o; 
  } 
  return process.env.REACT_APP_BACKEND_URL || ''; 
};
const API_URL = getApiUrl();

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
    // Retry logic for unstable network/server
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(`${API_URL}/api/auth/verify`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        if (!response.ok) {
          // Don't retry on 401 - token is invalid
          if (response.status === 401) {
            throw new Error('Invalid token');
          }
          throw new Error(`Server error: ${response.status}`);
        }
        return response.json();
      } catch (error) {
        lastError = error;
        // Don't retry on invalid token
        if (error.message === 'Invalid token') {
          throw error;
        }
        console.warn(`Token verify attempt ${attempt} failed:`, error.message);
        if (attempt < 3) {
          // Wait before retry (300ms, 600ms)
          await new Promise(resolve => setTimeout(resolve, attempt * 300));
        }
      }
    }
    throw lastError || new Error('Token verification failed');
  };

  const login = async (username, password) => {
    // Retry logic for unstable network/server
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, password })
        });

        // Read body as text first (can only read once)
        const responseText = await response.text();
        
        // Try to parse as JSON
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          // Not valid JSON - server error
          throw new Error(`Server error: ${response.status}`);
        }
        
        if (!response.ok) {
          const errorMessage = data.detail || `Server error: ${response.status}`;
          
          // If it's a real auth error (wrong password), don't retry
          if (response.status === 401) {
            throw new Error(errorMessage);
          }
          // For server errors (500, 502, 503, 520), retry
          throw new Error(errorMessage);
        }

        // Success - save token and user
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('authUser', JSON.stringify(data.user));
        return data.user;
      } catch (error) {
        lastError = error;
        // Don't retry on auth errors (wrong password)
        if (error.message && (error.message.includes('Invalid credentials') || error.message.includes('credentials'))) {
          throw error;
        }
        console.warn(`Login attempt ${attempt} failed:`, error.message);
        if (attempt < 3) {
          // Wait before retry (increases with each attempt)
          await new Promise(resolve => setTimeout(resolve, attempt * 500));
        }
      }
    }
    throw lastError || new Error('Login failed after 3 attempts');
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
    
    // Training is accessible to all employees (managers) and admins
    if (calculator === 'training') {
      return user.role === 'admin' || user.role === 'employee' || user.role === 'observer';
    }
    
    // Driver role automatically has access to driver panel
    if (calculator === 'driver' && user.role === 'driver') return true;
    
    // Warehouse role automatically has access to warehouse
    if (calculator === 'warehouse' && user.role === 'warehouse') return true;
    
    // Drivers only have access to driver panel
    if (user.role === 'driver') {
      return calculator === 'driver';
    }
    
    // Warehouse users only have access to warehouse
    if (user.role === 'warehouse') {
      return calculator === 'warehouse';
    }
    
    if (user.access === 'all') return true;
    // Support both string and array access
    if (Array.isArray(user.access)) {
      return user.access.includes(calculator);
    }
    return user.access === calculator;
  };
  
  const isDriver = () => user?.role === 'driver';
  const isWarehouse = () => user?.role === 'warehouse';

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
    isWarehouse,
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
