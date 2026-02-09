
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import MailAutomation from './pages/MailAutomation';
import Tasks from './pages/Tasks';
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import Training from './pages/Training';
import Guide from './pages/Guide';
import CalendarPage from './pages/CalendarPage';
import AssistantModal from './components/AssistantModal';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import { AgentProvider } from './context/AgentContext';
import { storage } from './services/storage';

// Protected Route Component
const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    const location = useLocation();

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Setup Check
    const profile = storage.getUserProfile();
    // If authenticated but setup not complete, force to onboarding
    if (!profile.isSetupComplete && location.pathname !== '/onboarding') {
        return <Navigate to="/onboarding" replace />;
    }

    return <>{children}</>;
};

const App = () => {
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  return (
    <AgentProvider>
      <HashRouter>
        <Routes>
            {/* Public Route */}
            <Route path="/login" element={<Login />} />

            {/* Protected Routes */}
            <Route path="/onboarding" element={
                <ProtectedRoute>
                    <Onboarding />
                </ProtectedRoute>
            } />

            <Route path="/*" element={
                <ProtectedRoute>
                    <Layout toggleAssistant={() => setIsAssistantOpen(!isAssistantOpen)}>
                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/leads" element={<Leads />} />
                            <Route path="/mail" element={<MailAutomation />} />
                            <Route path="/calendar" element={<CalendarPage />} />
                            <Route path="/tasks" element={<Tasks />} />
                            <Route path="/training" element={<Training />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/reports" element={<Reports />} />
                            <Route path="/guide" element={<Guide />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                        
                        {/* AI Assistant Modal Overlay */}
                        <AssistantModal 
                            isOpen={isAssistantOpen} 
                            onClose={() => setIsAssistantOpen(false)} 
                        />
                    </Layout>
                </ProtectedRoute>
            } />
        </Routes>
      </HashRouter>
    </AgentProvider>
  );
};

export default App;
