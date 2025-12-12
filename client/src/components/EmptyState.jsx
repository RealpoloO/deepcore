import './EmptyState.css';

const EmptyState = ({ 
  icon = '📭', 
  title = 'Aucune donnée disponible', 
  description = 'Il n\'y a rien à afficher pour le moment.',
  actionText,
  onAction 
}) => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {actionText && onAction && (
        <button className="empty-state-action" onClick={onAction}>
          {actionText}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
