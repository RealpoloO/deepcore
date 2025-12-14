import { useState, useEffect } from 'react';
import NavBar from '../components/NavBar';
import '../styles/IndustryConfig.css';

const IndustryConfig = () => {
  const [config, setConfig] = useState({
    reactionSlots: 20,
    manufacturingSlots: 30,
    dontSplitShorterThan: 1.2
  });

  const [blacklist, setBlacklist] = useState({
    fuelBlocks: true,
    intermediateCompositeReactions: true,
    compositeReactions: true,
    biochemicalReactions: true,
    gasPhaseReactions: true,
    hybridReactions: true,
    capitalComponents: true,
    advancedComponents: true,
    customItems: ''
  });

  // Load config from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('industry_config');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }

    const savedBlacklist = localStorage.getItem('production_blacklist');
    if (savedBlacklist) {
      setBlacklist(JSON.parse(savedBlacklist));
    }
  }, []);

  const handleConfigChange = (field, value) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    localStorage.setItem('industry_config', JSON.stringify(newConfig));
  };

  const handleBlacklistChange = (field, value) => {
    const newBlacklist = { ...blacklist, [field]: value };
    setBlacklist(newBlacklist);
    localStorage.setItem('production_blacklist', JSON.stringify(newBlacklist));
  };

  const handleSave = () => {
    // Already saved in localStorage on each change
    alert('Configuration saved successfully!');
  };

  const handleReset = () => {
    if (window.confirm('Reset all settings to default values?')) {
      const defaultConfig = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2
      };
      const defaultBlacklist = {
        fuelBlocks: true,
        intermediateCompositeReactions: true,
        compositeReactions: true,
        biochemicalReactions: true,
        gasPhaseReactions: true,
        hybridReactions: true,
        capitalComponents: true,
        advancedComponents: true,
        customItems: ''
      };

      setConfig(defaultConfig);
      setBlacklist(defaultBlacklist);
      localStorage.setItem('industry_config', JSON.stringify(defaultConfig));
      localStorage.setItem('production_blacklist', JSON.stringify(defaultBlacklist));
    }
  };

  return (
    <>
      <NavBar />
      <div className="industry-config-container">
        <div className="config-header">
          <h1>Industry Configuration</h1>
        <p className="config-subtitle">
          Configurez vos paramètres de production pour optimiser la planification
        </p>
      </div>

      <div className="config-content">
        {/* Production Slots Section */}
        <div className="config-section">
          <div className="section-header">
            <h2>Production Slots</h2>
            <p className="section-description">
              Définissez le nombre de slots disponibles pour vos activités de production
            </p>
          </div>

          <div className="config-form">
            <div className="form-group">
              <label htmlFor="reactionSlots">
                Reaction Slots
                <span className="label-hint">Nombre de slots de réaction disponibles</span>
              </label>
              <input
                type="number"
                id="reactionSlots"
                min="1"
                max="100"
                value={config.reactionSlots}
                onChange={(e) => handleConfigChange('reactionSlots', parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="manufacturingSlots">
                Manufacturing Slots
                <span className="label-hint">Nombre de slots de manufacturing disponibles</span>
              </label>
              <input
                type="number"
                id="manufacturingSlots"
                min="1"
                max="100"
                value={config.manufacturingSlots}
                onChange={(e) => handleConfigChange('manufacturingSlots', parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="dontSplitShorterThan">
                Don't Split Jobs Shorter Than (days)
                <span className="label-hint">
                  Ne pas diviser les jobs dont la durée est inférieure à cette valeur
                </span>
              </label>
              <input
                type="number"
                id="dontSplitShorterThan"
                min="0"
                max="30"
                step="0.1"
                value={config.dontSplitShorterThan}
                onChange={(e) => handleConfigChange('dontSplitShorterThan', parseFloat(e.target.value) || 0)}
              />
              <p className="input-hint">
                Les jobs plus longs seront divisés en plusieurs runs parallèles pour optimiser le temps
              </p>
            </div>
          </div>
        </div>

        {/* Production Blacklist Section */}
        <div className="config-section">
          <div className="section-header">
            <h2>Production Blacklist</h2>
            <p className="section-description">
              Sélectionnez les items que vous préférez acheter plutôt que produire
            </p>
          </div>

          <div className="blacklist-form">
            <div className="blacklist-categories">
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={blacklist.fuelBlocks}
                    onChange={(e) => handleBlacklistChange('fuelBlocks', e.target.checked)}
                  />
                  <span className="checkbox-text">Fuel Blocks</span>
                </label>
              </div>

              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={blacklist.intermediateCompositeReactions}
                    onChange={(e) => handleBlacklistChange('intermediateCompositeReactions', e.target.checked)}
                  />
                  <span className="checkbox-text">Intermediate Composite Reactions</span>
                </label>
              </div>

              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={blacklist.compositeReactions}
                    onChange={(e) => handleBlacklistChange('compositeReactions', e.target.checked)}
                  />
                  <span className="checkbox-text">Composite Reactions</span>
                </label>
              </div>

              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={blacklist.biochemicalReactions}
                    onChange={(e) => handleBlacklistChange('biochemicalReactions', e.target.checked)}
                  />
                  <span className="checkbox-text">Biochemical Reactions</span>
                </label>
              </div>

              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={blacklist.gasPhaseReactions}
                    onChange={(e) => handleBlacklistChange('gasPhaseReactions', e.target.checked)}
                  />
                  <span className="checkbox-text">Gas-Phase Reactions</span>
                </label>
              </div>

              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={blacklist.hybridReactions}
                    onChange={(e) => handleBlacklistChange('hybridReactions', e.target.checked)}
                  />
                  <span className="checkbox-text">Hybrid Reactions</span>
                </label>
              </div>

              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={blacklist.capitalComponents}
                    onChange={(e) => handleBlacklistChange('capitalComponents', e.target.checked)}
                  />
                  <span className="checkbox-text">Capital Components</span>
                </label>
              </div>

              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={blacklist.advancedComponents}
                    onChange={(e) => handleBlacklistChange('advancedComponents', e.target.checked)}
                  />
                  <span className="checkbox-text">Advanced Components</span>
                </label>
              </div>
            </div>

            <div className="custom-blacklist">
              <label htmlFor="customItems">
                Custom Blacklist Items
                <span className="label-hint">Ajoutez des items personnalisés (un par ligne)</span>
              </label>
              <textarea
                id="customItems"
                className="custom-items-textarea"
                placeholder="e.g. Tritanium&#10;Pyerite&#10;Mexallon"
                value={blacklist.customItems}
                onChange={(e) => handleBlacklistChange('customItems', e.target.value)}
                rows={6}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="config-actions">
          <button className="btn btn-secondary" onClick={handleReset}>
            Reset to Default
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save Configuration
          </button>
        </div>
      </div>
    </div>
    </>
  );
};

export default IndustryConfig;
