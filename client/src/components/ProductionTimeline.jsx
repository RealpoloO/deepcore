import './ProductionTimeline.css';

const ProductionTimeline = ({ productionPlan }) => {
  if (!productionPlan || !productionPlan.categoryTimings) {
    return null;
  }

  const { categoryTimings, totalProductionTimeDays } = productionPlan;

  // Filtrer les catégories qui ont des jobs
  const activeCategories = Object.entries(categoryTimings).filter(([_, timing]) => timing.jobCount > 0);

  if (activeCategories.length === 0) {
    return null;
  }

  // Catégories avec leurs noms affichables
  const categoryNames = {
    'intermediate_composite_reactions': 'Intermediate Composite Reactions',
    'composite_reactions': 'Composite Reactions',
    'biochemical_reactions': 'Biochemical Reactions',
    'hybrid_reactions': 'Hybrid Reactions',
    'construction_components': 'Construction Components',
    'advanced_components': 'Advanced Components',
    'capital_components': 'Capital Components',
    'end_product_jobs': 'End Product Jobs'
  };

  // Couleurs par type de catégorie
  const categoryColors = {
    'intermediate_composite_reactions': '#ff6b6b',
    'composite_reactions': '#4ecdc4',
    'biochemical_reactions': '#45b7d1',
    'hybrid_reactions': '#96ceb4',
    'construction_components': '#ffeaa7',
    'advanced_components': '#dfe6e9',
    'capital_components': '#a29bfe',
    'end_product_jobs': '#fd79a8'
  };

  return (
    <div className="production-timeline">
      <div className="timeline-header">
        <h3>Production Timeline</h3>
        <div className="timeline-summary">
          <span className="summary-item">
            <strong>Total Time:</strong> {totalProductionTimeDays.toFixed(2)} days
          </span>
        </div>
      </div>

      <div className="timeline-categories">
        {activeCategories.map(([category, timing]) => {
          const percentage = (timing.totalTimeDays / totalProductionTimeDays) * 100;
          const color = categoryColors[category] || '#95a5a6';

          return (
            <div key={category} className="timeline-category">
              <div className="category-info">
                <span className="category-name">{categoryNames[category] || category}</span>
                <div className="category-stats">
                  <span className="stat">{timing.jobCount} jobs</span>
                  <span className="stat">{timing.slotsUsed} slots</span>
                  <span className="stat">{timing.totalTimeDays.toFixed(2)} days</span>
                </div>
              </div>
              <div className="category-bar-container">
                <div
                  className="category-bar"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: color
                  }}
                >
                  <span className="bar-label">{percentage.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="timeline-legend">
        <p className="legend-note">
          💡 Les catégories peuvent s'exécuter en parallèle (réactions vs manufacturing)
        </p>
      </div>
    </div>
  );
};

export default ProductionTimeline;
