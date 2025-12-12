import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import './App.css';

// Lazy load des pages principales
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Stats = lazy(() => import('./pages/Stats'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Production = lazy(() => import('./pages/Production'));
const Ware = lazy(() => import('./pages/Ware'));

function LoadingFallback() {
  return <div className="loading">Chargement de la page...</div>;
}

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div className="loading">Chargement...</div>;
  }
  
  return isAuthenticated ? children : <Navigate to="/" />;
}

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <div className="app">
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route 
                path="/dashboard" 
                element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/stats" 
                element={
                  <PrivateRoute>
                    <Stats />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/calendar" 
                element={
                  <PrivateRoute>
                    <Calendar />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/production" 
                element={
                  <PrivateRoute>
                    <Production />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/ware" 
                element={
                  <PrivateRoute>
                    <Ware />
                  </PrivateRoute>
                } 
              />
            </Routes>
          </Suspense>
        </div>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
