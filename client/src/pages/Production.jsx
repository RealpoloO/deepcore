import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import NavBar from '../components/NavBar';
import ErrorBanner from '../components/ErrorBanner';
import Toast from '../components/Toast';
import EmptyState from '../components/EmptyState';
import { useToast } from '../hooks/useToast';
import './Production.css';

function Production() {
  const { characters } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast, showToast } = useToast();
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [activeFilter, setActiveFilter] = useState('all');

  // Update current time every second for countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fetch jobs from database
  const loadJobs = async () => {
    if (characters.length === 0) {
      setJobs([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get('/api/industry/jobs', {
        withCredentials: true
      });
      setJobs(response.data.jobs);
    } catch (err) {
      const errorMessage = `Erreur chargement jobs: ${err.response?.data?.error || err.message}`;
      setError(errorMessage);
      console.error('Jobs fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle alert for a job
  const toggleAlert = async (jobId, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      await axios.post(`/api/industry/jobs/${jobId}/alert`, { enabled: newStatus }, { withCredentials: true });
      
      // Update local state
      setJobs(prevJobs => 
        prevJobs.map(job => 
          job.job_id === jobId ? { ...job, alert_enabled: newStatus ? 1 : 0 } : job
        )
      );

      showToast(newStatus ? '🔔 Alerte activée' : '🔕 Alerte désactivée', 'success');
    } catch (error) {
      console.error('Error toggling alert:', error);
      showToast('Erreur lors de la modification de l\'alerte', 'error');
    }
  };

  // Load jobs on mount
  useEffect(() => {
    loadJobs();
  }, [characters.length]);

  // Format activity type
  const getActivityName = (activityId) => {
    const activities = {
      1: 'Manufacturing',
      3: 'Researching Time Efficiency',
      4: 'Researching Material Efficiency',
      5: 'Copying',
      8: 'Invention',
      9: 'Reactions'
    };
    return activities[activityId] || `Activity ${activityId}`;
  };

  // Get activity icon
  const getActivityIcon = (activityId) => {
    const icons = {
      1: '🏭',
      3: '⏱️',
      4: '🔬',
      5: '📄',
      8: '💡',
      9: '⚗️'
    };
    return icons[activityId] || '🔧';
  };

  // Format time remaining
  const formatTimeRemaining = (endDate) => {
    const end = new Date(endDate).getTime();
    const remaining = Math.max(0, end - currentTime);

    if (remaining === 0) return 'Terminé';

    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    if (days > 0) return `${days}j ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  // Get progress percentage
  const getProgress = (startDate, endDate) => {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const total = end - start;
    const elapsed = currentTime - start;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  };

  // Check if job is completed
  const isCompleted = (endDate) => {
    return new Date(endDate).getTime() <= currentTime;
  };

  // Get status color
  const getStatusColor = (endDate) => {
    const remaining = new Date(endDate).getTime() - currentTime;
    if (remaining <= 0) return 'completed';
    if (remaining < 3600000) return 'ending-soon'; // < 1 hour
    return 'active';
  };

  // Get activity type from job
  const getJobActivityType = (activityId) => {
    if (activityId === 9) return 'reactions';
    if ([3, 4, 5].includes(activityId)) return 'research';
    if (activityId === 1) return 'manufacturing';
    return 'other';
  };

  // Filter jobs based on active filter
  const filteredJobs = activeFilter === 'all' 
    ? jobs 
    : jobs.filter(job => getJobActivityType(job.activity_id) === activeFilter);

  // Sort by end date
  const sortedJobs = [...filteredJobs].sort((a, b) => new Date(a.end_date) - new Date(b.end_date));

  // Count jobs by type
  const jobCounts = {
    all: jobs.length,
    reactions: jobs.filter(j => getJobActivityType(j.activity_id) === 'reactions').length,
    research: jobs.filter(j => getJobActivityType(j.activity_id) === 'research').length,
    manufacturing: jobs.filter(j => getJobActivityType(j.activity_id) === 'manufacturing').length
  };

  return (
    <div className="app-container">
      <NavBar />
      <div className="content-container">
        <main className="main-content">
          {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

          {loading && jobs.length === 0 ? (
            <div className="loading">Chargement des jobs...</div>
          ) : jobs.length === 0 ? (
            <EmptyState 
              icon="🏭"
              title="Aucun job d'industrie en cours"
              description="Lancez des jobs d'industrie dans Eve Online pour les voir apparaître ici."
            />
          ) : (
            <>
              <div className="job-type-tabs">
                <button 
                  className={`tab-btn ${activeFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('all')}
                >
                  <span className="tab-label">Tous</span>
                  <span className="tab-count">{jobCounts.all}</span>
                </button>
                <button 
                  className={`tab-btn tab-reactions ${activeFilter === 'reactions' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('reactions')}
                  disabled={jobCounts.reactions === 0}
                >
                  <span className="tab-label">Reactions</span>
                  <span className="tab-count">{jobCounts.reactions}</span>
                </button>
                <button 
                  className={`tab-btn tab-research ${activeFilter === 'research' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('research')}
                  disabled={jobCounts.research === 0}
                >
                  <span className="tab-label">Copying / Research</span>
                  <span className="tab-count">{jobCounts.research}</span>
                </button>
                <button 
                  className={`tab-btn tab-manufacturing ${activeFilter === 'manufacturing' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('manufacturing')}
                  disabled={jobCounts.manufacturing === 0}
                >
                  <span className="tab-label">Manufacturing</span>
                  <span className="tab-count">{jobCounts.manufacturing}</span>
                </button>
              </div>

              <div className="jobs-container">
                {sortedJobs.map(job => {
                  const progress = getProgress(job.start_date, job.end_date);
                  const statusColor = getStatusColor(job.end_date);
                  const completed = isCompleted(job.end_date);

                  const activityClass = (() => {
                    if (job.activity_id === 9) return 'activity-reactions';
                    if ([3, 4, 5].includes(job.activity_id)) return 'activity-research';
                    if (job.activity_id === 1) return 'activity-manufacturing';
                    return '';
                  })();

                  return (
                    <div key={job.job_id} className={`job-item ${statusColor} ${activityClass}`}>
                      <div className="job-header">
                        <div className="job-character">
                          <img 
                            src={`https://images.evetech.net/characters/${job.character_id}/portrait?size=32`}
                            alt={job.character_name}
                            className="job-avatar"
                          />
                          <span className="job-character-name">{job.character_name}</span>
                        </div>
                        <div className="job-info">
                          <div className="job-product-name">{job.product_name}</div>
                          <div className="job-runs">Runs: {job.runs}</div>
                        </div>
                        <div className="job-time">
                          {completed ? (
                            <span className="job-completed">✅ Terminé</span>
                          ) : (
                            <span className="job-remaining">{formatTimeRemaining(job.end_date)}</span>
                          )}
                        </div>
                        {!completed && (
                          <button 
                            className={`job-alert-btn ${job.alert_enabled ? 'active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); toggleAlert(job.job_id, job.alert_enabled); }}
                            title={job.alert_enabled ? 'Désactiver l\'alerte' : 'Activer l\'alerte Discord'}
                          >
                            {job.alert_enabled ? '🔔' : '🔕'}
                          </button>
                        )}
                      </div>
                      {!completed && (
                        <div className="job-progress-bar">
                          <div 
                            className="job-progress-fill" 
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
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

export default Production;
