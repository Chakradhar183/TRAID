import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">📄 Traid DMS</Link>
      </div>
      <div className="navbar-links">
        <Link to="/">Dashboard</Link>
        <Link to="/search">Search</Link>
        <Link to="/access-requests">Access Requests</Link>
        {user?.role === 'admin' && <Link to="/admin/metadata">Admin</Link>}
      </div>
      <div className="navbar-user">
        <span className="user-badge">{user?.username} ({user?.division})</span>
        <button className="btn btn-outline" onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  );
}
