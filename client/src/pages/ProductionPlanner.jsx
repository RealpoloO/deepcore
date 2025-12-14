import { useReducer, useEffect, useMemo, useCallback } from 'react';
import NavBar from '../components/NavBar';
import ProductionTimeline from '../components/ProductionTimeline';
import { calculateProductionPlan } from '../services/productionPlannerService';
import '../styles/ProductionPlanner.css';

// ============================================
// CONSTANTS & VALIDATION
// ============================================
const MAX_QUANTITY = 1000000000; // 1 billion max
const MAX_JOBS = 1000;
const MAX_RUNS = 100000;
const MAX_ME = 10;
const MAX_TE = 20;

const validateQuantity = (value, max = MAX_QUANTITY) => {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 1 || num > max) {
    throw new Error(`Quantity must be between 1 and ${max.toLocaleString()}`);
  }
  return num;
};

const validateJob = (job) => {
  if (!job.product || typeof job.product !== 'string' || job.product.trim().length === 0) {
    throw new Error('Product name is required');
  }
  if (job.product.length > 200) {
    throw new Error('Product name too long (max 200 characters)');
  }
  validateQuantity(job.runs, MAX_RUNS);
  const me = parseInt(job.me, 10);
  const te = parseInt(job.te, 10);
  if (isNaN(me) || me < 0 || me > MAX_ME) {
    throw new Error(`ME must be between 0 and ${MAX_ME}`);
  }
  if (isNaN(te) || te < 0 || te > MAX_TE) {
    throw new Error(`TE must be between 0 and ${MAX_TE}`);
  }
};

// ============================================
// REDUCER
// ============================================
const initialState = {
  jobs: [],
  jobsText: '',
  stock: '',
  newJob: {
    product: '',
    runs: 1,
    me: 10,
    te: 20
  },
  activeResultTab: 'materials',
  productionPlan: null,
  loading: false,
  error: null,
  materialSort: 'none',
  producibleItems: [],
  showSuggestions: false,
  expandedCategories: {},
  isPlanExpanded: true,
  isTimelineExpanded: false
};

const actionTypes = {
  ADD_JOB: 'ADD_JOB',
  REMOVE_JOB: 'REMOVE_JOB',
  UPDATE_NEW_JOB: 'UPDATE_NEW_JOB',
  RESET_NEW_JOB: 'RESET_NEW_JOB',
  SET_JOBS_TEXT: 'SET_JOBS_TEXT',
  PARSE_JOBS_TEXT: 'PARSE_JOBS_TEXT',
  SET_STOCK: 'SET_STOCK',
  SET_ACTIVE_TAB: 'SET_ACTIVE_TAB',
  SET_PRODUCTION_PLAN: 'SET_PRODUCTION_PLAN',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_MATERIAL_SORT: 'SET_MATERIAL_SORT',
  SET_PRODUCIBLE_ITEMS: 'SET_PRODUCIBLE_ITEMS',
  TOGGLE_SUGGESTIONS: 'TOGGLE_SUGGESTIONS',
  TOGGLE_CATEGORY: 'TOGGLE_CATEGORY',
  TOGGLE_PLAN_EXPANDED: 'TOGGLE_PLAN_EXPANDED',
  TOGGLE_TIMELINE_EXPANDED: 'TOGGLE_TIMELINE_EXPANDED'
};

