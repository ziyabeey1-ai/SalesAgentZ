import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import MailAutomation from './pages/MailAutomation';
import Tasks from './pages/Tasks';
import Settings from './pages/Settings';
import AssistantModal from './components/AssistantModal';

const App: React.FC = () => {
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  return (
    <HashRouter>
      <Layout toggleAssistant={() => setIsAssistantOpen(!isAssistantOpen)}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/mail" element={<MailAutomation />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/settings" element={<Settings />} />
          {/* Placeholder routes for reports */}
          <Route path="/reports" element={<div className="p-8 text-center text-slate-500">Raporlama Modülü Yapım Aşamasında</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      
      {/* AI Assistant Modal Overlay */}
      <AssistantModal 
        isOpen={isAssistantOpen} 
        onClose={() => setIsAssistantOpen(false)} 
      />
    </HashRouter>
  );
};

export default App;