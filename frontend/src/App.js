import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import LanguageIntelligence from './pages/LanguageIntelligence';
import LegalIntelligenceEngine from './pages/LegalIntelligenceEngine';
import InvestigationDocuments from './pages/InvestigationDocuments';
import CDRAnalyzer from './pages/CDRAnalyzer';
import MediaForensic from './pages/MediaForensic';
import FraudRecovery from './pages/FraudRecovery';
import SmartSummons from './pages/SmartSummons';
import JurisdictionFinder from './pages/JurisdictionFinder';
import Profile from './pages/Profile';
// Dual-Wing System
import ChargeSheetFusion from './pages/ChargeSheetFusion';
import DocumentGenerator from './pages/DocumentGenerator';
import EvidenceHash from './pages/EvidenceHash';
import CCTVSearch from './pages/CCTVSearch';
import CCTNSBridge from './pages/CCTNSBridge';
// New Modules
import RemandReport from './pages/RemandReport';
import CDFFiller from './pages/CDFFiller';
import AdminDashboard from './pages/AdminDashboard';
import Credits from './pages/Credits';
import CreditsSuccess from './pages/CreditsSuccess';
import VehicleTracker from './pages/VehicleTracker';
import NarrationGenerator from './pages/NarrationGenerator';
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
          {/* WING 1: ADMIN */}
          <Route path="/charge-sheet-fusion" element={<ProtectedRoute><ChargeSheetFusion /></ProtectedRoute>} />
          <Route path="/narration-generator" element={<ProtectedRoute><NarrationGenerator /></ProtectedRoute>} />
          <Route path="/remand-report" element={<Navigate to="/charge-sheet-fusion" replace />} />
          <Route path="/cdf-filler" element={<ProtectedRoute><CDFFiller /></ProtectedRoute>} />
          <Route path="/document-generator" element={<ProtectedRoute><DocumentGenerator /></ProtectedRoute>} />
          <Route path="/cctns-bridge" element={<ProtectedRoute><CCTNSBridge /></ProtectedRoute>} />
          <Route path="/language-intelligence" element={<ProtectedRoute><LanguageIntelligence /></ProtectedRoute>} />
          <Route path="/legal-intelligence" element={<ProtectedRoute><LegalIntelligenceEngine /></ProtectedRoute>} />
          <Route path="/bns-intelligence" element={<Navigate to="/legal-intelligence" replace />} />
          <Route path="/investigation-documents" element={<ProtectedRoute><InvestigationDocuments /></ProtectedRoute>} />
          <Route path="/fraud-recovery" element={<ProtectedRoute><FraudRecovery /></ProtectedRoute>} />
          <Route path="/smart-summons" element={<ProtectedRoute><SmartSummons /></ProtectedRoute>} />
          <Route path="/jurisdiction-finder" element={<ProtectedRoute><JurisdictionFinder /></ProtectedRoute>} />
          {/* WING 2: LAB */}
          <Route path="/cdr-analyzer" element={<ProtectedRoute><CDRAnalyzer /></ProtectedRoute>} />
          <Route path="/media-forensic" element={<ProtectedRoute><MediaForensic /></ProtectedRoute>} />
          <Route path="/cctv-search" element={<ProtectedRoute><CCTVSearch /></ProtectedRoute>} />
          <Route path="/evidence-hash" element={<ProtectedRoute><EvidenceHash /></ProtectedRoute>} />
          {/* Profile */}
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          {/* Admin */}
          <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          {/* Credits & Payments */}
          <Route path="/credits" element={<ProtectedRoute><Credits /></ProtectedRoute>} />
          <Route path="/credits/success" element={<ProtectedRoute><CreditsSuccess /></ProtectedRoute>} />
          {/* Vehicle multi-camera tracker */}
          <Route path="/cctv/track" element={<ProtectedRoute><VehicleTracker /></ProtectedRoute>} />
          {/* Redirects for old routes */}
          <Route path="/unified-pipeline" element={<Navigate to="/charge-sheet-fusion" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" theme="dark" richColors />
    </div>
  );
}

export default App;