const reducer = (state, action) => {
  switch (action.type) {
    case actionTypes.ADD_JOB:
      if (state.jobs.length >= MAX_JOBS) {
        return { ...state, error: `Maximum ${MAX_JOBS} jobs allowed` };
      }
      return {
        ...state,
        jobs: [...state.jobs, action.payload],
        error: null
      };
    
    case actionTypes.REMOVE_JOB:
      return {
        ...state,
        jobs: state.jobs.filter(job => job.id !== action.payload)
      };
    
    case actionTypes.UPDATE_NEW_JOB:
      return {
        ...state,
        newJob: { ...state.newJob, ...action.payload }
      };
    
    case actionTypes.RESET_NEW_JOB:
      return {
        ...state,
        newJob: initialState.newJob
      };
    
    case actionTypes.SET_JOBS_TEXT:
      return { ...state, jobsText: action.payload };

    case actionTypes.PARSE_JOBS_TEXT:
      return { ...state, jobs: action.payload, jobsText: '' };
    
    case actionTypes.SET_STOCK:
      return {
        ...state,
        stock: action.payload
      };
    
    case actionTypes.SET_ACTIVE_TAB:
      return {
        ...state,
        activeResultTab: action.payload
      };
    
    case actionTypes.SET_PRODUCTION_PLAN:
      return {
        ...state,
        productionPlan: action.payload,
        loading: false,
        error: null
      };
    
    case actionTypes.SET_LOADING:
      return {
        ...state,
        loading: action.payload
      };
    
    case actionTypes.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        loading: false
      };
    
    case actionTypes.SET_MATERIAL_SORT:
      return {
        ...state,
        materialSort: action.payload
      };
    
    case actionTypes.SET_PRODUCIBLE_ITEMS:
      return {
        ...state,
        producibleItems: action.payload
      };
    
    case actionTypes.TOGGLE_SUGGESTIONS:
      return {
        ...state,
        showSuggestions: action.payload
      };
    
    case actionTypes.TOGGLE_CATEGORY:
      return {
        ...state,
        expandedCategories: {
          ...state.expandedCategories,
          [action.payload]: !state.expandedCategories[action.payload]
        }
      };
    
    case actionTypes.TOGGLE_PLAN_EXPANDED:
      return {
        ...state,
        isPlanExpanded: !state.isPlanExpanded
      };
    
    case actionTypes.TOGGLE_TIMELINE_EXPANDED:
      return {
        ...state,
        isTimelineExpanded: !state.isTimelineExpanded
      };
    
    default:
      return state;
  }
};

