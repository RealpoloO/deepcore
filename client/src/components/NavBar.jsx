import { useState, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import './NavBar.css';

function NavBar() {
  const { logout } = useAuth();
  const [openDropdown, setOpenDropdown] = useState(null);
  const closeTimeoutRef = useRef(null);

  const openMenu = (menu) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setOpenDropdown(menu);
  };

  const closeMenu = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setOpenDropdown(null);
    }, 300);
  };

  const cancelClose = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <span className="navbar-logo">⛏️</span>
          <h1 className="navbar-title">WhatDidIMine</h1>
        </div>

        <div className="navbar-links">
          {/* Mining Dropdown */}
          <div 
            className="nav-dropdown"
            onMouseEnter={() => openMenu('mining')}
            onMouseLeave={closeMenu}
          >
            <button className="nav-dropdown-btn">
              Mining
            </button>
            {openDropdown === 'mining' && (
              <div 
                className="dropdown-menu"
                onMouseEnter={cancelClose}
                onMouseLeave={closeMenu}
              >
                <div className="dropdown-menu-content">
                  <NavLink 
                    to="/stats" 
                    className="dropdown-item"
                    onClick={() => setOpenDropdown(null)}
                  >
                    Statistiques
                  </NavLink>
                  <NavLink 
                    to="/calendar" 
                    className="dropdown-item"
                    onClick={() => setOpenDropdown(null)}
                  >
                    Calendrier
                  </NavLink>
                </div>
              </div>
            )}
          </div>

          {/* Market Dropdown */}
          <div 
            className="nav-dropdown"
            onMouseEnter={() => openMenu('market')}
            onMouseLeave={closeMenu}
          >
            <button className="nav-dropdown-btn">
              Market
            </button>
            {openDropdown === 'market' && (
              <div 
                className="dropdown-menu"
                onMouseEnter={cancelClose}
                onMouseLeave={closeMenu}
              >
                <div className="dropdown-menu-content">
                  <NavLink 
                    to="/ware" 
                    className="dropdown-item"
                    onClick={() => setOpenDropdown(null)}
                  >
                    Market Comparison
                  </NavLink>
                </div>
              </div>
            )}
          </div>

          {/* Prod Dropdown */}
          <div 
            className="nav-dropdown"
            onMouseEnter={() => openMenu('prod')}
            onMouseLeave={closeMenu}
          >
            <button className="nav-dropdown-btn">
              Prod
            </button>
            {openDropdown === 'prod' && (
              <div 
                className="dropdown-menu"
                onMouseEnter={cancelClose}
                onMouseLeave={closeMenu}
              >
                <div className="dropdown-menu-content">
                  <NavLink 
                    to="/production" 
                    className="dropdown-item"
                    onClick={() => setOpenDropdown(null)}
                  >
                    Job Count
                  </NavLink>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="navbar-actions">
          <NavLink 
            to="/dashboard" 
            className="settings-icon"
            title="Gestion de compte"
          >
            <span className="settings-emoji">⚙️</span>
          </NavLink>
          <ThemeToggle />
          <button onClick={logout} className="logout-button">
            <span className="logout-icon">🚪</span>
            Déconnexion
          </button>
        </div>
      </div>
    </nav>
  );
}

export default NavBar;
