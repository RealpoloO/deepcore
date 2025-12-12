import './ConfirmDialog.css';

function ConfirmDialog({ open = true, title, message, onConfirm, onCancel, confirmText = 'Confirmer', cancelText = 'Annuler' }) {
  if (!open) return null;

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-header">
          <span className="confirm-icon">⚠️</span>
          <h3>{title}</h3>
        </div>
        
        {message && <p className="confirm-message">{message}</p>}
        
        <div className="confirm-actions">
          <button onClick={onCancel} className="confirm-btn cancel-btn">
            {cancelText}
          </button>
          <button onClick={onConfirm} className="confirm-btn confirm-btn-primary">
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
