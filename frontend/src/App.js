import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import LanguageIntelligence from './pages/LanguageIntelligence';
import FIRDraftAssistant from './pages/FIRDraftAssistant';
import BNSIntelligence from './pages/BNSIntelligence';
import CDRAnalyzer from './pages/CDRAnalyzer';
import MediaForensic from './pages/MediaForensic';
import FraudRecovery from './pages/FraudRecovery';
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
          <Route path="/bns-intelligence" element={<ProtectedRoute><BNSIntelligence /></ProtectedRoute>} />
          <Route path="/cdr-analyzer" element={<ProtectedRoute><CDRAnalyzer /></ProtectedRoute>} />
          <Route path="/media-forensic" element={<ProtectedRoute><MediaForensic /></ProtectedRoute>} />
          <Route path="/fraud-recovery" element={<ProtectedRoute><FraudRecovery /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" theme="dark" richColors />
    </div>
  );
}

export default App;
