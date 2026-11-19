import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import DocumentDetails from './pages/DocumentDetails';
import AccessRequests from './pages/AccessRequests';
import SearchPage from './pages/SearchPage';
import MetadataAdmin from './pages/MetadataAdmin';

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="app">
      {isAuthenticated && <Navbar />}
      <main className={isAuthenticated ? 'main-content' : 'main-content-full'}>
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />} />
          <Route path="/register" element={isAuthenticated ? <Navigate to="/" /> : <RegisterPage />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/documents/:id" element={<ProtectedRoute><DocumentDetails /></ProtectedRoute>} />
          <Route path="/access-requests" element={<ProtectedRoute><AccessRequests /></ProtectedRoute>} />
          <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
          <Route path="/admin/metadata" element={<ProtectedRoute adminOnly><MetadataAdmin /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
