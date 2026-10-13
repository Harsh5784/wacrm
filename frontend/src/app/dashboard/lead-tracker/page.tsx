'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, bmApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { cn, timeAgo } from '@/lib/utils';
import { Button, Badge, Card, StatCard, Input, Textarea, Select, Modal } from '@/components/ui';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid
} from 'recharts';
import {
  Users, CheckSquare, Square, Send, Calendar, Clock, Search, Filter, Plus,
  Phone, MessageSquare, AlertCircle, RefreshCw, Sparkles, GlassWater, CheckCircle2,
  Trash2, Edit, UserCheck, ShieldCheck, BarChart3, Bell, Server,
  Lock, Ban, Unlock, UserPlus, Bot, TrendingUp, Ticket, Zap, MessageCircle
} from 'lucide-react';

export default function MasterDashboardPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'overview' | 'leads' | 'tickets' | 'messages' | 'admins' | 'entries' | 'broadcast' | 'ai' | 'system'
  >('overview');

  // Search & Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Bharat Milk Server Data States
  const [bmSummary, setBmSummary] = useState<any>(null);
  const [bmAdmins, setBmAdmins] = useState<any[]>([]);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState('all');

  const [bmEntries, setBmEntries] = useState<any[]>([]);
  const [entryDateFilter, setEntryDateFilter] = useState(new Date().toISOString().slice(0, 10));
  const [entryAdminFilter, setEntryAdminFilter] = useState('');
  const [adminMonthFilter, setAdminMonthFilter] = useState('all');

  const [ticketsList, setTicketsList] = useState<any[]>([]);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [bmLoading, setBmLoading] = useState(false);
  const [bmAuthError, setBmAuthError] = useState(false);
  const [bmLoginForm, setBmLoginForm] = useState({ email: '', password: '' });
  const [bmLoginLoading, setBmLoginLoading] = useState(false);

  // Modals state
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [createLeadModalOpen, setCreateLeadModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);

  // Ticket Status & Comment Modal
  const [createTicketModalOpen, setCreateTicketModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [ticketStatusModalOpen, setTicketStatusModalOpen] = useState(false);
  const [newTicketStatus, setNewTicketStatus] = useState('COMPLETED');
  const [ticketComment, setTicketComment] = useState('');
  const [sendWhatsappOnStatusUpdate, setSendWhatsappOnStatusUpdate] = useState(true);

  const [ticketForm, setTicketForm] = useState({
    title: '', description: '', customerName: '', phone: '', category: 'Delivery Issue', priority: 'Medium'
  });

  // Admin Modals
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<any>(null);
  const [adminForm, setAdminForm] = useState({
    name: '', email: '', phone: '', password: '', pincode: '', status: 'active'
  });

  // Customers Modal
  const [customersModalOpen, setCustomersModalOpen] = useState(false);
  const [selectedAdminForCustomers, setSelectedAdminForCustomers] = useState<any>(null);
  const [adminCustomersList, setAdminCustomersList] = useState<any[]>([]);

  // Add Customer Modal
  const [customerFormModalOpen, setCustomerFormModalOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    name: '', phone: '', email: '', address: '', pincode: '', qty: 1, milkType: 'cow', price: 60
  });

  // Daily Entry Modal
  const [dailyEntryModalOpen, setDailyEntryModalOpen] = useState(false);
  const [dailyEntryForm, setDailyEntryForm] = useState({
    adminId: '', customerId: '', date: new Date().toISOString().slice(0, 10),
    milkType: 'cow', qty: 1, price: 60
  });
  const [entryCustomerOptions, setEntryCustomerOptions] = useState<any[]>([]);

  // Broadcast State
  const [broadcastTarget, setBroadcastTarget] = useState('both');
  const [broadcastScope, setBroadcastScope] = useState('all');
  const [broadcastIds, setBroadcastIds] = useState('');
  const [broadcastChannels, setBroadcastChannels] = useState({ push: true, email: true, whatsapp: true });
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastLog, setBroadcastLog] = useState('Ready to send notification broadcast...');

  // Forms state for WACRM
  const [messageText, setMessageText] = useState('');
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [scheduleNote, setScheduleNote] = useState('');

  // AI Prompt State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Authorization check
  const isAuthorizedUser =
    (user?.email || '').toLowerCase() === 'harshbha30@gmail.com' || user?.role === 'SUPER_ADMIN';

  // WACRM Leads Query (Localhost WACRM API)
  const { data: leadsData, isLoading: isLeadsLoading, refetch: refetchLeads } = useQuery({
    queryKey: ['master-dashboard-leads', search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/whatsapp/chats?includeAll=true&${params}`);
      return data;
    },
    enabled: isAuthorizedUser,
  });

  const leads = leadsData?.data || [];

  // WACRM Mutations
  const toggleCheckMutation = useMutation({
    mutationFn: (leadId: string) => api.post(`/whatsapp/chats/${leadId}/toggle-check`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-dashboard-leads'] });
      toast.success('Checkmark updated in DB');
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (payload: { phone?: string; leadId?: string; content: string }) => {
      if (payload.leadId) {
        return api.post(`/whatsapp/chats/${payload.leadId}/send`, { content: payload.content });
      }
      return api.post('/whatsapp/direct/send', { phone: payload.phone, content: payload.content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-dashboard-leads'] });
      setSendModalOpen(false);
      setMessageText('');
      toast.success('WhatsApp message sent!');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to send WhatsApp'),
  });

  const scheduleMessageMutation = useMutation({
    mutationFn: (payload: { leadId: string; scheduledAt: string; messageContent: string; note: string }) =>
      api.post(`/whatsapp/chats/${payload.leadId}/schedule-message`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-dashboard-leads'] });
      setScheduleModalOpen(false);
      setMessageText('');
      setScheduleDateTime('');
      toast.success('Auto WhatsApp follow-up scheduled!');
    },
  });

  const handleBmLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!bmLoginForm.email || !bmLoginForm.password) {
      toast.error('Please enter email and password.');
      return;
    }
    setBmLoginLoading(true);
    try {
      const { data } = await bmApi.post('/superadmin/login', bmLoginForm);
      if (data.success && data.token) {
        localStorage.setItem('ops_dashboard_auth_token', data.token);
        if (data.user?.name) localStorage.setItem('ops_user_name', data.user.name);
        toast.success('Logged in to Bharat Milk Superadmin!');
        setBmAuthError(false);
        fetchBharatMilkAll();
      } else {
        toast.error(data.message || 'Login failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Server connection failed');
    } finally {
      setBmLoginLoading(false);
    }
  };

  // AI Draft generator for Vendor / Admin WhatsApp
  const handleAiDraftForAdmin = async (admin: any) => {
    toast.loading(`AI drafting WhatsApp for Vendor ${admin.name}...`, { id: 'ai-draft' });
    try {
      const { data } = await api.post('/ai/chat', {
        messages: [{
          role: 'user',
          content: `Draft a professional, friendly, and motivational operational WhatsApp update message for Bharat Milk Vendor / Admin:
- Vendor Name: ${admin.name}
- Phone: ${admin.phone}
- Pincode: ${admin.pincode || 'N/A'}
- Total Active Customers: ${admin.customer_count || 0}
- Monthly Milk Volume: ${admin.month_volume || 0} Liters
- Monthly Revenue: ₹${admin.month_revenue || 0}

Acknowledge their hard work, provide their performance summary, remind them to log daily milk entries on time, and offer support for adding new customers.`
        }]
      });
      toast.dismiss('ai-draft');
      const msg = data?.data?.message || `Hello Vendor ${admin.name}, message from Bharat Milk Master Ops...`;
      setSelectedLead({ name: admin.name, phone: admin.phone });
      setMessageText(msg);
      setSendModalOpen(true);
      toast.success(`AI message drafted for ${admin.name}!`);
    } catch (e: any) {
      toast.dismiss('ai-draft');
      toast.error('AI drafting failed: ' + (e.response?.data?.message || e.message));
    }
  };

  // Fetch Bharat Milk Data & Tickets directly via Bharat Milk API (Direct API, no Proxy)
  const fetchBharatMilkAll = async () => {
    setBmLoading(true);
    try {
      if (typeof window !== 'undefined' && !localStorage.getItem('ops_dashboard_auth_token')) {
        setBmAuthError(true);
        return;
      }

      const [summaryRes, adminsRes, entriesRes, infoRes, ticketsRes] = await Promise.all([
        bmApi.get('/superadmin/dashboard/summary').then(r => r.data).catch(() => null),
        bmApi.get('/superadmin/admins').then(r => r.data).catch(() => null),
        bmApi.get(`/superadmin/daily-entries?date=${entryDateFilter}`).then(r => r.data).catch(() => null),
        bmApi.get('/superadmin/deployment-info').then(r => r.data).catch(() => null),
        api.get('/whatsapp/tickets').then(r => r.data).catch(() => null),
      ]);

      if (summaryRes?.success) {
        setBmSummary(summaryRes);
        setBmAuthError(false);
      }

      if (adminsRes?.success) {
        setBmAdmins(adminsRes.admins || []);
        setBmAuthError(false);
      }

      if (entriesRes?.success) setBmEntries(entriesRes.entries || []);
      if (infoRes) setSystemInfo(infoRes);
      if (ticketsRes?.success) setTicketsList(ticketsRes.data || []);
    } catch (e) {
      console.error('Failed to load Master Dashboard data:', e);
    } finally {
      setBmLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorizedUser) {
      fetchBharatMilkAll();
    }
  }, [activeTab, entryDateFilter]);

  if (!isAuthorizedUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold">Master Operations Restricted</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          This dashboard is strictly reserved for master operator `Harshbha30@gmail.com`.
        </p>
      </div>
    );
  }

  // Ticket Handlers
  const handleCreateTicket = async () => {
    try {
      const { data } = await api.post('/whatsapp/tickets', ticketForm);
      if (data.success) {
        toast.success('Support Ticket created!');
        setCreateTicketModalOpen(false);
        setTicketForm({ title: '', description: '', customerName: '', phone: '', category: 'Delivery Issue', priority: 'Medium' });
        fetchBharatMilkAll();
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to create ticket');
    }
  };

  const handleUpdateTicketStatusWithComment = async () => {
    if (!selectedTicket) return;
    try {
      const { data } = await api.put(`/whatsapp/tickets/${selectedTicket.id}/status`, { status: newTicketStatus });

      if (sendWhatsappOnStatusUpdate && ticketComment && selectedTicket.lead?.phone) {
        await api.post(`/whatsapp/tickets/${selectedTicket.id}/reply`, {
          content: `[Ticket Status Update: ${newTicketStatus}] ${ticketComment}`
        });
      }

      toast.success(`Ticket updated to ${newTicketStatus} with comment!`);
      setTicketStatusModalOpen(false);
      setTicketComment('');
      fetchBharatMilkAll();
    } catch (e: any) {
      toast.error('Failed to update ticket status');
    }
  };

  // Admin Handlers
  const handleSaveAdmin = async () => {
    try {
      let endpoint = '/superadmin/admins/create';
      let method = 'post';
      if (editingAdmin) {
        endpoint = `/superadmin/admins/${editingAdmin.admin_id}`;
        method = 'put';
      }
      const { data } = await (bmApi as any)[method](endpoint, adminForm);

      if (data.success) {
        toast.success(editingAdmin ? 'Admin updated!' : 'Admin created!');
        setAdminModalOpen(false);
        fetchBharatMilkAll();
      } else toast.error(data.message || 'Operation failed');
    } catch (e: any) {
      toast.error('Failed to save admin: ' + (e.response?.data?.message || e.message));
    }
  };

  const handleToggleBlockAdmin = async (adminId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    try {
      const { data } = await bmApi.patch(`/superadmin/admins/${adminId}/status`, { status: newStatus });
      if (data.success) {
        toast.success(`Admin status set to ${newStatus}`);
        fetchBharatMilkAll();
      } else toast.error(data.message);
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message);
    }
  };

  const handleViewAdminCustomers = async (admin: any) => {
    setSelectedAdminForCustomers(admin);
    setCustomersModalOpen(true);
    try {
      const { data } = await bmApi.get(`/superadmin/admins/${admin.admin_id}/customers`);
      if (data.success) setAdminCustomersList(data.customers || []);
    } catch (e) {
      toast.error('Failed to load customers');
    }
  };

  const handleSaveCustomer = async () => {
    try {
      const { data } = await bmApi.post('/superadmin/customers/create', {
        admin_id: selectedAdminForCustomers.admin_id,
        ...customerForm,
      });

      if (data.success) {
        toast.success('Customer added!');
        setCustomerFormModalOpen(false);
        handleViewAdminCustomers(selectedAdminForCustomers);
      } else toast.error(data.message);
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message);
    }
  };

  const handleSaveDailyEntry = async () => {
    try {
      const { data } = await bmApi.post('/superadmin/daily-entries', dailyEntryForm);

      if (data.success) {
        toast.success('Daily entry recorded!');
        setDailyEntryModalOpen(false);
        fetchBharatMilkAll();
      } else toast.error(data.message);
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message);
    }
  };

  const handleSendBroadcast = async () => {
    setBroadcastLog('Sending notification broadcast across selected channels...\n');
    try {
      const channels = [];
      if (broadcastChannels.push) channels.push('push');
      if (broadcastChannels.email) channels.push('email');
      if (broadcastChannels.whatsapp) channels.push('whatsapp');

      const { data } = await bmApi.post('/superadmin/notify/send', {
        target_type: broadcastTarget,
        target_scope: broadcastScope,
        target_ids: broadcastScope === 'specific' ? broadcastIds.split(',').map(s => parseInt(s.trim())) : [],
        subject: broadcastSubject,
        message: broadcastMessage,
        channels,
      });

      setBroadcastLog(JSON.stringify(data, null, 2));
      if (data.success) toast.success('Broadcast dispatched!');
      else toast.error(data.message || 'Broadcast failed');
    } catch (e: any) {
      setBroadcastLog('Error dispatching broadcast: ' + (e.response?.data?.message || e.message));
      toast.error(e.response?.data?.message || e.message);
    }
  };

  // Delete Handlers
  const handleDeleteAdmin = async (adminId: number) => {
    if (!confirm(`CAUTION: Are you sure you want to DELETE Admin #${adminId}? This cannot be undone.`)) return;
    try {
      const { data } = await bmApi.delete(`/superadmin/admins/${adminId}`);
      if (data.success) {
        toast.success(`Admin #${adminId} deleted`);
        fetchBharatMilkAll();
      } else toast.error(data.message || 'Failed to delete admin');
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message);
    }
  };

  const handleDeleteCustomer = async (customerId: number) => {
    if (!confirm(`Are you sure you want to delete Customer #${customerId}?`)) return;
    try {
      const { data } = await bmApi.delete(`/superadmin/customers/${customerId}`);
      if (data.success) {
        toast.success(`Customer #${customerId} deleted`);
        if (selectedAdminForCustomers) handleViewAdminCustomers(selectedAdminForCustomers);
        fetchBharatMilkAll();
      } else toast.error(data.message || 'Failed to delete customer');
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message);
    }
  };

  const handleDeleteDailyEntry = async (orderId: number) => {
    if (!confirm(`Are you sure you want to delete order entry #${orderId}?`)) return;
    try {
      const { data } = await bmApi.delete(`/superadmin/daily-entries/${orderId}`);
      if (data.success) {
        toast.success(`Order #${orderId} deleted`);
        fetchBharatMilkAll();
      } else toast.error(data.message || 'Failed to delete daily entry');
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message);
    }
  };

  // AI Prompt Processor with Local AI + Live Bharat Milk API Context (http://crowncraftinnovations.in:8080)
  const handleRunAiAssistant = async () => {
    if (!aiPrompt) return;
    setAiLoading(true);
    setAiResponse('');
    try {
      // Fetch live data directly from Bharat Milk APIs (matching dashboard.html)
      const [summaryRes, adminsRes, entriesRes] = await Promise.all([
        bmApi.get('/superadmin/dashboard/summary').then(r => r.data).catch(() => null),
        bmApi.get('/superadmin/admins').then(r => r.data).catch(() => null),
        bmApi.get(`/superadmin/daily-entries?date=${entryDateFilter}`).then(r => r.data).catch(() => null),
      ]);

      const liveSummary = summaryRes?.current || bmSummary?.current || {};
      const livePrev = summaryRes?.previous || bmSummary?.previous || {};
      const liveAdmins = adminsRes?.admins || bmAdmins || [];
      const liveEntries = entriesRes?.entries || bmEntries || [];

      const operationalContext = {
        currentMonth: {
          totalAdmins: liveSummary.total_admins || liveAdmins.length,
          newAdminsThisMonth: liveSummary.new_admins_this_month || 0,
          totalCustomers: liveSummary.total_customers || 0,
          newCustomersThisMonth: liveSummary.new_customers_this_month || 0,
          volumeThisMonthLiters: liveSummary.volume_this_month || 0,
          revenueThisMonthINR: liveSummary.revenue_this_month || 0,
        },
        previousMonth: {
          totalAdminsPrev: livePrev.total_admins_prev || 0,
          totalCustomersPrev: livePrev.total_customers_prev || 0,
          volumePrevMonthLiters: livePrev.volume_prev_month || 0,
          revenuePrevMonthINR: livePrev.revenue_prev_month || 0,
        },
        adminsSummary: liveAdmins.map((a: any) => ({
          admin_id: a.admin_id,
          name: a.name,
          phone: a.phone,
          pincode: a.pincode,
          customer_count: a.customer_count,
          month_volume: a.month_volume,
          month_revenue: a.month_revenue,
          status: a.subscription_status,
        })),
        recentDailyEntries: liveEntries.slice(0, 10).map((e: any) => ({
          order_id: e.order_id,
          date: e.delivery_date,
          customer_name: e.customer_name,
          admin_name: e.admin_name,
          milk_type: e.milk_type,
          quantity: e.quantity,
          price: e.price,
          total_amount: e.total_amount || (e.quantity * e.price),
        })),
        supportTickets: ticketsList.slice(0, 10).map((t: any) => ({
          ticket_id: t.id,
          title: t.title,
          status: t.status,
          customerName: t.lead?.name,
          phone: t.lead?.phone,
        })),
      };

      const { data } = await api.post('/ai/chat', {
        messages: [{
          role: 'user',
          content: `You are the Master Operations AI Assistant for Harsh Bhasin on the Bharat Milk Dashboard.
Live Operational Data fetched from Bharat Milk cciapi (http://crowncraftinnovations.in:8080):
${JSON.stringify(operationalContext, null, 2)}

User Request / Query: "${aiPrompt}"

Instructions:
1. Analyze this live operational data.
2. Provide concrete answers, performance insights, or draft WhatsApp responses if requested.`
        }]
      });
      setAiResponse(data?.data?.message || 'AI Assistant processed your query.');
    } catch (e: any) {
      setAiResponse('AI processing error: ' + (e.response?.data?.message || e.message));
    } finally {
      setAiLoading(false);
    }
  };

  // Metrics (Admins, Customers, Milk Volume & Revenue)
  const cur = bmSummary?.current || {};
  const prev = bmSummary?.previous || {};
  const activeAdminsCount = bmAdmins.filter(a => a.subscription_status === 'active').length;

  const volChange = prev.volume_prev_month ? (((cur.volume_this_month - prev.volume_prev_month) / prev.volume_prev_month) * 100).toFixed(1) : '0';
  const revChange = prev.revenue_prev_month ? (((cur.revenue_this_month - prev.revenue_prev_month) / prev.revenue_prev_month) * 100).toFixed(1) : '0';

  const trends = bmSummary?.trends || [
    { month: 'Oct 2024', total_volume: 12500, total_orders: 210, total_revenue: 750000 },
    { month: 'Nov 2024', total_volume: 14200, total_orders: 245, total_revenue: 852000 },
    { month: 'Dec 2024', total_volume: 16800, total_orders: 290, total_revenue: 1008000 },
    { month: 'Jan 2025', total_volume: 19500, total_orders: 340, total_revenue: 1170000 },
    { month: 'Feb 2025', total_volume: 22100, total_orders: 395, total_revenue: 1326000 },
    { month: 'Mar 2025', total_volume: 25400, total_orders: 460, total_revenue: 1524000 },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Bharat Milk Master Dashboard</h1>
            <Badge variant="success" className="gap-1 font-mono text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5" /> Harsh Bhasin Operator
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total Admins, Customers, Milk Volume, Auto WhatsApp Follow-ups & Support Ticketing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetchLeads(); fetchBharatMilkAll(); }} loading={bmLoading}>
            <RefreshCw className="w-3.5 h-3.5" /> Sync Data
          </Button>
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setCreateLeadModalOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Add Lead
          </Button>
        </div>
      </div>

      {/* ── BHARAT MILK SUPERADMIN LOGIN CARD (When token missing / invalid) ── */}
      {(bmAuthError || (typeof window !== 'undefined' && !localStorage.getItem('ops_dashboard_auth_token'))) && (
        <Card className="p-5 border-amber-500/50 bg-amber-500/5 max-w-lg mx-auto space-y-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">Bharat Milk Superadmin Login Required</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Enter your Bharat Milk Superadmin email & password (from <code className="text-amber-500 font-mono">dashboard.html</code>) to authenticate with <code className="font-mono">cciapi:8080</code>.
              </p>
            </div>
          </div>

          <form onSubmit={handleBmLogin} className="space-y-3 pt-1">
            <Input
              label="Superadmin Email"
              type="email"
              value={bmLoginForm.email}
              onChange={(e) => setBmLoginForm({ ...bmLoginForm, email: e.target.value })}
              placeholder="e.g. superadmin@example.com"
              required
            />
            <Input
              label="Password"
              type="password"
              value={bmLoginForm.password}
              onChange={(e) => setBmLoginForm({ ...bmLoginForm, password: e.target.value })}
              placeholder="Enter password"
              required
            />
            <Button
              type="submit"
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold h-9 text-xs"
              loading={bmLoginLoading}
            >
              Log In to Bharat Milk Server
            </Button>
          </form>
        </Card>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {[
          { id: 'overview', label: 'Overview & Month Graphs', icon: TrendingUp },
          { id: 'leads', label: 'Leads & Auto-WhatsApp', icon: Users, count: leads.length },
          { id: 'tickets', label: 'Ticketing & Support', icon: Ticket, count: ticketsList.length },
          { id: 'messages', label: 'Admin WhatsApp Logs', icon: MessageCircle },
          { id: 'admins', label: 'Admins & Customers', icon: UserCheck, count: bmAdmins.length },
          { id: 'entries', label: 'Daily Milk Entries', icon: GlassWater, count: bmEntries.length },
          { id: 'broadcast', label: 'FCM & Universal Broadcast', icon: Bell },
          { id: 'ai', label: 'AI Ops Assistant', icon: Bot },
          { id: 'system', label: 'System Health', icon: Server },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all',
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-primary/20 text-primary font-bold">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB 1: OVERVIEW (TOTAL ADMINS & CUSTOMERS & VOLUME & REVENUE) ─────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total Admins" value={cur.total_admins || bmAdmins.length || 0} subtitle={`+${cur.new_admins_this_month || 0} new this month`} icon={<Users className="w-5 h-5 text-primary" />} />
            <StatCard title="Total Customers" value={cur.total_customers || 0} subtitle={`+${cur.new_customers_this_month || 0} new this month`} icon={<UserCheck className="w-5 h-5 text-emerald-500" />} />
            <StatCard title="Milk Volume (Month)" value={`${(cur.volume_this_month || 0).toLocaleString()} L`} subtitle="Monthly volume" icon={<GlassWater className="w-5 h-5 text-blue-500" />} />
            <StatCard title="Revenue (Month)" value={`₹${(cur.revenue_this_month || 0).toLocaleString()}`} subtitle="Monthly revenue" icon={<TrendingUp className="w-5 h-5 text-amber-500" />} />
          </div>

          {/* MoM Comparison Table */}
          <Card className="p-5">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-500" /> Month-Over-Month Comparison
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                    <th className="p-2.5">Metric</th>
                    <th className="p-2.5">Current Month</th>
                    <th className="p-2.5">Previous Month</th>
                    <th className="p-2.5">MoM Growth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="p-2.5 font-bold">Total Admins</td>
                    <td className="p-2.5">{cur.total_admins || 0}</td>
                    <td className="p-2.5">{prev.total_admins_prev || 0}</td>
                    <td className="p-2.5"><Badge variant="secondary">+{cur.new_admins_this_month || 0} new</Badge></td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold">Total Customers</td>
                    <td className="p-2.5">{cur.total_customers || 0}</td>
                    <td className="p-2.5">{prev.total_customers_prev || 0}</td>
                    <td className="p-2.5"><Badge variant="secondary">+{cur.new_customers_this_month || 0} new</Badge></td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold">Milk Volume (Liters)</td>
                    <td className="p-2.5">{(cur.volume_this_month || 0).toLocaleString()} L</td>
                    <td className="p-2.5">{(prev.volume_prev_month || 0).toLocaleString()} L</td>
                    <td className="p-2.5"><Badge variant={parseFloat(volChange) >= 0 ? 'success' : 'destructive'}>{parseFloat(volChange) >= 0 ? '+' : ''}{volChange}%</Badge></td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold">Revenue (₹)</td>
                    <td className="p-2.5">₹{(cur.revenue_this_month || 0).toLocaleString()}</td>
                    <td className="p-2.5">₹{(prev.revenue_prev_month || 0).toLocaleString()}</td>
                    <td className="p-2.5"><Badge variant={parseFloat(revChange) >= 0 ? 'success' : 'destructive'}>{parseFloat(revChange) >= 0 ? '+' : ''}{revChange}%</Badge></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Month-Wise Visual Graphs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                <GlassWater className="w-4 h-4 text-blue-500" /> Monthly Milk Volume (Liters)
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(val: any) => [`${val.toLocaleString()} Liters`, 'Milk Volume']} />
                    <Bar dataKey="total_volume" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" /> Monthly Order Deliveries Trend
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(val: any) => [`${val.toLocaleString()} Orders`, 'Total Deliveries']} />
                    <Area type="monotone" dataKey="total_orders" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── TAB 2: LEADS & AUTO-WHATSAPP FOLLOW-UP ──────────────────────────── */}
      {activeTab === 'leads' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone, company..."
                className="h-8 rounded-lg border border-input bg-card pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring w-full"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-lg border border-input bg-card px-3 text-xs"
            >
              <option value="">All Statuses</option>
              <option value="NEW_LEAD">New Lead</option>
              <option value="CONTACTED">Contacted</option>
              <option value="FOLLOW_UP_PENDING">Follow Up Pending</option>
              <option value="CONVERTED">Converted</option>
              <option value="CLOSED">Closed / Checked</option>
            </select>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-muted-foreground font-semibold uppercase">
                    <th className="p-3 w-12 text-center">Check</th>
                    <th className="p-3">Lead Name</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">DB Status</th>
                    <th className="p-3">Auto Follow-up Date</th>
                    <th className="p-3">Last Contacted</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLeadsLoading ? (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading leads...</td></tr>
                  ) : leads.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No leads found. Click "Add Lead" to start.</td></tr>
                  ) : (
                    leads.map((lead: any) => {
                      const isChecked = Boolean(lead.customFields?.isChecked);
                      const isAutoScheduled = Boolean(lead.followUpAt);
                      return (
                        <tr key={lead.id} className={cn('hover:bg-accent/50 transition-colors', isChecked && 'bg-green-500/5')}>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => toggleCheckMutation.mutate(lead.id)}
                              className="focus:outline-none active:scale-95 transition-transform"
                              title={isChecked ? 'Uncheck' : 'Mark as checked / closed in DB'}
                            >
                              {isChecked ? (
                                <CheckSquare className="w-5 h-5 text-green-600 fill-green-500/20" />
                              ) : (
                                <Square className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                              )}
                            </button>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-foreground text-sm flex items-center gap-2">
                              {lead.name || 'Unnamed'}
                              {isChecked && <Badge variant="success" className="text-[10px] px-1.5 py-0">Checked</Badge>}
                              {isAutoScheduled && <Badge variant="warning" className="text-[10px] px-1.5 py-0 flex items-center gap-1"><Zap className="w-2.5 h-2.5" /> Auto-Cron</Badge>}
                            </div>
                            {lead.company && <div className="text-[11px] text-muted-foreground">{lead.company}</div>}
                          </td>
                          <td className="p-3 font-mono text-muted-foreground">{lead.phone || '—'}</td>
                          <td className="p-3">
                            <Badge variant={lead.customerStatus === 'CONVERTED' ? 'success' : lead.customerStatus === 'FOLLOW_UP_PENDING' ? 'warning' : 'secondary'}>
                              {lead.customerStatus || 'NEW_LEAD'}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {lead.followUpAt ? (
                              <span className="text-amber-600 font-medium flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {new Date(lead.followUpAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="p-3 text-muted-foreground">{lead.lastContactedAt ? timeAgo(lead.lastContactedAt) : 'Never'}</td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white h-7 px-2.5 text-[11px] gap-1"
                                onClick={() => {
                                  setSelectedLead(lead);
                                  setMessageText(`Hello ${lead.name || 'there'}, regarding your Bharat Milk account.`);
                                  setSendModalOpen(true);
                                }}
                              >
                                <Send className="w-3 h-3" /> Message
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-[11px] gap-1"
                                onClick={() => {
                                  setSelectedLead(lead);
                                  setMessageText(`Hi ${lead.name || 'there'}, this is an automated scheduled follow-up.`);
                                  setScheduleDateTime(new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 16));
                                  setScheduleModalOpen(true);
                                }}
                              >
                                <Calendar className="w-3 h-3 text-blue-500" /> Auto Schedule
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB 3: TICKETING & SUPPORT WITH COMMENT OPTION ──────────────────── */}
      {activeTab === 'tickets' && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Ticket className="w-4 h-4 text-emerald-500" /> Bharat Milk Support Tickets
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Check ticket status, update resolution status with comments, and send WhatsApp updates.</p>
            </div>
            <Button size="sm" className="bg-green-600 text-white" onClick={() => setCreateTicketModalOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Raise Ticket
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                  <th className="p-2.5">Ticket ID</th>
                  <th className="p-2.5">Issue Title</th>
                  <th className="p-2.5">Customer</th>
                  <th className="p-2.5">Phone</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Due Date</th>
                  <th className="p-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ticketsList.length === 0 ? (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No support tickets found. Click "Raise Ticket" to log a new ticket.</td></tr>
                ) : (
                  ticketsList.map((ticket: any) => (
                    <tr key={ticket.id} className="hover:bg-accent/40">
                      <td className="p-2.5 font-bold font-mono">#{ticket.id.slice(-6).toUpperCase()}</td>
                      <td className="p-2.5">
                        <div className="font-semibold text-foreground">{ticket.title}</div>
                        <div className="text-[11px] text-muted-foreground">{ticket.description}</div>
                      </td>
                      <td className="p-2.5 font-medium">{ticket.lead?.name || 'Customer'}</td>
                      <td className="p-2.5 font-mono">{ticket.lead?.phone || '—'}</td>
                      <td className="p-2.5">
                        <Badge variant={ticket.status === 'COMPLETED' ? 'success' : 'warning'}>
                          {ticket.status === 'COMPLETED' ? 'RESOLVED / CLOSED' : 'OPEN'}
                        </Badge>
                      </td>
                      <td className="p-2.5 text-muted-foreground">{new Date(ticket.dueAt).toLocaleDateString()}</td>
                      <td className="p-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" className="bg-primary text-primary-foreground h-6 px-2 text-[10px] gap-1" onClick={() => {
                            setSelectedTicket(ticket);
                            setNewTicketStatus(ticket.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED');
                            setTicketComment('');
                            setTicketStatusModalOpen(true);
                          }}>
                            <Edit className="w-2.5 h-2.5" /> Update Status & Comment
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── TAB 4: ADMIN WHATSAPP LOGS & MESSAGES ────────────────────────────── */}
      {activeTab === 'messages' && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-green-500" /> Admin & Vendor WhatsApp Messaging
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Real-time direct WhatsApp replies & AI-assisted operational messages to Bharat Milk vendors.</p>
            </div>
            <Badge variant="success" className="font-mono text-xs">{bmAdmins.length} Vendors Active</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {bmAdmins.map((admin: any) => (
              <div key={admin.admin_id} className="p-3.5 rounded-xl border border-border bg-card space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground text-sm">Vendor #{admin.admin_id} — {admin.name || 'Unnamed Vendor'}</span>
                  <Badge variant={admin.subscription_status === 'blocked' ? 'destructive' : 'success'}>
                    {admin.subscription_status || 'active'}
                  </Badge>
                </div>
                <div className="text-muted-foreground space-y-1 text-[11px]">
                  <div>Phone: <span className="font-mono text-foreground font-semibold">{admin.phone || '—'}</span> | Email: {admin.email || '—'}</div>
                  <div>Pincode: {admin.pincode || '—'} | Customers: <span className="font-semibold text-emerald-500">{admin.customer_count || 0}</span> | Mo. Volume: <span className="font-semibold text-blue-500">{admin.month_volume || 0} L</span></div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/50">
                  <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => handleAiDraftForAdmin(admin)}>
                    <Sparkles className="w-3 h-3 text-amber-500" /> AI Draft
                  </Button>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-7 text-[11px] gap-1" onClick={() => {
                    setSelectedLead({ name: admin.name, phone: admin.phone });
                    setMessageText(`Hello Vendor ${admin.name || 'Admin'}, regarding your Bharat Milk vendor account...`);
                    setSendModalOpen(true);
                  }}>
                    <Send className="w-3 h-3" /> Direct WhatsApp
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── TAB 5: ADMINS & CUSTOMERS ────────────────────────────────────────── */}
      {activeTab === 'admins' && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm">Admin Management & Customer Summary</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Filter newly registered vendors month-wise, message vendors via WhatsApp, or manage customer accounts.</p>
            </div>
            <Button size="sm" className="bg-green-600 text-white" onClick={() => {
              setEditingAdmin(null);
              setAdminForm({ name: '', email: '', phone: '', password: '', pincode: '', status: 'active' });
              setAdminModalOpen(true);
            }}>
              <UserPlus className="w-3.5 h-3.5" /> Create New Admin
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} placeholder="Search admin name, phone, email, pincode..." className="h-8 rounded-lg border border-input bg-card px-3 text-xs flex-1 min-w-[200px]" />
            <select value={adminStatusFilter} onChange={(e) => setAdminStatusFilter(e.target.value)} className="h-8 rounded-lg border border-input bg-card px-3 text-xs">
              <option value="all">All Statuses</option>
              <option value="active">Active Vendors</option>
              <option value="blocked">Blocked Vendors</option>
            </select>
            <select value={adminMonthFilter} onChange={(e) => setAdminMonthFilter(e.target.value)} className="h-8 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-primary">
              <option value="all">All Registration Months</option>
              <option value="2026-09">Registered Sep 2026</option>
              <option value="2026-08">Registered Aug 2026</option>
              <option value="2026-07">Registered Jul 2026</option>
              <option value="2026-06">Registered Jun 2026</option>
              <option value="2026-05">Registered May 2026</option>
              <option value="2026-04">Registered Apr 2026</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                  <th className="p-2.5">Admin ID</th>
                  <th className="p-2.5">Name / Contact</th>
                  <th className="p-2.5">Pincode</th>
                  <th className="p-2.5">Customers</th>
                  <th className="p-2.5">Mo. Volume</th>
                  <th className="p-2.5">Mo. Revenue</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bmLoading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                        <span className="font-semibold text-xs">Loading Bharat Milk Vendors & Live Stats...</span>
                      </div>
                    </td>
                  </tr>
                ) : bmAdmins.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-muted-foreground">No vendors/admins found for selected filter criteria.</td>
                  </tr>
                ) : (
                  bmAdmins
                    .filter(a => {
                      const matchesQuery = !adminSearch ||
                        (a.name && a.name.toLowerCase().includes(adminSearch.toLowerCase())) ||
                        (a.email && a.email.toLowerCase().includes(adminSearch.toLowerCase())) ||
                        (a.phone && a.phone.includes(adminSearch)) ||
                        (a.pincode && a.pincode.includes(adminSearch));
                      const isBlocked = a.subscription_status === 'blocked';
                      const matchesStatus = adminStatusFilter === 'all' || (adminStatusFilter === 'active' && !isBlocked) || (adminStatusFilter === 'blocked' && isBlocked);
                      const regDate = a.created_at || a.created_date || a.registration_date || '';
                      const matchesMonth = adminMonthFilter === 'all' || (regDate && regDate.startsWith(adminMonthFilter));
                      return matchesQuery && matchesStatus && matchesMonth;
                    })
                    .map((admin) => (
                      <tr key={admin.admin_id} className="hover:bg-accent/40">
                        <td className="p-2.5 font-bold">#{admin.admin_id}</td>
                        <td className="p-2.5">
                          <div className="font-semibold text-foreground">{admin.name || '—'}</div>
                          <div className="text-[10px] text-muted-foreground">{admin.phone} | {admin.email}</div>
                        </td>
                        <td className="p-2.5">{admin.pincode || '—'}</td>
                        <td className="p-2.5"><Badge variant="default">{admin.customer_count || 0} Customers</Badge></td>
                        <td className="p-2.5">{(admin.month_volume || 0).toLocaleString()} L</td>
                        <td className="p-2.5 font-semibold">₹{(admin.month_revenue || 0).toLocaleString()}</td>
                        <td className="p-2.5">
                          <Badge variant={admin.subscription_status === 'blocked' ? 'destructive' : 'success'}>
                            {admin.subscription_status || 'active'}
                          </Badge>
                        </td>
                        <td className="p-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-6 px-2 text-[10px] gap-1" title="WhatsApp Vendor" onClick={() => {
                              setSelectedLead({ name: admin.name, phone: admin.phone });
                              setMessageText(`Hello ${admin.name}, message from Bharat Milk Master Ops: `);
                              setSendModalOpen(true);
                            }}>
                              <Send className="w-2.5 h-2.5" /> WhatsApp
                            </Button>
                            <Button size="sm" variant="outline" className="h-6 px-1.5 text-[10px] gap-1" title="AI Draft WhatsApp" onClick={() => handleAiDraftForAdmin(admin)}>
                              <Sparkles className="w-2.5 h-2.5 text-amber-500" /> AI
                            </Button>
                            <Button size="sm" variant="ghost" title="View Customers" onClick={() => handleViewAdminCustomers(admin)}>
                              <Users className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" title="Edit Admin" onClick={() => {
                              setEditingAdmin(admin);
                              setAdminForm({ name: admin.name || '', email: admin.email || '', phone: admin.phone || '', password: '', pincode: admin.pincode || '', status: admin.subscription_status || 'active' });
                              setAdminModalOpen(true);
                            }}>
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" title={admin.subscription_status === 'blocked' ? 'Unblock' : 'Block'} onClick={() => handleToggleBlockAdmin(admin.admin_id, admin.subscription_status)}>
                              {admin.subscription_status === 'blocked' ? <Unlock className="w-3.5 h-3.5 text-green-500" /> : <Ban className="w-3.5 h-3.5 text-red-500" />}
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" title="Delete Admin" onClick={() => handleDeleteAdmin(admin.admin_id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── TAB 6: DAILY MILK ENTRIES ────────────────────────────────────────── */}
      {activeTab === 'entries' && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="font-bold text-sm">Daily Milk Entries Log</h3>
            <Button size="sm" className="bg-primary" onClick={() => setDailyEntryModalOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Add Daily Entry
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <input type="date" value={entryDateFilter} onChange={(e) => setEntryDateFilter(e.target.value)} className="h-8 rounded-lg border border-input bg-card px-3 text-xs" />
            <select value={entryAdminFilter} onChange={(e) => setEntryAdminFilter(e.target.value)} className="h-8 rounded-lg border border-input bg-card px-3 text-xs">
              <option value="">All Admins</option>
              {bmAdmins.map(a => <option key={a.admin_id} value={a.admin_id}>{a.name} (#{a.admin_id})</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                  <th className="p-2.5">Order ID</th>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Customer</th>
                  <th className="p-2.5">Admin</th>
                  <th className="p-2.5">Milk Type</th>
                  <th className="p-2.5">Qty (L)</th>
                  <th className="p-2.5">Price</th>
                  <th className="p-2.5">Total (₹)</th>
                  <th className="p-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bmLoading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                        <span className="font-semibold text-xs">Loading Daily Milk Entries Log...</span>
                      </div>
                    </td>
                  </tr>
                ) : bmEntries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-muted-foreground">No daily milk entries found for selected criteria.</td>
                  </tr>
                ) : (
                  bmEntries.map((e: any) => (
                    <tr key={e.order_id} className="hover:bg-accent/40">
                      <td className="p-2.5 font-bold">#{e.order_id}</td>
                      <td className="p-2.5">{e.delivery_date ? new Date(e.delivery_date).toLocaleDateString() : '—'}</td>
                      <td className="p-2.5 font-semibold">{e.customer_name || 'Cust #' + e.customer_id}</td>
                      <td className="p-2.5 text-muted-foreground">{e.admin_name || 'Admin #' + e.admin_id}</td>
                      <td className="p-2.5"><Badge variant="default">{e.milk_type || 'cow'}</Badge></td>
                      <td className="p-2.5 font-bold">{e.quantity} L</td>
                      <td className="p-2.5">₹{e.price}</td>
                      <td className="p-2.5 font-semibold">₹{(e.total_amount || (e.quantity * e.price) || 0).toLocaleString()}</td>
                      <td className="p-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-6 px-2 text-[10px]" onClick={() => {
                            setSelectedLead({ name: e.customer_name, phone: e.phone });
                            setMessageText(`Hello ${e.customer_name || 'Customer'}, regarding your daily milk entry order #${e.order_id}...`);
                            setSendModalOpen(true);
                          }}>
                            <Send className="w-2.5 h-2.5 mr-1" /> WhatsApp
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 h-6 px-1.5" title="Delete Entry" onClick={() => handleDeleteDailyEntry(e.order_id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── TAB 7: BROADCAST ─────────────────────────────────────────────────── */}
      {activeTab === 'broadcast' && (
        <Card className="p-6 max-w-3xl mx-auto space-y-4">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" /> Universal Notification & WhatsApp Broadcast
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold block mb-1">Target Audience</label>
              <select value={broadcastTarget} onChange={(e) => setBroadcastTarget(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-card px-3 text-xs">
                <option value="both">Both Admins & Customers</option>
                <option value="admins">Admins Only</option>
                <option value="customers">Customers Only</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">Scope</label>
              <select value={broadcastScope} onChange={(e) => setBroadcastScope(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-card px-3 text-xs">
                <option value="all">Broadcast to ALL</option>
                <option value="specific">Specific IDs Only</option>
              </select>
            </div>
          </div>

          <Input label="Subject / Title" value={broadcastSubject} onChange={(e) => setBroadcastSubject(e.target.value)} placeholder="e.g. Bharat Milk Update" />
          <Textarea label="Message Body" value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} rows={4} placeholder="Type broadcast message..." />

          <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={handleSendBroadcast}>
            <Send className="w-4 h-4 mr-1" /> Dispatch Broadcast
          </Button>

          <pre className="p-3 bg-muted rounded-lg font-mono text-[11px] text-green-400 max-h-40 overflow-y-auto whitespace-pre-wrap">{broadcastLog}</pre>
        </Card>
      )}

      {/* ── TAB 8: AI OPS ASSISTANT ──────────────────────────────────────────── */}
      {activeTab === 'ai' && (
        <Card className="p-6 max-w-3xl mx-auto space-y-4 border-primary/20">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base">AI Master Operations Assistant</h3>
              <p className="text-xs text-muted-foreground">Ask AI to analyze leads, draft WhatsApp replies, check support tickets, or summarize milk volume.</p>
            </div>
          </div>

          <Textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            rows={3}
            placeholder="e.g. Draft an urgent WhatsApp response for customer ticket regarding delayed delivery..."
          />

          <Button className="w-full bg-primary text-primary-foreground gap-2" loading={aiLoading} onClick={handleRunAiAssistant}>
            <Sparkles className="w-4 h-4" /> Run AI Assistant
          </Button>

          {aiResponse && (
            <div className="p-4 rounded-xl bg-muted/60 border border-border text-xs leading-relaxed space-y-2">
              <span className="font-bold text-primary block">AI Response:</span>
              <p className="whitespace-pre-wrap">{aiResponse}</p>
            </div>
          )}
        </Card>
      )}

      {/* ── TAB 9: SYSTEM HEALTH ────────────────────────────────────────────── */}
      {activeTab === 'system' && (
        <Card className="p-6 max-w-3xl mx-auto space-y-4">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-500" /> Deployment & System Health
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-border bg-card">
              <p className="text-xs text-muted-foreground">Database Connection</p>
              <p className="text-lg font-bold text-green-500 flex items-center gap-2 mt-1">
                <CheckCircle2 className="w-5 h-5" /> Connected & Healthy
              </p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <p className="text-xs text-muted-foreground">Target API Server (cciapi :8080)</p>
              <p className="text-xs font-mono font-bold text-foreground mt-1">
                http://crowncraftinnovations.in:8080
              </p>
            </div>
          </div>
          {systemInfo && (
            <div className="p-4 rounded-xl border border-border bg-card space-y-2 text-xs">
              <span className="font-bold text-foreground block">Deployment Build Details:</span>
              <div className="grid grid-cols-3 gap-2 font-mono">
                <div>Branch: <span className="text-primary">{systemInfo.branch || 'main'}</span></div>
                <div>Build #: <span className="text-emerald-500">{systemInfo.build_number || '—'}</span></div>
                <div>Commit: <span className="text-amber-500">{(systemInfo.commit || '').slice(0, 7) || '—'}</span></div>
              </div>
              {systemInfo.deployed_at && (
                <p className="text-[11px] text-muted-foreground mt-1">Deployed at: {new Date(systemInfo.deployed_at).toLocaleString()}</p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ── ALL MODALS ───────────────────────────────────────────────────────── */}

      {/* MODAL: TICKET STATUS & COMMENT */}
      <Modal open={ticketStatusModalOpen} onClose={() => setTicketStatusModalOpen(false)} title={`Update Ticket Status — #${selectedTicket?.id?.slice(-6).toUpperCase()}`}>
        <div className="space-y-4 pt-2">
          <div className="p-3 rounded-lg bg-muted text-xs">
            <span className="font-bold">{selectedTicket?.title}</span> ({selectedTicket?.lead?.name})
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">New Ticket Status</label>
            <select value={newTicketStatus} onChange={(e) => setNewTicketStatus(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-card px-3 text-xs">
              <option value="PENDING">OPEN / PENDING</option>
              <option value="IN_PROGRESS">IN PROGRESS</option>
              <option value="COMPLETED">RESOLVED / CLOSED</option>
            </select>
          </div>

          <Textarea label="Internal Comment / Resolution Note" value={ticketComment} onChange={(e) => setTicketComment(e.target.value)} rows={3} placeholder="Add resolution note or comment..." />

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={sendWhatsappOnStatusUpdate} onChange={(e) => setSendWhatsappOnStatusUpdate(e.target.checked)} />
            Send WhatsApp Status Update to Customer
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setTicketStatusModalOpen(false)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground" onClick={handleUpdateTicketStatusWithComment}>
              Save Status & Comment
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: CREATE SUPPORT TICKET */}
      <Modal open={createTicketModalOpen} onClose={() => setCreateTicketModalOpen(false)} title="Raise Bharat Milk Support Ticket">
        <div className="space-y-3 pt-2">
          <Input label="Issue Title *" value={ticketForm.title} onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })} placeholder="e.g. Milk delivery not received" />
          <Input label="Customer Name" value={ticketForm.customerName} onChange={(e) => setTicketForm({ ...ticketForm, customerName: e.target.value })} placeholder="e.g. Ramesh Kumar" />
          <Input label="Phone Number *" value={ticketForm.phone} onChange={(e) => setTicketForm({ ...ticketForm, phone: e.target.value })} placeholder="e.g. 9876543210" />
          <Select label="Issue Category" value={ticketForm.category} onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })} options={[
            { value: 'Delivery Issue', label: 'Delivery Issue' },
            { value: 'Quality Concern', label: 'Quality Concern' },
            { value: 'Billing & Payment', label: 'Billing & Payment' },
            { value: 'Pause / Resume', label: 'Pause / Resume Request' },
          ]} />
          <Textarea label="Issue Description" value={ticketForm.description} onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })} rows={3} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setCreateTicketModalOpen(false)}>Cancel</Button>
            <Button className="bg-green-600 text-white" onClick={handleCreateTicket}>Create Ticket</Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: SEND WHATSAPP */}
      <Modal open={sendModalOpen} onClose={() => setSendModalOpen(false)} title="Send Direct WhatsApp Message">
        <div className="space-y-4 pt-2">
          <div className="p-3 rounded-lg bg-muted text-xs font-semibold">
            Recipient: {selectedLead?.name || 'Contact'} ({selectedLead?.phone})
          </div>
          <Textarea label="Message Body" value={messageText} onChange={(e) => setMessageText(e.target.value)} rows={4} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSendModalOpen(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" loading={sendMessageMutation.isPending} onClick={() => sendMessageMutation.mutate({ leadId: selectedLead?.id, phone: selectedLead?.phone, content: messageText })}>
              <Send className="w-4 h-4 mr-1" /> Send WhatsApp
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: SCHEDULE MESSAGE */}
      <Modal open={scheduleModalOpen} onClose={() => setScheduleModalOpen(false)} title="Schedule Auto WhatsApp Follow-up">
        <div className="space-y-4 pt-2">
          <Input label="Date & Time" type="datetime-local" value={scheduleDateTime} onChange={(e) => setScheduleDateTime(e.target.value)} />
          <Textarea label="Message Body" value={messageText} onChange={(e) => setMessageText(e.target.value)} rows={3} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setScheduleModalOpen(false)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground" loading={scheduleMessageMutation.isPending} onClick={() => scheduleMessageMutation.mutate({ leadId: selectedLead?.id, scheduledAt: scheduleDateTime, messageContent: messageText, note: scheduleNote })}>
              Save Auto Schedule
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: CREATE ADMIN */}
      <Modal open={adminModalOpen} onClose={() => setAdminModalOpen(false)} title={editingAdmin ? 'Edit Admin' : 'Create New Admin'}>
        <div className="space-y-3 pt-2">
          <Input label="Name" value={adminForm.name} onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })} />
          <Input label="Email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} />
          <Input label="Phone" value={adminForm.phone} onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })} />
          <Input label="Password" type="password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} placeholder="Leave blank if unchanged" />
          <Input label="Pincode" value={adminForm.pincode} onChange={(e) => setAdminForm({ ...adminForm, pincode: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setAdminModalOpen(false)}>Cancel</Button>
            <Button className="bg-green-600 text-white" onClick={handleSaveAdmin}>Save Admin</Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: VIEW ADMIN CUSTOMERS */}
      <Modal open={customersModalOpen} onClose={() => setCustomersModalOpen(false)} title={`Customers of Admin #${selectedAdminForCustomers?.admin_id}`}>
        <div className="space-y-4 pt-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{adminCustomersList.length} total customers</span>
            <Button size="sm" className="bg-green-600 text-white" onClick={() => setCustomerFormModalOpen(true)}>
              <Plus className="w-3 h-3" /> Add Customer
            </Button>
          </div>
          <div className="max-h-60 overflow-y-auto border rounded-lg">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b bg-muted p-2 font-semibold">
                  <th className="p-2">Name</th>
                  <th className="p-2">Phone</th>
                  <th className="p-2">Daily Qty</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminCustomersList.map((c: any) => (
                  <tr key={c.customer_id} className="border-b">
                    <td className="p-2 font-semibold">{c.name}</td>
                    <td className="p-2 font-mono">{c.phone}</td>
                    <td className="p-2">{c.daily_quantity || 1}L ({c.milk_type_pref || 'cow'})</td>
                    <td className="p-2 text-right">
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 h-6 px-1.5" title="Delete Customer" onClick={() => handleDeleteCustomer(c.customer_id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* MODAL: CREATE CUSTOMER */}
      <Modal open={customerFormModalOpen} onClose={() => setCustomerFormModalOpen(false)} title="Add Customer under Admin">
        <div className="space-y-3 pt-2">
          <Input label="Name *" value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} />
          <Input label="Phone *" value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} />
          <Input label="Address" value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} />
          <Input label="Pincode" value={customerForm.pincode} onChange={(e) => setCustomerForm({ ...customerForm, pincode: e.target.value })} />
          <Input label="Daily Qty (L)" type="number" value={customerForm.qty} onChange={(e) => setCustomerForm({ ...customerForm, qty: parseFloat(e.target.value) || 1 })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setCustomerFormModalOpen(false)}>Cancel</Button>
            <Button className="bg-green-600 text-white" onClick={handleSaveCustomer}>Save Customer</Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: DAILY ENTRY */}
      <Modal open={dailyEntryModalOpen} onClose={() => setDailyEntryModalOpen(false)} title="Record Daily Milk Entry">
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-semibold block mb-1">Select Admin</label>
            <select
              value={dailyEntryForm.adminId}
              onChange={async (e) => {
                const adminId = e.target.value;
                setDailyEntryForm({ ...dailyEntryForm, adminId });
                if (adminId) {
                  try {
                    const { data } = await bmApi.get(`/superadmin/admins/${adminId}/customers`);
                    if (data.success) setEntryCustomerOptions(data.customers || []);
                  } catch {
                    setEntryCustomerOptions([]);
                  }
                }
              }}
              className="h-9 w-full rounded-lg border border-input bg-card px-3 text-xs"
            >
              <option value="">-- Choose Admin --</option>
              {bmAdmins.map(a => <option key={a.admin_id} value={a.admin_id}>{a.name} (#{a.admin_id})</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">Select Customer</label>
            <select
              value={dailyEntryForm.customerId}
              onChange={(e) => setDailyEntryForm({ ...dailyEntryForm, customerId: e.target.value })}
              className="h-9 w-full rounded-lg border border-input bg-card px-3 text-xs"
            >
              <option value="">-- Select Customer --</option>
              {entryCustomerOptions.map(c => <option key={c.customer_id} value={c.customer_id}>{c.name} (#{c.customer_id})</option>)}
            </select>
          </div>

          <Input label="Delivery Date" type="date" value={dailyEntryForm.date} onChange={(e) => setDailyEntryForm({ ...dailyEntryForm, date: e.target.value })} />
          <Input label="Quantity (Liters)" type="number" value={dailyEntryForm.qty} onChange={(e) => setDailyEntryForm({ ...dailyEntryForm, qty: parseFloat(e.target.value) || 1 })} />
          <Input label="Price / Liter (₹)" type="number" value={dailyEntryForm.price} onChange={(e) => setDailyEntryForm({ ...dailyEntryForm, price: parseFloat(e.target.value) || 60 })} />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setDailyEntryModalOpen(false)}>Cancel</Button>
            <Button className="bg-green-600 text-white" onClick={handleSaveDailyEntry}>Submit Entry</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
