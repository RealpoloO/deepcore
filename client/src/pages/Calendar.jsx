import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import NavBar from '../components/NavBar';
import ErrorBanner from '../components/ErrorBanner';
import Toast from '../components/Toast';
import useOreInfo from '../hooks/useOreInfo';
import { useToast } from '../hooks/useToast';
import { formatLargeNumber } from '../utils/formatters';
import './Calendar.css';

function Calendar() {
  const { characters } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const { toast, showToast } = useToast();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // Fetch calendar data
  useEffect(() => {
    const fetchCalendarData = async () => {
      if (characters.length === 0) {
        setCalendarData({});
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await axios.get(`/api/mining/calendar/${year}/${month}`, {
          withCredentials: true
        });
        setCalendarData(response.data.days);
      } catch (err) {
        const errorMessage = `Erreur chargement calendrier: ${err.response?.data?.error || err.message}`;
        setError(errorMessage);
        console.error('Calendar fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCalendarData();
  }, [year, month, characters]);

  // Get all type IDs for selected day and month
  const selectedDayTypeIds = selectedDay && calendarData[selectedDay]
    ? calendarData[selectedDay].ores.map(ore => ore.type_id)
    : [];
  
  // Get all type IDs for the entire month
  const monthTypeIds = [...new Set(
    Object.values(calendarData).flatMap(day => day.ores.map(ore => ore.type_id))
  )];
  
  const { oreInfo } = useOreInfo([...selectedDayTypeIds, ...monthTypeIds]);

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Calendar generation
  const getDaysInMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    const day = new Date(year, month - 1, 1).getDay();
    return day === 0 ? 6 : day - 1; // Convert Sunday (0) to 6, Monday (1) to 0, etc.
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfMonth(year, month);

  // Generate calendar grid
  const calendarDays = [];
  
  // Add empty cells for days before the 1st
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(null);
  }
  
  // Add all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Format number with spaces
  const formatNumber = (num) => {
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  // Calculate month total
  const monthTotal = Object.values(calendarData).reduce((sum, day) => sum + day.total_volume, 0);

  // Aggregate ores for the entire month
  const getMonthOres = () => {
    const oresMap = {};
    Object.values(calendarData).forEach(day => {
      day.ores.forEach(ore => {
        if (!oresMap[ore.type_id]) {
          oresMap[ore.type_id] = 0;
        }
        oresMap[ore.type_id] += ore.quantity;
      });
    });
    return oresMap;
  };

  // Export to Janice format
  const exportToJanice = async () => {
    const monthOres = getMonthOres();
    
    if (Object.keys(monthOres).length === 0) {
      showToast('Aucun minerai à exporter pour ce mois', 'warning');
      return;
    }

    // Build export text
    let exportText = '';
    for (const [typeId, quantity] of Object.entries(monthOres)) {
      const oreName = oreInfo[typeId]?.name || `Type ${typeId}`;
      exportText += `${oreName}\t${Math.round(quantity)}\n`;
    }

    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(exportText.trim());
      showToast('Données copiées dans le presse-papier !', 'success');
    } catch (err) {
      console.error('Clipboard error:', err);
      showToast('Erreur lors de la copie', 'error');
    }
  };

  // Get heat map intensity (0-1)
  const getHeatMapIntensity = (volume) => {
    if (!volume || volume === 0) return 0;
    
    // Find max volume in current month
    const volumes = Object.values(calendarData).map(d => d.total_volume);
    const maxVolume = Math.max(...volumes, 1);
    
    return Math.min(volume / maxVolume, 1);
  };

  // Get heat map color class
  const getHeatMapClass = (intensity) => {
    if (intensity === 0) return '';
    if (intensity < 0.2) return 'heat-1';
    if (intensity < 0.4) return 'heat-2';
    if (intensity < 0.6) return 'heat-3';
    if (intensity < 0.8) return 'heat-4';
    return 'heat-5';
  };

  // Month name
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // Check if day is today
  const isToday = (day) => {
    const today = new Date();
    return day === today.getDate() && 
           month === today.getMonth() + 1 && 
           year === today.getFullYear();
  };

  return (
    <div className="app-container">
      <NavBar />
      <div className="content-container">
        <main className="main-content">
          {error && <ErrorBanner message={error} onClose={() => setError(null)} />}
          
          <div className="calendar-header">
            <h1>Calendrier de Minage</h1>
            <div className="calendar-controls">
              <button onClick={goToPreviousMonth} className="btn-nav">←</button>
              <button onClick={goToToday} className="btn-courant">Mois Courant</button>
              <button onClick={goToNextMonth} className="btn-nav">→</button>
            </div>
            <h2 className="calendar-month">{monthNames[month - 1]} {year}</h2>
            
            {/* Month summary */}
            {!loading && monthTotal > 0 && (
              <div className="month-summary">
                <div className="month-summary-content">
                  <div className="month-summary-info">
                    <span className="month-summary-icon">📊</span>
                    <span className="month-summary-label">Total du mois :</span>
                    <span className="month-summary-value">{formatLargeNumber(monthTotal)} m³</span>
                    <span className="month-summary-detail">({formatNumber(monthTotal)} m³)</span>
                  </div>
                  <button onClick={exportToJanice} className="btn-export-janice">
                    📋 Exporter vers Janice
                  </button>
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="loading">Chargement...</div>
          ) : (
            <div className="calendar-grid-container">
              <div className="calendar-grid">
                {/* Day headers */}
                {dayNames.map(day => (
                  <div key={day} className="calendar-day-header">
                    {day}
                  </div>
                ))}
                
                {/* Calendar days */}
                {calendarDays.map((day, index) => {
                  if (day === null) {
                    return <div key={`empty-${index}`} className="calendar-day empty" />;
                  }

                  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayData = calendarData[dateStr];
                  const volume = dayData ? dayData.total_volume : 0;
                  const intensity = getHeatMapIntensity(volume);
                  const heatClass = getHeatMapClass(intensity);
                  const today = isToday(day);

                  return (
                    <div
                      key={day}
                      className={`calendar-day ${heatClass} ${today ? 'today' : ''} ${volume > 0 ? 'has-data' : ''}`}
                      onClick={() => volume > 0 && setSelectedDay(dateStr)}
                    >
                      <div className="day-number">{day}</div>
                      {volume > 0 && (
                        <div className="day-volume">{formatNumber(volume)} m³</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Day detail modal */}
          {selectedDay && calendarData[selectedDay] && (
            <div className="modal-overlay" onClick={() => setSelectedDay(null)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Détail du {new Date(selectedDay + 'T12:00:00').toLocaleDateString('fr-FR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</h3>
                  <button className="modal-close" onClick={() => setSelectedDay(null)}>✕</button>
                </div>
                <div className="modal-body">
                  <div className="day-summary">
                    <h4>Total: {formatNumber(calendarData[selectedDay].total_volume)} m³</h4>
                  </div>
                  <table className="ore-detail-table">
                    <thead>
                      <tr>
                        <th>Minerai</th>
                        <th>Quantité</th>
                        <th>Volume (m³)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calendarData[selectedDay].ores.map((ore, index) => (
                        <tr key={index}>
                          <td>{oreInfo[ore.type_id]?.name || `Type ${ore.type_id}`}</td>
                          <td>{formatNumber(ore.quantity)}</td>
                          <td>{formatNumber(ore.volume)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {toast && (
        <Toast 
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default Calendar;
