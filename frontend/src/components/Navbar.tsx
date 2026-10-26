import React from 'react';
import { Camera, Database, BarChart2, Activity, Sun, Moon, Sparkles, Box, Volume2 } from 'lucide-react';

interface NavbarProps {
  activeTab: 'live' | 'dataset' | 'evaluation';
  setActiveTab: (tab: 'live' | 'dataset' | 'evaluation') => void;
  theme?: 'dark' | 'light';
  toggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, theme = 'dark', toggleTheme }) => {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Activity color="#2563eb" size={28} />
        <span>ISL Recognition Research System</span>
      </div>
      <div className="navbar-links">
        <button
          className={`nav-link ${activeTab === 'live' ? 'active' : ''}`}
          onClick={() => setActiveTab('live')}
        >
          <Camera size={18} style={{ display: 'inline', marginRight: '6px' }} />
          Live Recognition
        </button>
        <button
          className={`nav-link ${activeTab === 'dataset' ? 'active' : ''}`}
          onClick={() => setActiveTab('dataset')}
        >
          <Database size={18} style={{ display: 'inline', marginRight: '6px' }} />
          Dataset Collector
        </button>
        <button
          className={`nav-link ${activeTab === 'evaluation' ? 'active' : ''}`}
          onClick={() => setActiveTab('evaluation')}
        >
          <BarChart2 size={18} style={{ display: 'inline', marginRight: '6px' }} />
          Model Evaluation
        </button>

        {toggleTheme && (
          <button
            className="btn"
            onClick={toggleTheme}
            style={{
              padding: '6px 12px',
              fontSize: '0.85rem',
              backgroundColor: 'var(--bg-dark)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
            }}
          >
            {theme === 'dark' ? <Sun size={16} color="#f59e0b" /> : <Moon size={16} color="#3b82f6" />}
            {theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
          </button>
        )}
      </div>
    </nav>
  );
};
