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
        
        // Read body as text first (safe approach)
        const responseText = await response.text();
        
        if (!response.ok) {
          // Don't retry on 401 - token is invalid
          if (response.status === 401) {
            throw new Error('Invalid token');
          }
          throw new Error(`Server error: ${response.status}`);
        }
        
        // Parse JSON from text
        try {
          return JSON.parse(responseText);
        } catch (e) {
          throw new Error('Invalid server response');
        }
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

  // Apply a fresh token + user (e.g. after the super-admin changes own creds).
  const applyAuth = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('authToken', newToken);
    localStorage.setItem('authUser', JSON.stringify(newUser));
  };

  const isAdmin = () => user?.role === 'admin';
  
  // Super-admin is identified by the `superAdmin` DB flag (decoupled from the
  // username) so the account can be renamed freely. Fallback to the legacy
  // username check keeps older tokens working until the next login.
  const isSuperAdmin = () => user?.role === 'admin' && (user?.superAdmin === true || user?.username === 'admin');
  
  const isObserver = () => user?.role === 'observer';
  
  const isMarketer = () => user?.role === 'marketer';
  
  const canEdit = () => user?.role === 'admin' || user?.role === 'employee' || user?.role === 'marketer';
  
  // Can view pricing pages (admin, observer, and marketer)
  const canViewPricing = () => user?.role === 'admin' || user?.role === 'observer' || user?.role === 'marketer';
  
  // Can delete orders (admin only)
  const canDeleteOrders = () => user?.role === 'admin';

  const hasAccess = (calculator) => {
    if (!user) return false;
    
    // Admins have access to everything including driver panel
    if (user.role === 'admin') return true;
    if (user.role === 'observer') return true;
    
    // Marketer: access to balia and sauna calculators + pricing
    if (user.role === 'marketer') {
      return ['balia', 'sauna', 'training'].includes(calculator);
    }
    
    // Training is accessible to all employees (managers) and admins
    if (calculator === 'training') {
      return user.role === 'admin' || user.role === 'employee' || user.role === 'observer';
    }
    
    // Driver role automatically has access to driver panel
    if (calculator === 'driver' && user.role === 'driver') return true;
    
    // Warehouse role automatically has access to warehouse
    if (calculator === 'warehouse' && user.role === 'warehouse') return true;
    
    // Storekeeper: warehouse + logistics (read-only)
    if (user.role === 'storekeeper') {
      return calculator === 'warehouse' || calculator === 'logistics';
    }
    
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
  const isStorekeeper = () => user?.role === 'storekeeper';

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    applyAuth,
    isAdmin,
    isSuperAdmin,
    isObserver,
    isMarketer,
    isDriver,
    isWarehouse,
    isStorekeeper,
    canEdit,
    canViewPricing,
    canDeleteOrders,
    hasAccess,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
