import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';
import './OreDistributionChart.css';

/**
 * Composant graphique en donut pour afficher la distribution des minerais
 * @param {Object} props
 * @param {Array<{name: string, value: number, volume: number}>} props.data - Données par type de minerai
 * @param {string} props.title - Titre du graphique
 */
function OreDistributionChart({ data, title = 'Répartition par Minerai' }) {
  if (!data || data.length === 0) {
    return (
      <div className="ore-chart-empty">
        <p>Aucune donnée à afficher</p>
      </div>
    );
  }

  // Palette de couleurs pour les différents minerais
  const COLORS = [
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
    '#82CA9D', '#FFC658', '#FF6B9D', '#C2C2F0', '#8DD1E1',
    '#A4DE6C', '#D0ED57', '#FFD8A8', '#FFEAA7', '#DFE6E9'
  ];

  /**
   * Formatte le volume pour l'affichage
   */
  const formatVolume = (value) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M m³`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K m³`;
    }
    return `${value.toFixed(0)} m³`;
  };

  /**
   * Calcule le pourcentage
   */
  const calculatePercentage = (value, total) => {
    return ((value / total) * 100).toFixed(1);
  };

  const totalVolume = data.reduce((sum, item) => sum + item.value, 0);

  /**
   * Tooltip personnalisé
   */
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const percentage = calculatePercentage(item.value, totalVolume);

      return (
        <div className="ore-chart-tooltip">
          <p className="label">{item.name}</p>
          <p className="value">{formatVolume(item.value)}</p>
          <p className="percentage">{percentage}%</p>
        </div>
      );
    }
    return null;
  };

  /**
   * Label personnalisé pour le graphique
   */
  const renderLabel = (entry) => {
    const percentage = calculatePercentage(entry.value, totalVolume);
    return percentage > 5 ? `${percentage}%` : ''; // N'afficher que si > 5%
  };

  return (
    <div className="ore-chart-container">
      <h3 className="ore-chart-title">{title}</h3>
      <div className="ore-chart-content">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderLabel}
              outerRadius={100}
              innerRadius={60}
              fill="#8884d8"
              dataKey="value"
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value, entry) => {
                const percentage = calculatePercentage(entry.payload.value, totalVolume);
                return `${value} (${percentage}%)`;
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="ore-chart-summary">
          <div className="summary-item">
            <span className="summary-label">Volume Total</span>
            <span className="summary-value">{formatVolume(totalVolume)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Types de Minerai</span>
            <span className="summary-value">{data.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OreDistributionChart;
