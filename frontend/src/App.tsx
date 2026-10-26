import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LiveRecognition } from './pages/LiveRecognition';
import { DatasetCollector } from './pages/DatasetCollector';
import { ModelEvaluation } from './pages/ModelEvaluation';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'live' | 'dataset' | 'evaluation'>('live');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        toggleTheme={toggleTheme}
      />
      <main className="main-content">
        {activeTab === 'live' && <LiveRecognition />}
        {activeTab === 'dataset' && <DatasetCollector />}
        {activeTab === 'evaluation' && <ModelEvaluation />}
      </main>
    </div>
  );
};

export default App;
