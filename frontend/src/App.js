import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import LanguageIntelligence from './pages/LanguageIntelligence';
import FIRDraftAssistant from './pages/FIRDraftAssistant';
import LegalIntelligenceEngine from './pages/LegalIntelligenceEngine';
import CDRAnalyzer from './pages/CDRAnalyzer';
import MediaForensic from './pages/MediaForensic';
import FraudRecovery from './pages/FraudRecovery';
import SmartSummons from './pages/SmartSummons';
import JurisdictionFinder from './pages/JurisdictionFinder';
import CaseDiary from './pages/CaseDiary';
import Profile from './pages/Profile';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  React.useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    return token ? children : <Navigate to="/login" />;
  };

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login setIsAuthenticated={setIsAuthenticated} />} />
          <Route path="/signup" element={<Signup setIsAuthenticated={setIsAuthenticated} />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/language-intelligence" element={<ProtectedRoute><LanguageIntelligence /></ProtectedRoute>} />
          <Route path="/fir-draft" element={<ProtectedRoute><FIRDraftAssistant /></ProtectedRoute>} />
          <Route path="/legal-intelligence" element={<ProtectedRoute><LegalIntelligenceEngine /></ProtectedRoute>} />
          <Route path="/bns-intelligence" element={<Navigate to="/legal-intelligence" replace />} />
          <Route path="/cdr-analyzer" element={<ProtectedRoute><CDRAnalyzer /></ProtectedRoute>} />
          <Route path="/media-forensic" element={<ProtectedRoute><MediaForensic /></ProtectedRoute>} />
          <Route path="/fraud-recovery" element={<ProtectedRoute><FraudRecovery /></ProtectedRoute>} />
          <Route path="/smart-summons" element={<ProtectedRoute><SmartSummons /></ProtectedRoute>} />
          <Route path="/jurisdiction-finder" element={<ProtectedRoute><JurisdictionFinder /></ProtectedRoute>} />
          <Route path="/case-diary" element={<ProtectedRoute><CaseDiary /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" theme="dark" richColors />
    </div>
  );
}

export default App;
