import React, { createContext, useContext, useState, useEffect } from 'react';
import * as api from '../services/api';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    try { return stored ? JSON.parse(stored) : null; } catch { localStorage.removeItem('user'); return null; }
  });

  const [token, setToken] = useState(() => localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  const login = async (username, password) => {
    const res = await api.login(username, password);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const register = async (username, password, email, division) => {
    const res = await api.register(username, password, email, division);
    return res.data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const value = { user, token, login, register, logout, isAuthenticated: !!token };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
