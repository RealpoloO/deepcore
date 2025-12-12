import './ErrorBanner.css';

function ErrorBanner({ error, onClose }) {
  if (!error) return null;

  return (
    <div className="error-banner">
      <div className="error-content">
        <span className="error-icon">⚠️</span>
        <div className="error-message">
          <strong>Erreur</strong>
          <p>{error}</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="error-close" aria-label="Fermer">
            ×
          </button>
        )}
      </div>
    </div>
  );
}

export default ErrorBanner;
