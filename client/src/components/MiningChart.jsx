import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import './MiningChart.css';

/**
 * Composant graphique pour afficher l'historique de minage
 * @param {Object} props
 * @param {Array<{date: string, volume: number}>} props.data - Données de minage par date
 * @param {string} props.title - Titre du graphique
 * @param {string} props.color - Couleur du graphique (hex)
 */
function MiningChart({ data, title = 'Volume de Minage', color = '#8884d8' }) {
  if (!data || data.length === 0) {
    return (
      <div className="mining-chart-empty">
        <p>Aucune donnée de minage à afficher</p>
      </div>
    );
  }

  /**
   * Formatte le volume pour l'affichage (en m³)
   */
  const formatVolume = (value) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M m³`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K m³`;
    }
    return `${value.toFixed(0)} m³`;
  };

  /**
   * Formatte la date pour l'affichage
   */
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short'
    });
  };

  /**
   * Tooltip personnalisé pour afficher les détails
   */
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="mining-chart-tooltip">
          <p className="label">{formatDate(data.date)}</p>
          <p className="value">{formatVolume(data.volume)}</p>
          {data.oreCount && (
            <p className="detail">{data.oreCount} type(s) de minerai</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="mining-chart-container">
      <h3 className="mining-chart-title">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.8} />
              <stop offset="95%" stopColor={color} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={formatVolume}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Area
            type="monotone"
            dataKey="volume"
            stroke={color}
            fillOpacity={1}
            fill="url(#colorVolume)"
            name="Volume miné"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default MiningChart;