// ============================================
// COMPONENT
// ============================================
const ProductionPlanner = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    const fetchProducibleItems = async () => {
      try {
        const response = await fetch('/api/production-planner/producible-items');
        if (response.ok) {
          const items = await response.json();
          dispatch({ type: actionTypes.SET_PRODUCIBLE_ITEMS, payload: items });
        }
      } catch (err) {
        console.error('Error fetching producible items:', err);
      }
    };
    
    fetchProducibleItems();
  }, []);

  // ============================================
  // MEMOIZED VALUES
  // ============================================
  const filteredSuggestions = useMemo(() => {
    if (!state.newJob.product.trim()) return [];
    
    const searchTerm = state.newJob.product.toLowerCase();
    return state.producibleItems
      .filter(item => item.toLowerCase().includes(searchTerm))
      .slice(0, 15);
  }, [state.newJob.product, state.producibleItems]);

  const sortedMaterials = useMemo(() => {
    if (!state.productionPlan?.materials) return [];

    const materials = [...state.productionPlan.materials];

    switch (state.materialSort) {
      case 'name-asc':
        return materials.sort((a, b) => a.name.localeCompare(b.name));
      case 'name-desc':
        return materials.sort((a, b) => b.name.localeCompare(a.name));
      case 'qty-asc':
        return materials.sort((a, b) => a.quantity - b.quantity);
      case 'qty-desc':
        return materials.sort((a, b) => b.quantity - a.quantity);
      default:
        return materials;
    }
  }, [state.productionPlan?.materials, state.materialSort]);

  // ============================================
  // HANDLERS
  // ============================================
  const handleProductChange = useCallback((e) => {
    const value = e.target.value;
    dispatch({ type: actionTypes.UPDATE_NEW_JOB, payload: { product: value } });
    dispatch({ type: actionTypes.TOGGLE_SUGGESTIONS, payload: true });
  }, []);

  const handleSelectSuggestion = useCallback((item) => {
    dispatch({ type: actionTypes.UPDATE_NEW_JOB, payload: { product: item } });
    dispatch({ type: actionTypes.TOGGLE_SUGGESTIONS, payload: false });
  }, []);

  const handleAddJob = useCallback(() => {
    try {
      if (!state.newJob.product.trim()) {
        throw new Error('Product name is required');
      }

      validateJob(state.newJob);

      // Ajouter la ligne dans jobsText au format: Product runs me te
      const newLine = `${state.newJob.product.trim()} ${state.newJob.runs} ${state.newJob.me} ${state.newJob.te}`;
      const updatedText = state.jobsText ? `${state.jobsText}\n${newLine}` : newLine;
      
      dispatch({ type: actionTypes.SET_JOBS_TEXT, payload: updatedText });
      dispatch({ type: actionTypes.RESET_NEW_JOB });
    } catch (err) {
      dispatch({ type: actionTypes.SET_ERROR, payload: err.message });
      setTimeout(() => dispatch({ type: actionTypes.SET_ERROR, payload: null }), 5000);
    }
  }, [state.newJob, state.jobsText]);

  const handleRemoveJob = useCallback((jobId) => {
    dispatch({ type: actionTypes.REMOVE_JOB, payload: jobId });
  }, []);

  const parseJobsText = useCallback(() => {
    const lines = state.jobsText.split('\n').filter(line => line.trim());
    const parsedJobs = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      // Format: Product runs me te (séparés par espaces)
      // On accepte aussi: Product runs (avec me=10, te=20 par défaut)
      const parts = trimmedLine.split(/\s+/);
      
      if (parts.length < 2) return;

      // Le produit peut contenir plusieurs mots, donc on prend tout sauf les 3 derniers nombres
      let product, runs, me, te;
      
      if (parts.length === 2) {
        // Format: Product runs
        product = parts[0];
        runs = parseInt(parts[1], 10);
        me = 10;
        te = 20;
      } else if (parts.length === 3) {
        // Format: Product runs me
        product = parts[0];
        runs = parseInt(parts[1], 10);
        me = parseInt(parts[2], 10);
        te = 20;
      } else if (parts.length >= 4) {
        // Format: Product runs me te ou Product Name runs me te
        te = parseInt(parts[parts.length - 1], 10);
        me = parseInt(parts[parts.length - 2], 10);
        runs = parseInt(parts[parts.length - 3], 10);
        product = parts.slice(0, parts.length - 3).join(' ');
      }

      if (!product || isNaN(runs) || isNaN(me) || isNaN(te)) return;
      if (runs < 1 || runs > MAX_RUNS) return;
      if (me < 0 || me > MAX_ME) return;
      if (te < 0 || te > MAX_TE) return;

      parsedJobs.push({
        id: Date.now() + index,
        product,
        runs,
        me,
        te,
        display: `${product} ${runs} ${me} ${te}`
      });
    });

    return parsedJobs;
  }, [state.jobsText]);

  const handleCopyMaterials = useCallback(async () => {
    if (!state.productionPlan?.materials || state.productionPlan.materials.length === 0) {
      return;
    }

    const exportText = state.productionPlan.materials
      .map(item => `${item.name}\t${item.quantity}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(exportText);
      alert(`${state.productionPlan.materials.length} materials copied to clipboard`);
    } catch (err) {
      console.error('Clipboard error:', err);
      alert('Failed to copy to clipboard');
    }
  }, [state.productionPlan]);

  const handleCalculate = useCallback(async () => {
    const jobs = parseJobsText();
    if (jobs.length === 0) {
      dispatch({ type: actionTypes.SET_ERROR, payload: 'No valid jobs found' });
      setTimeout(() => dispatch({ type: actionTypes.SET_ERROR, payload: null }), 5000);
      return;
    }

    dispatch({ type: actionTypes.SET_LOADING, payload: true });
    dispatch({ type: actionTypes.SET_ERROR, payload: null });

    try {
      const savedConfig = localStorage.getItem('industry_config');
      const savedBlacklist = localStorage.getItem('production_blacklist');

      const config = savedConfig ? JSON.parse(savedConfig) : {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2
      };

      const blacklist = savedBlacklist ? JSON.parse(savedBlacklist) : {};
      config.blacklist = blacklist;

      const plan = await calculateProductionPlan(jobs, state.stock, config);
      dispatch({ type: actionTypes.SET_PRODUCTION_PLAN, payload: plan });
      console.log('Production plan calculated:', plan);
    } catch (err) {
      dispatch({ type: actionTypes.SET_ERROR, payload: err.message || 'Failed to calculate production plan' });
      console.error('Error calculating production plan:', err);
    }
  }, [state.jobsText, state.stock, parseJobsText]);

  const toggleCategory = useCallback((category) => {
    dispatch({ type: actionTypes.TOGGLE_CATEGORY, payload: category });
  }, []);

  // ============================================
  // RENDER
  // ============================================
  return (
    <>
      <NavBar />
      <div className="production-planner-container">
      <div className="planner-content">
        {/* Two Column Layout: Jobs Left, Stock Right */}
        <div className="planner-grid">
          {/* Job Input Section */}
          <div className="planner-section">
            {/* Jobs Text Area */}
            <div className="section-header">
              <h2>Jobs à produire</h2>
            </div>
            <textarea
              className="jobs-textarea"
              placeholder="Each line should be a separate job"
              value={state.jobsText}
              onChange={(e) => dispatch({ type: actionTypes.SET_JOBS_TEXT, payload: e.target.value })}
              rows={8}
            />

            <div className="section-header" style={{marginTop: '12px'}}>
              <h2>Produce</h2>
            </div>

            <div className="job-input-form job-input-compact">
              <div className="form-row">
                <div className="form-group autocomplete-group">
                  <label htmlFor="product">Product</label>
                  <div className="autocomplete-container">
                    <input
                      type="text"
                      id="product"
                      placeholder="e.g. Archon"
                      value={state.newJob.product}
                      onChange={handleProductChange}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddJob()}
                      onFocus={() => dispatch({ type: actionTypes.TOGGLE_SUGGESTIONS, payload: true })}
                      onBlur={() => setTimeout(() => dispatch({ type: actionTypes.TOGGLE_SUGGESTIONS, payload: false }), 150)}
                      autoComplete="off"
                    />
                    {state.showSuggestions && filteredSuggestions.length > 0 && (
                      <ul className="autocomplete-suggestions">
                        {filteredSuggestions.map((item, idx) => (
                          <li 
                            key={idx}
                            onClick={() => handleSelectSuggestion(item)}
                            className="autocomplete-item"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="form-group form-group-small">
                  <label htmlFor="runs">Runs</label>
                  <input
                    type="number"
                    id="runs"
                    min="1"
                    max={MAX_RUNS}
                    value={state.newJob.runs}
                    onChange={(e) => dispatch({ type: actionTypes.UPDATE_NEW_JOB, payload: { runs: parseInt(e.target.value) || 1 } })}
                  />
                </div>

                <div className="form-group form-group-small">
                  <label htmlFor="me">ME</label>
                  <input
                    type="number"
                    id="me"
                    min="0"
                    max={MAX_ME}
                    value={state.newJob.me}
                    onChange={(e) => dispatch({ type: actionTypes.UPDATE_NEW_JOB, payload: { me: parseInt(e.target.value) || 0 } })}
                  />
                </div>

                <div className="form-group form-group-small">
                  <label htmlFor="te">TE</label>
                  <input
                    type="number"
                    id="te"
                    min="0"
                    max={MAX_TE}
                    value={state.newJob.te}
                    onChange={(e) => dispatch({ type: actionTypes.UPDATE_NEW_JOB, payload: { te: parseInt(e.target.value) || 0 } })}
                  />
                </div>

                <button className="btn btn-primary add-job-btn" onClick={handleAddJob}>
                  Add Job
                </button>
              </div>
            </div>
          </div>

        {/* Stock Input Section */}
        <div className="planner-section">
          <div className="section-header">
            <h2>Stock Existant</h2>
          </div>
          <textarea
            className="stock-textarea"
            placeholder="Paste here you current stock of materials"
            value={state.stock}
            onChange={(e) => dispatch({ type: actionTypes.SET_STOCK, payload: e.target.value })}
            rows={8}
          />
        </div>
        </div>

        {/* Calculate Button */}
        <div className="calculate-section">
          <button
            className="btn-calculate"
            onClick={handleCalculate}
            disabled={!state.jobsText.trim() || state.loading}
          >
            {state.loading ? 'Calculating...' : 'Calculate Production Plan'}
          </button>
        </div>

        {/* Error Display */}
        {state.error && (
          <div className="planner-section error-section">
            <div className="error-message">
              <strong>Error:</strong> {state.error}
            </div>
          </div>
        )}

        {/* Critical Errors Display - Bloque l'affichage des résultats */}
        {state.productionPlan?.errors && state.productionPlan.errors.length > 0 && (
          <div className="planner-section error-section-critical">
            <div className="section-header error-header">
              <h2>❌ Erreurs critiques détectées</h2>
            </div>
            <div className="error-intro">
              <p><strong>Le calcul du plan de production ne peut pas continuer.</strong></p>
              <p>Veuillez corriger les erreurs suivantes avant de réessayer :</p>
            </div>
            <div className="errors-list">
              {state.productionPlan.errors.map((err, idx) => (
                <div key={idx} className="error-item-critical">
                  <div className="error-icon">🚫</div>
                  <div className="error-content">
                    <strong className="error-product">{err.product || 'Erreur'}</strong>
                    <p className="error-message">{err.error}</p>
                    {err.type && <span className="error-type">Type: {err.type}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="error-help">
              <h3>💡 Aide :</h3>
              <ul>
                <li><strong>Items sans blueprint :</strong> Seuls les produits fabriquables (avec blueprint) peuvent être ajoutés aux jobs. Les matériaux bruts (Tritanium, Pyerite, etc.) doivent être achetés, pas produits.</li>
                <li><strong>Items introuvables :</strong> Vérifiez l'orthographe exacte du nom du produit. Le nom doit correspondre exactement à celui dans EVE Online.</li>
                <li><strong>Erreurs de stock :</strong> Vérifiez le format de votre stock. Chaque ligne doit être : "Nom de l'item  Quantité"</li>
              </ul>
            </div>
          </div>
        )}

        {/* Production Plan Results - Afficher SEULEMENT si pas d'erreurs critiques */}
        {(!state.productionPlan?.errors || state.productionPlan.errors.length === 0) && (
          <div className="planner-section production-plan-section">
            <div
              className="section-header clickable-header"
              onClick={() => dispatch({ type: actionTypes.TOGGLE_PLAN_EXPANDED })}
            >
              <div className="header-left">
                <span className="expand-icon">{state.isPlanExpanded ? '▼' : '▶'}</span>
                <h2>Production Plan</h2>
              </div>
            </div>

            {state.isPlanExpanded && (
            <>
              {/* Timeline visualization - Collapsible */}
              {state.productionPlan && state.productionPlan.categoryTimings && (
                <div className="timeline-section">
                  <div 
                    className="timeline-header clickable"
                    onClick={() => dispatch({ type: actionTypes.TOGGLE_TIMELINE_EXPANDED })}
                  >
                    <span className="expand-icon-small">{state.isTimelineExpanded ? '▼' : '▶'}</span>
                    <span className="timeline-title">Production Timeline</span>
                  </div>
                  {state.isTimelineExpanded && (
                    <ProductionTimeline productionPlan={state.productionPlan} />
                  )}
                </div>
              )}

              <div className="result-tabs">
            <button
              className={`tab-btn ${state.activeResultTab === 'materials' ? 'active' : ''}`}
              onClick={() => dispatch({ type: actionTypes.SET_ACTIVE_TAB, payload: 'materials' })}
            >
              Stocks and Materials
            </button>
            <button
              className={`tab-btn ${state.activeResultTab === 'jobs' ? 'active' : ''}`}
              onClick={() => dispatch({ type: actionTypes.SET_ACTIVE_TAB, payload: 'jobs' })}
            >
              Jobs to Run
            </button>
          </div>

          <div className="result-content">
            {state.loading ? (
              <div className="loading-state">
                <p>Calculating production plan...</p>
              </div>
            ) : state.activeResultTab === 'materials' ? (
              <div className="materials-view">
                {state.productionPlan && sortedMaterials.length > 0 ? (
                  <div className="materials-list">
                    <div className="materials-header">
                      <div className="materials-summary">
                        <span><strong>Total Materials:</strong> {state.productionPlan.totalMaterials} types</span>
                        {state.productionPlan.totalProductionTimeDays && (
                          <span><strong>Production Time:</strong> {state.productionPlan.totalProductionTimeDays.toFixed(2)} days</span>
                        )}
                      </div>
                      <div className="materials-controls">
                        <div className="sort-buttons">
                          <button 
                            className={`btn-sort ${state.materialSort.startsWith('name') ? 'active' : ''}`}
                            onClick={() => dispatch({ 
                              type: actionTypes.SET_MATERIAL_SORT, 
                              payload: state.materialSort === 'name-asc' ? 'name-desc' : 'name-asc' 
                            })}
                            title="Sort by name"
                          >
                            📝 Name {state.materialSort === 'name-asc' ? '↑' : state.materialSort === 'name-desc' ? '↓' : ''}
                          </button>
                          <button 
                            className={`btn-sort ${state.materialSort.startsWith('qty') ? 'active' : ''}`}
                            onClick={() => dispatch({ 
                              type: actionTypes.SET_MATERIAL_SORT, 
                              payload: state.materialSort === 'qty-asc' ? 'qty-desc' : 'qty-asc' 
                            })}
                            title="Sort by quantity"
                          >
                            🔢 Qty {state.materialSort === 'qty-asc' ? '↑' : state.materialSort === 'qty-desc' ? '↓' : ''}
                          </button>
                        </div>
                        <button className="btn-copy" onClick={handleCopyMaterials}>
                          📋 Copy to Clipboard
                        </button>
                      </div>
                    </div>
                    <div className="materials-compact-list">
                      {sortedMaterials.map((material) => (
                        <div key={material.typeID} className="material-row">
                          <img 
                            src={`https://images.evetech.net/types/${material.typeID}/icon?size=32`}
                            alt={material.name}
                            className="material-icon"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.paddingLeft = '0';
                            }}
                          />
                          <span className="material-name">{material.name}</span>
                          <span className="material-quantity">{material.quantity.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="empty-state">
                    Calculez un plan de production pour voir les matériaux nécessaires
                  </p>
                )}
              </div>
            ) : (
              <div className="jobs-view">
                {state.productionPlan && state.productionPlan.jobs ? (
                  <div className="jobs-list">
                    <div className="jobs-summary">
                      <p><strong>Total Jobs:</strong> {state.productionPlan.totalJobs}</p>
                    </div>

                    {Object.entries(state.productionPlan.jobs).map(([category, categoryJobs]) => {
                      if (categoryJobs.length === 0) return null;

                      const categoryName = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                      const timing = state.productionPlan.categoryTimings?.[category];
                      const isExpanded = state.expandedCategories[category];

                      return (
                        <div key={category} className="job-category">
                          <div 
                            className="category-header clickable"
                            onClick={() => toggleCategory(category)}
                          >
                            <div className="category-header-left">
                              <span className="category-expand-icon">{isExpanded ? '▼' : '▶'}</span>
                              <h3 className="category-title">{categoryName}</h3>
                            </div>
                            {timing && (
                              <span className="category-timing">
                                {categoryJobs.length} jobs • {timing.totalTimeDays.toFixed(2)} days • {timing.slotsUsed} slots
                              </span>
                            )}
                          </div>
                          {isExpanded && (
                            <div className="jobs-table">
                              <div className="jobs-table-header">
                                <div className="job-col-icon"></div>
                                <div className="job-col-name">Product Name</div>
                                <div className="job-col-runs">Runs</div>
                                <div className="job-col-qty">Quantity</div>
                                <div className="job-col-time">Time</div>
                                <div className="job-col-split">Split</div>
                              </div>
                              <div className="jobs-table-body">
                                {categoryJobs.map((job) => (
                                  <div key={`${job.productTypeID}-${job.runs}-${job.splitIndex || 0}`} className="job-table-row">
                                    <div className="job-col-icon">
                                      <img 
                                        src={`https://images.evetech.net/types/${job.productTypeID}/icon?size=32`}
                                        alt={job.productName}
                                        className="job-icon"
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                        }}
                                      />
                                    </div>
                                    <div className="job-col-name">{job.productName}</div>
                                    <div className="job-col-runs">{job.runs}</div>
                                    <div className="job-col-qty">{job.quantityProduced.toLocaleString()}</div>
                                    <div className="job-col-time">{job.productionTimeDays.toFixed(2)}d</div>
                                    <div className="job-col-split">{job.splitFrom ? `[${job.splitIndex}/${job.splitFrom}]` : '-'}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="empty-state">
                    Calculez un plan de production pour voir les jobs à lancer
                  </p>
                )}
              </div>
            )}
          </div>
          </>
            )}
          </div>
        )}
      </div>
    </div>
  </>
  );
};

export default ProductionPlanner;
