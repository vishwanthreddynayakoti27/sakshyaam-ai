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
  Eye,
  BarChart3,
  Database,
  DollarSign,
  Languages,
  TrendingUp,
  Trash2,
  UserCog,
  Lock,
  KeyRound,
  Copy,
  Zap,
  Plus,
  Minus,
  Search
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
  const [usageReport, setUsageReport] = useState(null);
  const [topUsers, setTopUsers] = useState([]);
  const [cacheStats, setCacheStats] = useState(null);
  const [allOfficers, setAllOfficers] = useState([]);
  const [resetRequests, setResetRequests] = useState([]);
  const [tempPassword, setTempPassword] = useState(null); // One-time display of generated temp password
  const [creditGrants, setCreditGrants] = useState([]);
  const [grantInputs, setGrantInputs] = useState({}); // { officer_id: { amount, reason } }
  const [creditSearch, setCreditSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Resolve current user role for RBAC gating
  const [myRole, setMyRole] = useState('officer');
  useEffect(() => {
    // Fast read from localStorage
    try {
      const stored = JSON.parse(localStorage.getItem('officer') || '{}');
      setMyRole(stored.role || (stored.is_admin ? 'admin' : 'officer'));
    } catch (e) {
      setMyRole('officer');
    }
    // Refresh from server so role changes don't require re-login
    (async () => {
      try {
        const res = await api.get('/auth/profile');
        const fresh = res.data || {};
        const role = fresh.role || (fresh.is_admin ? 'admin' : 'officer');
        setMyRole(role);
        try {
          const merged = { ...(JSON.parse(localStorage.getItem('officer') || '{}')), ...fresh };
          localStorage.setItem('officer', JSON.stringify(merged));
        } catch (e) { /* ignore */ }
      } catch (e) { /* non-admin users get 401/403 which is fine */ }
    })();
  }, []);

  const isAdmin = myRole === 'admin';
  const isSupervisor = myRole === 'supervisor';
  const canRead = isAdmin || isSupervisor;
  const canWrite = isAdmin;

  useEffect(() => {
    if (activeTab === 'pending') loadPendingUsers();
    else if (activeTab === 'logs') loadLogs();
    else if (activeTab === 'issues') loadIssues();
    else if (activeTab === 'usage') loadUsageData();
    else if (activeTab === 'roles') loadAllOfficers();
    else if (activeTab === 'resets') loadResetRequests();
    else if (activeTab === 'credits') loadCreditsTab();
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
      const [issuesRes, feRes] = await Promise.all([
        api.get('/admin/issues'),
        api.get('/admin/frontend-errors?limit=50'),
      ]);
      const backendIssues = issuesRes.data.issues || [];
      const frontendErrors = (feRes.data?.errors || []).map((e) => ({
        timestamp: e.timestamp,
        user: e.user,
        action: `[FE] ${e.error_type}: ${e.message}`,
        status: 'FAILED',
        correlation_id: `FE-${e.id}`,
        url: e.url,
        is_frontend: true,
      }));
      const merged = [...backendIssues, ...frontendErrors].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setIssues(merged);
    } catch (error) {
      toast.error('Failed to load issues');
    } finally {
      setLoading(false);
    }
  };

  const loadUsageData = async () => {
    setLoading(true);
    try {
      const [reportRes, topRes, cacheRes] = await Promise.all([
        api.get('/admin/translation-usage'),
        api.get('/admin/translation-usage/top-users?limit=10'),
        api.get('/admin/cache-stats')
      ]);
      setUsageReport(reportRes.data || null);
      setTopUsers(topRes.data?.top_users || []);
      setCacheStats(cacheRes.data || null);
    } catch (error) {
      toast.error('Failed to load usage data');
    } finally {
      setLoading(false);
    }
  };

  const cleanupCache = async () => {
    if (!window.confirm('Delete cache entries older than 30 days?')) return;
    try {
      const res = await api.post('/admin/cache-cleanup?days_old=30');
      toast.success(`Deleted ${res.data.deleted_count} old cache entries`);
      loadUsageData();
    } catch (error) {
      toast.error('Cache cleanup failed');
    }
  };

  const loadAllOfficers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/officers');
      setAllOfficers(res.data?.officers || []);
    } catch (error) {
      toast.error('Failed to load officers');
    } finally {
      setLoading(false);
    }
  };

  const changeRole = async (officerId, newRole) => {
    try {
      const fd = new FormData();
      fd.append('role', newRole);
      await api.post(`/admin/officers/${officerId}/role`, fd);
      toast.success(`${officerId} set to ${newRole}`);
      loadAllOfficers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Role change failed');
    }
  };

  const loadResetRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/password-reset-requests');
      setResetRequests(res.data?.requests || []);
    } catch (error) {
      toast.error('Failed to load password reset requests');
    } finally {
      setLoading(false);
    }
  };

  const loadCreditsTab = async () => {
    setLoading(true);
    try {
      const [officersRes, grantsRes] = await Promise.all([
        api.get('/admin/officers'),
        api.get('/admin/credit-grants?limit=100'),
      ]);
      setAllOfficers(officersRes.data?.officers || []);
      setCreditGrants(grantsRes.data?.grants || []);
    } catch (error) {
      toast.error('Failed to load credit data');
    } finally {
      setLoading(false);
    }
  };

  const grantCredits = async (officerId, sign = 1) => {
    const input = grantInputs[officerId] || {};
    const amount = sign * Math.abs(parseInt(input.amount, 10) || 0);
    if (!amount) {
      toast.error('Enter a credit amount');
      return;
    }
    const verb = sign > 0 ? 'grant' : 'revoke';
    if (!window.confirm(`${verb === 'grant' ? 'Grant' : 'Revoke'} ${Math.abs(amount)} credits ${sign > 0 ? 'to' : 'from'} ${officerId}?`)) return;
    try {
      const res = await api.post(`/admin/grant-credits/${officerId}`, {
        amount,
        reason: input.reason || '',
      });
      const data = res.data || res;
      toast.success(`${verb === 'grant' ? 'Granted' : 'Revoked'} ${Math.abs(amount)} credits — new balance: ${data.new_balance}`);
      setGrantInputs((prev) => ({ ...prev, [officerId]: { amount: '', reason: '' } }));
      loadCreditsTab();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Grant failed');
    }
  };

  const approveReset = async (requestId, officerId) => {
    if (!window.confirm(`Generate temporary password for ${officerId}? The password will be shown ONCE — share it offline with the officer.`)) return;
    try {
      const res = await api.post(`/admin/password-reset-requests/${requestId}/reset`);
      setTempPassword({
        officer_id: res.data.officer_id,
        password: res.data.temporary_password,
        request_id: res.data.request_id,
      });
      toast.success(`Temporary password generated for ${officerId}`);
      loadResetRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Reset failed');
    }
  };

  const rejectReset = async (requestId) => {
    if (!window.confirm('Reject this password reset request?')) return;
    try {
      await api.post(`/admin/password-reset-requests/${requestId}/reject`);
      toast.success('Request rejected');
      loadResetRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Reject failed');
    }
  };

  const copyTempPassword = () => {
    if (!tempPassword) return;
    navigator.clipboard?.writeText(tempPassword.password);
    toast.success('Copied to clipboard');
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
              <h1 className="text-2xl font-bold text-white">
                {isAdmin ? 'Admin Dashboard' : 'Supervisor Dashboard'}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-white/60 text-sm">
                  {isAdmin
                    ? 'User approval, logs, roles & issue tracking'
                    : 'Read-only oversight — issues, logs, translation usage'}
                </p>
                <span
                  data-testid="role-badge"
                  className={`px-2 py-0.5 rounded-full text-xs font-mono uppercase ${
                    isAdmin
                      ? 'bg-[#FFB800]/20 text-[#FFB800] border border-[#FFB800]/30'
                      : isSupervisor
                      ? 'bg-[#00C2FF]/20 text-[#00C2FF] border border-[#00C2FF]/30'
                      : 'bg-white/10 text-white/50 border border-white/10'
                  }`}
                >
                  {myRole}
                </span>
              </div>
            </div>
          </div>
          <Button
            onClick={() => {
              if (activeTab === 'pending') loadPendingUsers();
              else if (activeTab === 'logs') loadLogs();
              else if (activeTab === 'usage') loadUsageData();
              else if (activeTab === 'roles') loadAllOfficers();
              else if (activeTab === 'resets') loadResetRequests();
              else loadIssues();
            }}
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
            data-testid="admin-refresh-btn"
          >
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { id: 'pending', label: 'Pending Users', icon: Users, count: pendingUsers.length, show: canRead },
            { id: 'resets', label: 'Password Resets', icon: KeyRound, count: resetRequests.filter((r) => r.status === 'pending').length, show: canRead },
            { id: 'logs', label: 'System Logs', icon: FileText, count: logs.length, show: canRead },
            { id: 'issues', label: 'Issues', icon: AlertTriangle, count: issues.length, show: canRead },
            { id: 'usage', label: 'Translation Usage', icon: BarChart3, count: usageReport?.totals?.total_requests || 0, show: canRead },
            { id: 'credits', label: 'Grant Credits', icon: Zap, count: 0, show: canWrite },
            { id: 'roles', label: 'Manage Roles', icon: UserCog, count: allOfficers.length, show: canWrite }
          ].filter((t) => t.show).map((tab) => (
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
                            {canWrite ? (
                              <>
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
                              </>
                            ) : (
                              <span className="flex items-center gap-1 text-white/40 text-xs">
                                <Lock size={12} /> Read-only (Supervisor)
                              </span>
                            )}
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

              {/* Translation Usage Tab */}
              {activeTab === 'usage' && (
                <div className="space-y-6" data-testid="usage-tab">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <BarChart3 className="text-[#00C2FF]" size={20} />
                      Translation Usage & Cache Reports
                    </h2>
                    <Button
                      onClick={cleanupCache}
                      size="sm"
                      variant="outline"
                      disabled={!canWrite}
                      className="border-[#FF3B3B]/30 text-[#FF3B3B] hover:bg-[#FF3B3B]/10 disabled:opacity-40"
                      data-testid="cache-cleanup-btn"
                      title={canWrite ? 'Delete cache entries older than 30 days' : 'Admin only'}
                    >
                      {canWrite ? <Trash2 size={14} className="mr-1" /> : <Lock size={14} className="mr-1" />}
                      Clean cache &gt; 30 days
                    </Button>
                  </div>

                  {/* KPI Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3" data-testid="usage-kpi-cards">
                    <div className="p-4 rounded-lg bg-[#030614] border border-white/10" data-testid="kpi-total-requests">
                      <div className="flex items-center gap-2 text-white/50 text-xs">
                        <Activity size={14} /> Total Requests
                      </div>
                      <p className="text-2xl font-bold text-white mt-1">
                        {usageReport?.totals?.total_requests ?? 0}
                      </p>
                      <p className="text-white/40 text-xs mt-1">
                        {usageReport?.start_date} → {usageReport?.end_date}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-[#030614] border border-white/10" data-testid="kpi-total-chars">
                      <div className="flex items-center gap-2 text-white/50 text-xs">
                        <Languages size={14} /> Characters Translated
                      </div>
                      <p className="text-2xl font-bold text-white mt-1">
                        {(usageReport?.totals?.total_chars ?? 0).toLocaleString()}
                      </p>
                      <p className="text-white/40 text-xs mt-1">
                        Tokens: {(usageReport?.totals?.total_tokens ?? 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-[#030614] border border-white/10" data-testid="kpi-cost">
                      <div className="flex items-center gap-2 text-white/50 text-xs">
                        <DollarSign size={14} /> Estimated Cost (USD)
                      </div>
                      <p className="text-2xl font-bold text-[#FFB800] mt-1">
                        ${(usageReport?.totals?.estimated_cost_usd ?? 0).toFixed(2)}
                      </p>
                      <p className="text-white/40 text-xs mt-1">
                        Cached reqs: {usageReport?.totals?.cached_requests ?? 0}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-[#030614] border border-white/10" data-testid="kpi-cache-hit-rate">
                      <div className="flex items-center gap-2 text-white/50 text-xs">
                        <TrendingUp size={14} /> Cache Hit Rate
                      </div>
                      <p className="text-2xl font-bold text-[#00FFB3] mt-1">
                        {(usageReport?.totals?.cache_hit_rate ?? 0).toFixed(1)}%
                      </p>
                      <p className="text-white/40 text-xs mt-1">
                        Cache entries: {cacheStats?.total_entries ?? 0}
                      </p>
                    </div>
                  </div>

                  {/* Daily Breakdown */}
                  <div className="p-4 rounded-lg bg-[#030614] border border-white/10" data-testid="daily-breakdown">
                    <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
                      <Clock size={14} /> Daily Breakdown (last 30 days)
                    </h3>
                    {(!usageReport?.daily_breakdown || usageReport.daily_breakdown.length === 0) ? (
                      <p className="text-white/40 text-sm text-center py-6">No translation activity in this period.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/10 text-white/50">
                              <th className="text-left py-2 px-3">Date</th>
                              <th className="text-right py-2 px-3">Requests</th>
                              <th className="text-right py-2 px-3">Chars</th>
                              <th className="text-right py-2 px-3">Tokens</th>
                              <th className="text-right py-2 px-3">Cached</th>
                              <th className="text-right py-2 px-3">Cost ($)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {usageReport.daily_breakdown.map((day, idx) => (
                              <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                                <td className="py-2 px-3 text-white/80">{day.date}</td>
                                <td className="py-2 px-3 text-white text-right">{day.total_requests || 0}</td>
                                <td className="py-2 px-3 text-white text-right">{(day.total_chars || 0).toLocaleString()}</td>
                                <td className="py-2 px-3 text-white text-right">{(day.total_tokens || 0).toLocaleString()}</td>
                                <td className="py-2 px-3 text-[#00FFB3] text-right">{day.cached_requests || 0}</td>
                                <td className="py-2 px-3 text-[#FFB800] text-right">${(day.estimated_cost_usd || 0).toFixed(4)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Top Users + Cache Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-[#030614] border border-white/10" data-testid="top-users-card">
                      <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
                        <Users size={14} /> Top Users (current month)
                      </h3>
                      {topUsers.length === 0 ? (
                        <p className="text-white/40 text-sm text-center py-4">No user activity yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {topUsers.map((u, idx) => (
                            <div
                              key={u.officer_id}
                              className="flex items-center justify-between p-2 rounded bg-white/5"
                              data-testid={`top-user-${u.officer_id}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-white/40 text-xs w-5">#{idx + 1}</span>
                                <span className="text-white font-mono text-sm">{u.officer_id}</span>
                              </div>
                              <div className="flex items-center gap-4 text-xs">
                                <span className="text-white/60">{u.total_requests} reqs</span>
                                <span className="text-white/60">{(u.total_chars || 0).toLocaleString()} chars</span>
                                <span className="text-[#FFB800]">${(u.estimated_cost_usd || 0).toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-lg bg-[#030614] border border-white/10" data-testid="cache-stats-card">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                          <Database size={14} /> Document Cache
                        </h3>
                        {cacheStats?.encryption_enabled ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#00FFB3]/15 text-[#00FFB3] border border-[#00FFB3]/30"
                            title={cacheStats?.encryption_algorithm || 'Encrypted at rest'}
                            data-testid="cache-encryption-badge"
                          >
                            <Lock size={10} /> Encrypted at rest
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FF4655]/15 text-[#FF4655] border border-[#FF4655]/30"
                            title="CACHE_ENCRYPTION_KEY not set"
                            data-testid="cache-encryption-badge"
                          >
                            <Lock size={10} /> Plaintext (set CACHE_ENCRYPTION_KEY)
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-white/40 text-xs">Total Entries</p>
                          <p className="text-white font-bold text-lg">{cacheStats?.total_entries ?? 0}</p>
                        </div>
                        <div>
                          <p className="text-white/40 text-xs">Cache Hits</p>
                          <p className="text-[#00FFB3] font-bold text-lg">{cacheStats?.total_cache_hits ?? 0}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-white/40 text-xs">Est. Cost Savings</p>
                          <p className="text-[#00FFB3] font-bold text-lg">${(cacheStats?.estimated_cost_savings_usd ?? 0).toFixed(2)}</p>
                        </div>
                      </div>
                      {cacheStats?.by_operation && Object.keys(cacheStats.by_operation).length > 0 && (
                        <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                          <p className="text-white/40 text-xs uppercase">By Operation</p>
                          {Object.entries(cacheStats.by_operation).map(([op, stats]) => (
                            <div key={op} className="flex items-center justify-between text-xs">
                              <span className="text-white/70">{op}</span>
                              <span className="text-white/50">
                                {stats.count} entries · {stats.hits} hits
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Password Resets Tab */}
              {activeTab === 'resets' && (
                <div className="space-y-4" data-testid="resets-tab">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <KeyRound className="text-[#FFB800]" size={20} />
                      Password Reset Requests
                    </h2>
                    <p className="text-white/50 text-xs">
                      {resetRequests.filter((r) => r.status === 'pending').length} pending ·
                      {' '}{resetRequests.length} total
                    </p>
                  </div>

                  {/* One-time temp password banner (admin only) */}
                  {tempPassword && (
                    <div
                      className="p-4 rounded-lg bg-[#FFB800]/10 border border-[#FFB800]/40"
                      data-testid="temp-password-banner"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-[#FFB800] text-sm font-semibold flex items-center gap-2">
                            <KeyRound size={14} />
                            Temporary password for {tempPassword.officer_id}
                          </p>
                          <p className="text-white/60 text-xs mt-1">
                            Share this offline with the officer. It will NOT be shown again.
                          </p>
                          <div className="mt-3 flex items-center gap-2">
                            <code
                              className="px-3 py-2 rounded bg-black/50 text-[#00FFB3] font-mono text-base tracking-wider border border-[#00FFB3]/30 select-all"
                              data-testid="temp-password-value"
                            >
                              {tempPassword.password}
                            </code>
                            <Button
                              size="sm"
                              onClick={copyTempPassword}
                              className="bg-[#00C2FF]/20 text-[#00C2FF] hover:bg-[#00C2FF]/30"
                              data-testid="copy-temp-password-btn"
                            >
                              <Copy size={14} className="mr-1" /> Copy
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setTempPassword(null)}
                              className="border-white/20 text-white/70"
                              data-testid="dismiss-temp-password-btn"
                            >
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg bg-[#030614] border border-white/10 divide-y divide-white/5">
                    {resetRequests.length === 0 ? (
                      <div className="text-center py-8 text-white/40">
                        <KeyRound size={48} className="mx-auto mb-3 opacity-40" />
                        <p>No password reset requests</p>
                      </div>
                    ) : (
                      resetRequests.map((req) => {
                        const statusColor = req.status === 'pending'
                          ? 'bg-[#FFB800]/20 text-[#FFB800] border-[#FFB800]/30'
                          : req.status === 'completed'
                          ? 'bg-[#00FFB3]/20 text-[#00FFB3] border-[#00FFB3]/30'
                          : 'bg-[#FF3B3B]/20 text-[#FF3B3B] border-[#FF3B3B]/30';
                        return (
                          <div
                            key={req.request_id}
                            className="px-4 py-3 hover:bg-white/5"
                            data-testid={`reset-request-${req.request_id}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-white font-medium">
                                    {req.officer_name || req.officer_id}
                                  </span>
                                  <span className="text-white/40 text-xs font-mono">
                                    {req.officer_id}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-mono uppercase border ${statusColor}`}>
                                    {req.status}
                                  </span>
                                </div>
                                <p className="text-white/50 text-xs">
                                  Email: {req.email_on_file || req.email_provided || '-'}
                                </p>
                                {req.reason && (
                                  <p className="text-white/60 text-sm mt-1 italic">"{req.reason}"</p>
                                )}
                                <p className="text-white/30 text-xs mt-1 flex items-center gap-3">
                                  <span>
                                    <Clock size={10} className="inline mr-1" />
                                    Requested {req.created_at?.split('T')[0]} {req.created_at?.split('T')[1]?.substring(0, 8)}
                                  </span>
                                  {req.resolved_by && (
                                    <span className="text-white/50">
                                      · Resolved by {req.resolved_by}
                                    </span>
                                  )}
                                </p>
                              </div>
                              {req.status === 'pending' && (
                                <div className="flex gap-2 shrink-0">
                                  {canWrite ? (
                                    <>
                                      <Button
                                        size="sm"
                                        onClick={() => approveReset(req.request_id, req.officer_id)}
                                        data-testid={`approve-reset-${req.request_id}`}
                                        className="bg-[#00FFB3]/20 text-[#00FFB3] hover:bg-[#00FFB3]/30"
                                      >
                                        <KeyRound size={14} className="mr-1" /> Reset
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => rejectReset(req.request_id)}
                                        data-testid={`reject-reset-${req.request_id}`}
                                        className="border-[#FF3B3B]/30 text-[#FF3B3B] hover:bg-[#FF3B3B]/10"
                                      >
                                        <XCircle size={14} />
                                      </Button>
                                    </>
                                  ) : (
                                    <span className="flex items-center gap-1 text-white/40 text-xs">
                                      <Lock size={12} /> Admin only
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Grant Credits Tab (Admin ONLY) */}
              {activeTab === 'credits' && canWrite && (
                <div className="space-y-4" data-testid="credits-tab">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Zap className="text-accent" size={20} />
                      Grant Credits
                    </h2>
                    <div className="relative w-full sm:w-72">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                      <input
                        type="text"
                        placeholder="Search by ID or name…"
                        value={creditSearch}
                        onChange={(e) => setCreditSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-md bg-[#030614] border border-white/10 text-white text-sm focus:outline-none focus:border-accent/50"
                        data-testid="credits-search-input"
                      />
                    </div>
                  </div>
                  <p className="text-white/50 text-xs">
                    Manually credit (or revoke) an officer's account. Used for pilot rollouts, refunds, agency onboarding, or paid out-of-band.
                  </p>

                  <div className="rounded-lg bg-[#030614] border border-white/10 divide-y divide-white/5 max-h-[480px] overflow-y-auto" data-testid="credits-officer-list">
                    {allOfficers
                      .filter((o) => {
                        if (!creditSearch) return true;
                        const q = creditSearch.toLowerCase();
                        return (o.officer_id || '').toLowerCase().includes(q)
                          || (o.name || '').toLowerCase().includes(q)
                          || (o.department || '').toLowerCase().includes(q);
                      })
                      .map((o) => {
                        const input = grantInputs[o.officer_id] || { amount: '', reason: '' };
                        const updateInput = (patch) =>
                          setGrantInputs((prev) => ({ ...prev, [o.officer_id]: { ...input, ...patch } }));
                        return (
                          <div key={o.officer_id} className="px-4 py-3" data-testid={`grant-row-${o.officer_id}`}>
                            <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                              <div>
                                <p className="text-white font-medium">{o.name || o.officer_id}</p>
                                <p className="text-white/40 text-xs font-mono">
                                  {o.officer_id} · {o.department || '-'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/30">
                                <Zap size={12} className="text-accent" />
                                <span className="text-accent font-bold" data-testid={`balance-${o.officer_id}`}>{o.credits ?? 0}</span>
                                <span className="text-white/40 text-xs">credits</span>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr_auto_auto] gap-2 items-center">
                              <input
                                type="number"
                                placeholder="Amount"
                                value={input.amount}
                                onChange={(e) => updateInput({ amount: e.target.value })}
                                className="px-3 py-2 rounded-md bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-accent/50"
                                data-testid={`grant-amount-${o.officer_id}`}
                              />
                              <input
                                type="text"
                                placeholder="Reason (e.g. pilot rollout)"
                                value={input.reason}
                                onChange={(e) => updateInput({ reason: e.target.value })}
                                className="px-3 py-2 rounded-md bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-accent/50"
                                data-testid={`grant-reason-${o.officer_id}`}
                              />
                              <button
                                onClick={() => grantCredits(o.officer_id, 1)}
                                className="px-3 py-2 rounded-md bg-success/15 border border-success/30 text-success hover:bg-success/25 text-sm flex items-center gap-1"
                                data-testid={`grant-add-${o.officer_id}`}
                              >
                                <Plus size={14} /> Grant
                              </button>
                              <button
                                onClick={() => grantCredits(o.officer_id, -1)}
                                className="px-3 py-2 rounded-md bg-[#FF4655]/15 border border-[#FF4655]/30 text-[#FF4655] hover:bg-[#FF4655]/25 text-sm flex items-center gap-1"
                                data-testid={`grant-revoke-${o.officer_id}`}
                              >
                                <Minus size={14} /> Revoke
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  <div className="rounded-lg bg-[#030614] border border-white/10 p-4" data-testid="credit-grants-history">
                    <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
                      <Clock size={14} /> Recent grants
                    </h3>
                    {creditGrants.length === 0 ? (
                      <p className="text-white/40 text-sm">No grants yet.</p>
                    ) : (
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {creditGrants.map((g, i) => (
                          <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                            <div className="text-xs">
                              <span className={g.amount >= 0 ? 'text-success' : 'text-[#FF4655]'}>
                                {g.amount >= 0 ? '+' : ''}{g.amount}
                              </span>
                              <span className="text-white/60"> → {g.officer_name || g.officer_id}</span>
                              {g.reason && <span className="text-white/40"> · "{g.reason}"</span>}
                            </div>
                            <div className="text-white/40 text-xs">
                              by {g.granted_by} · {new Date(g.granted_at).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Manage Roles Tab (Admin ONLY) */}
              {activeTab === 'roles' && canWrite && (
                <div className="space-y-4" data-testid="roles-tab">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <UserCog className="text-[#FFB800]" size={20} />
                      Manage Officer Roles
                    </h2>
                    <p className="text-white/50 text-xs">{allOfficers.length} officers</p>
                  </div>
                  <div className="rounded-lg bg-[#030614] border border-white/10 divide-y divide-white/5">
                    {allOfficers.length === 0 ? (
                      <div className="text-center py-8 text-white/40">
                        <UserCog size={48} className="mx-auto mb-3 opacity-40" />
                        <p>No officers found</p>
                      </div>
                    ) : (
                      allOfficers.map((o) => {
                        const role = o.role || (o.is_admin ? 'admin' : 'officer');
                        const badgeColor =
                          role === 'admin'
                            ? 'bg-[#FFB800]/20 text-[#FFB800] border-[#FFB800]/30'
                            : role === 'supervisor'
                            ? 'bg-[#00C2FF]/20 text-[#00C2FF] border-[#00C2FF]/30'
                            : 'bg-white/10 text-white/60 border-white/10';
                        return (
                          <div
                            key={o.officer_id}
                            className="flex items-center justify-between px-4 py-3 hover:bg-white/5"
                            data-testid={`officer-row-${o.officer_id}`}
                          >
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="text-white font-medium">{o.name || o.officer_id}</p>
                                <p className="text-white/40 text-xs font-mono">
                                  {o.officer_id} · {o.rank || '-'} · {o.district || '-'}
                                </p>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-mono uppercase border ${badgeColor}`}>
                                {role}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              {['officer', 'supervisor', 'admin'].map((r) => (
                                <Button
                                  key={r}
                                  size="sm"
                                  variant="outline"
                                  disabled={role === r}
                                  onClick={() => changeRole(o.officer_id, r)}
                                  data-testid={`set-role-${o.officer_id}-${r}`}
                                  className={`text-xs h-7 px-2 border-white/10 hover:bg-white/10 ${
                                    role === r ? 'bg-white/10 text-white' : 'text-white/60'
                                  }`}
                                >
                                  {r}
                                </Button>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <p className="text-xs text-white/40">
                    <Lock size={10} className="inline mr-1" />
                    You cannot change your own role. Ask another admin.
                  </p>
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
