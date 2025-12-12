import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await axios.get('/api/auth/status', {
        withCredentials: true
      });
      
      setIsAuthenticated(response.data.authenticated);
      setCharacters(response.data.characters || []);
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    try {
      const response = await axios.get('/api/auth/login');
      window.location.href = response.data.authUrl;
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout', {}, { withCredentials: true });
      setIsAuthenticated(false);
      setCharacters([]);
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const refreshCharacters = async () => {
    await checkAuthStatus();
  };

  const value = {
    isAuthenticated,
    characters,
    loading,
    login,
    logout,
    refreshCharacters
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
