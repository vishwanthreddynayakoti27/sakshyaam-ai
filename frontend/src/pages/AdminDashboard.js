import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Users, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Clock,
  Activity,
  Eye
} from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import api from '../utils/api';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingUsers, setPendingUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'pending') loadPendingUsers();
    else if (activeTab === 'logs') loadLogs();
    else if (activeTab === 'issues') loadIssues();
  }, [activeTab]);

  const loadPendingUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/pending-users');
      setPendingUsers(response.data.pending_users || []);
    } catch (error) {
      toast.error('Failed to load pending users');
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/action-logs?limit=100');
      setLogs(response.data.logs || []);
    } catch (error) {
      toast.error('Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const loadIssues = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/issues');
      setIssues(response.data.issues || []);
    } catch (error) {
      toast.error('Failed to load issues');
    } finally {
      setLoading(false);
    }
  };

  const approveUser = async (userId) => {
    try {
      await api.post(`/admin/approve-user/${userId}`);
      toast.success(`User ${userId} approved`);
      loadPendingUsers();
    } catch (error) {
      toast.error('Failed to approve user');
    }
  };

  const rejectUser = async (userId) => {
    try {
      await api.post(`/admin/reject-user/${userId}`);
      toast.warning(`User ${userId} rejected`);
      loadPendingUsers();
    } catch (error) {
      toast.error('Failed to reject user');
    }
  };

  return (
    <Layout>
      <div className="space-y-6" data-testid="admin-dashboard">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-[#FF3B3B] to-[#FFB800]">
              <Shield className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-white/60 text-sm">User approval, logs & issue tracking</p>
            </div>
          </div>
          <Button
            onClick={() => {
              if (activeTab === 'pending') loadPendingUsers();
              else if (activeTab === 'logs') loadLogs();
              else loadIssues();
            }}
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
          >
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { id: 'pending', label: 'Pending Users', icon: Users, count: pendingUsers.length },
            { id: 'logs', label: 'System Logs', icon: FileText, count: logs.length },
            { id: 'issues', label: 'Issues', icon: AlertTriangle, count: issues.length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-${tab.id}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-[#FF3B3B] to-[#FFB800] text-white'
                  : 'bg-[#0B0F1A] text-white/60 hover:text-white border border-white/10'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
              {tab.count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-white/20' : 'bg-[#FF3B3B]/20 text-[#FF3B3B]'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-6 rounded-xl bg-[#0B0F1A] border border-white/10"
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="animate-spin text-white/40" size={32} />
            </div>
          ) : (
            <>
              {/* Pending Users Tab */}
              {activeTab === 'pending' && (
                <div className="space-y-4" data-testid="pending-users-list">
                  <h2 className="text-lg font-semibold text-white mb-4">Pending User Approvals</h2>
                  {pendingUsers.length === 0 ? (
                    <div className="text-center py-8 text-white/40">
                      <Users size={48} className="mx-auto mb-3 opacity-40" />
                      <p>No pending users</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingUsers.map((user) => (
                        <div
                          key={user.officer_id}
                          className="flex items-center justify-between p-4 rounded-lg bg-[#030614] border border-white/10"
                        >
                          <div>
                            <p className="text-white font-medium">{user.name || user.officer_id}</p>
                            <p className="text-white/50 text-sm">{user.officer_id}</p>
                            <p className="text-white/40 text-xs">{user.rank} • {user.police_station}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => approveUser(user.officer_id)}
                              size="sm"
                              className="bg-[#00FFB3]/20 text-[#00FFB3] hover:bg-[#00FFB3]/30"
                              data-testid={`approve-${user.officer_id}`}
                            >
                              <CheckCircle size={14} className="mr-1" /> Approve
                            </Button>
                            <Button
                              onClick={() => rejectUser(user.officer_id)}
                              size="sm"
                              variant="outline"
                              className="border-[#FF3B3B]/30 text-[#FF3B3B] hover:bg-[#FF3B3B]/10"
                              data-testid={`reject-${user.officer_id}`}
                            >
                              <XCircle size={14} className="mr-1" /> Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Logs Tab */}
              {activeTab === 'logs' && (
                <div className="space-y-4" data-testid="logs-list">
                  <h2 className="text-lg font-semibold text-white mb-4">System Action Logs</h2>
                  {logs.length === 0 ? (
                    <div className="text-center py-8 text-white/40">
                      <FileText size={48} className="mx-auto mb-3 opacity-40" />
                      <p>No logs available</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-2 px-3 text-white/50">Time</th>
                            <th className="text-left py-2 px-3 text-white/50">User</th>
                            <th className="text-left py-2 px-3 text-white/50">Action</th>
                            <th className="text-left py-2 px-3 text-white/50">Status</th>
                            <th className="text-left py-2 px-3 text-white/50">Correlation ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {logs.map((log, idx) => (
                            <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-2 px-3 text-white/60 text-xs">
                                <Clock size={12} className="inline mr-1" />
                                {log.timestamp?.split('T')[0]} {log.timestamp?.split('T')[1]?.substring(0, 8)}
                              </td>
                              <td className="py-2 px-3 text-white">{log.officer_id || log.user}</td>
                              <td className="py-2 px-3 text-[#00C2FF]">{log.action}</td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  log.status === 'SUCCESS' 
                                    ? 'bg-[#00FFB3]/20 text-[#00FFB3]' 
                                    : 'bg-[#FF3B3B]/20 text-[#FF3B3B]'
                                }`}>
                                  {log.status}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-white/40 font-mono text-xs">
                                {log.correlation_id || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Issues Tab */}
              {activeTab === 'issues' && (
                <div className="space-y-4" data-testid="issues-list">
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <AlertTriangle className="text-[#FFB800]" size={20} />
                    Failed Actions / Issues
                  </h2>
                  {issues.length === 0 ? (
                    <div className="text-center py-8 text-white/40">
                      <CheckCircle size={48} className="mx-auto mb-3 text-[#00FFB3] opacity-40" />
                      <p>No issues found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {issues.map((issue, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-lg bg-[#030614] border border-[#FF3B3B]/30"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-[#FF3B3B] font-semibold flex items-center gap-2">
                                <AlertTriangle size={14} />
                                {issue.action}
                              </p>
                              <p className="text-white/50 text-sm mt-1">User: {issue.user}</p>
                              <p className="text-white/40 text-xs mt-1">
                                <Clock size={10} className="inline mr-1" />
                                {issue.timestamp}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[#FFB800] font-mono text-sm">
                                {issue.correlation_id}
                              </p>
                              <p className="text-white/30 text-xs mt-1">Reference ID</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
