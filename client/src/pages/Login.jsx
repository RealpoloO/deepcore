import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="logo">
          <div className="logo-icon">⛏️</div>
          <h1>WhatDidIMine</h1>
        </div>
        
        <p className="tagline">
          Suivez votre minage Eve Online sur tous vos personnages
        </p>

        <button className="eve-login-btn" onClick={login}>
          <span className="eve-logo">E</span>
          Se connecter avec Eve Online
        </button>

        <div className="features">
          <div className="feature">
            <span className="feature-icon">👥</span>
            <span>Multi-personnages</span>
          </div>
          <div className="feature">
            <span className="feature-icon">📊</span>
            <span>Statistiques détaillées</span>
          </div>
          <div className="feature">
            <span className="feature-icon">🔒</span>
            <span>Connexion sécurisée</span>
          </div>
        </div>

        <p className="info">
          Utilise l'API officielle Eve Online (ESI) pour récupérer vos données de minage
        </p>
      </div>
    </div>
  );
}

export default Login;
