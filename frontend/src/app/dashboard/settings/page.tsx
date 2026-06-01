'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Button, Card, CardContent, Input, Skeleton, Textarea } from '@/components/ui';
import toast from 'react-hot-toast';
import { User, Building2, Lock, MessageSquare, QrCode, RefreshCw, Trash2, Bot, Upload, CreditCard, ExternalLink } from 'lucide-react';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'organization', label: 'Organization', icon: Building2 },
  { id: 'ai', label: 'AI & Business', icon: Bot },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'security', label: 'Security', icon: Lock },
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const fetchMe = useAuthStore((state) => state.fetchMe);
  const authUser = useAuthStore((state) => state.user);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState('profile');
  const [sessionName, setSessionName] = useState('Main WhatsApp');

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => { const { data } = await api.get('/settings'); return data.data; },
  });

  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });
  const [orgForm, setOrgForm] = useState({ name: '', logo: '' });
  const [businessForm, setBusinessForm] = useState({
    category: '',
    description: '',
    whatWeDo: '',
    services: '',
    products: '',
    pricing: '',
    salesPitch: '',
    workingHours: '',
    supportDetails: '',
  });
  const [aiForm, setAiForm] = useState({ geminiApiKey: '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [manualPlan, setManualPlan] = useState('PROFESSIONAL');
  const [manualOrgId, setManualOrgId] = useState('');
  const [manualPlanExpiry, setManualPlanExpiry] = useState('');
  const [manualPlanReason, setManualPlanReason] = useState('');
  const [checkoutPlan, setCheckoutPlan] = useState('');

  const profileMutation = useMutation({
    mutationFn: () => api.put('/settings/profile', profileForm),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); fetchMe(); toast.success('Profile updated!'); },
  });

  const orgMutation = useMutation({
    mutationFn: () => api.put('/settings/organization', {
      ...orgForm,
      settings: {
        ...(data?.organization?.settings || {}),
        businessProfile: businessForm,
        ai: {
          ...((data?.organization?.settings as any)?.ai || {}),
          geminiApiKey: aiForm.geminiApiKey || undefined,
        },
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      fetchMe();
      toast.success('Organization updated!');
    },
  });

  const logoUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('image', file);
      const uploadRes = await api.post('/settings/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const url = uploadRes.data.data.url;
      await api.put('/settings/organization', {
        ...orgForm,
        logo: url,
        settings: {
          ...(data?.organization?.settings || {}),
          businessProfile: businessForm,
          ai: {
            ...((data?.organization?.settings as any)?.ai || {}),
            geminiApiKey: aiForm.geminiApiKey || undefined,
          },
        },
      });
      return url;
    },
    onSuccess: (url) => {
      setOrgForm((form) => ({ ...form, logo: url }));
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      fetchMe();
      toast.success('Logo updated');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Logo upload failed'),
  });

  const validateAiMutation = useMutation({
    mutationFn: () => api.post('/settings/ai/validate-key', { apiKey: aiForm.geminiApiKey }),
    onSuccess: () => toast.success('Gemini API key is valid'),
    onError: (e: any) => toast.error(e.response?.data?.message || 'Gemini API key validation failed'),
  });

  const pwMutation = useMutation({
    mutationFn: () => {
      if (pwForm.newPassword !== pwForm.confirm) throw new Error('Passwords do not match');
      return api.put('/settings/password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
    },
    onSuccess: () => { toast.success('Password updated!'); setPwForm({ currentPassword: '', newPassword: '', confirm: '' }); },
    onError: (e: any) => toast.error(e.message || e.response?.data?.message || 'Failed'),
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['whatsapp-sessions'],
    queryFn: async () => { const { data } = await api.get('/whatsapp/sessions'); return data.data; },
    refetchInterval: tab === 'whatsapp' ? 3000 : false,
  });

  const createSessionMutation = useMutation({
    mutationFn: () => api.post('/whatsapp/sessions', { name: sessionName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-sessions'] });
      toast.success('WhatsApp session started. Scan the QR code.');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to start WhatsApp session'),
  });

  const reconnectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/whatsapp/sessions/${id}/reconnect`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-sessions'] });
      toast.success('Reconnect started');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to reconnect'),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/whatsapp/sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-sessions'] });
      toast.success('Session deleted');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to delete session'),
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: async () => { const { data } = await api.get('/billing/plans'); return data.data; },
    enabled: tab === 'billing',
  });
  const { data: payments = [] } = useQuery({
    queryKey: ['billing-payments'],
    queryFn: async () => { const { data } = await api.get('/billing/payments'); return data.data; },
    enabled: tab === 'billing',
  });
  const { data: adminOrganizations = [] } = useQuery({
    queryKey: ['billing-admin-organizations'],
    queryFn: async () => { const { data } = await api.get('/billing/admin/organizations'); return data.data; },
    enabled: tab === 'billing' && authUser?.role === 'SUPER_ADMIN',
  });
  const planOverrideMutation = useMutation({
    mutationFn: () => api.put(`/billing/admin/organizations/${manualOrgId}/plan`, {
      plan: manualPlan,
      planExpiry: manualPlanExpiry || null,
      reason: manualPlanReason || 'Manual super admin change',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-admin-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      fetchMe();
      toast.success('Plan updated');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Plan update failed'),
  });

  const loadRazorpay = () => new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  const handlePlanCheckout = async (plan: string) => {
    try {
      setCheckoutPlan(plan);
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error('Razorpay checkout failed to load');
      const orderRes = await api.post('/billing/orders', { plan });
      const { keyId, order } = orderRes.data.data;
      const checkout = new window.Razorpay({
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: org.name || 'WACrm Pro',
        description: `${plan} plan`,
        order_id: order.id,
        handler: async (response: any) => {
          await api.post('/billing/verify', response);
          queryClient.invalidateQueries({ queryKey: ['billing-payments'] });
          queryClient.invalidateQueries({ queryKey: ['settings'] });
          fetchMe();
          toast.success('Payment verified and plan updated');
        },
        prefill: {
          name: user.name,
          email: user.email,
        },
        theme: { color: '#16a34a' },
      });
      checkout.open();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Razorpay checkout failed');
    } finally {
      setCheckoutPlan('');
    }
  };

  useEffect(() => {
    if (!data?.organization) return;
    const settings = data.organization.settings || {};
    setOrgForm({ name: data.organization.name || '', logo: data.organization.logo || '' });
    setBusinessForm((current) => ({ ...current, ...(settings.businessProfile || {}) }));
    setAiForm({ geminiApiKey: settings.ai?.geminiApiKey || '' });
    if (data.user) setProfileForm({ name: data.user.name || '', phone: data.user.phone || '' });
  }, [data?.organization]);

  useEffect(() => {
    if (!manualOrgId && adminOrganizations.length > 0) {
      setManualOrgId(adminOrganizations[0].id);
      setManualPlan(adminOrganizations[0].plan || 'PROFESSIONAL');
    }
  }, [adminOrganizations, manualOrgId]);

  if (isLoading) return (
    <div className="space-y-4">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
  );

  const user = data?.user || {};
  const org = data?.organization || {};

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account and organization settings</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold">Profile Information</h3>
              <Input
                label="Full Name"
                value={profileForm.name}
                onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                placeholder={user.name}
              />
              <Input label="Email" defaultValue={user.email} disabled className="opacity-60" />
              <Input
                label="Phone"
                value={profileForm.phone}
                onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+91 98765 43210"
              />
              <Button loading={profileMutation.isPending} onClick={() => profileMutation.mutate()}>
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {tab === 'organization' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold">Organization Details</h3>
              <div className="p-3 rounded-xl bg-muted/50 text-sm">
                <span className="text-muted-foreground">Current Plan: </span>
                <span className="font-semibold text-primary">{org.plan}</span>
              </div>
              <Input
                label="Organization Name"
                value={orgForm.name}
                onChange={e => setOrgForm(f => ({ ...f, name: e.target.value }))}
              />
              <div className="space-y-2">
                <label className="text-sm font-medium">Organization Logo</label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-lg border border-border bg-muted overflow-hidden flex items-center justify-center">
                    {orgForm.logo ? <img src={orgForm.logo} alt="Organization logo" className="w-full h-full object-cover" /> : <Building2 className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && logoUploadMutation.mutate(e.target.files[0])}
                  />
                  <Button variant="outline" loading={logoUploadMutation.isPending} onClick={() => logoInputRef.current?.click()}>
                    <Upload className="w-4 h-4" />
                    Upload Logo
                  </Button>
                  {orgForm.logo && (
                    <Button variant="outline" onClick={() => setOrgForm(f => ({ ...f, logo: '' }))}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              <Button loading={orgMutation.isPending} onClick={() => orgMutation.mutate()}>
                Update Organization
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {tab === 'ai' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold">Business Profile for AI</h3>
              <Input label="Business Category" value={businessForm.category} onChange={e => setBusinessForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Dairy software, Real estate, Healthcare" />
              <Textarea label="Company Description" value={businessForm.description} onChange={e => setBusinessForm(f => ({ ...f, description: e.target.value }))} />
              <Textarea label="What the Business Does" value={businessForm.whatWeDo} onChange={e => setBusinessForm(f => ({ ...f, whatWeDo: e.target.value }))} />
              <Textarea label="Services Offered" value={businessForm.services} onChange={e => setBusinessForm(f => ({ ...f, services: e.target.value }))} />
              <Textarea label="Products Offered" value={businessForm.products} onChange={e => setBusinessForm(f => ({ ...f, products: e.target.value }))} />
              <Textarea label="Pricing" value={businessForm.pricing} onChange={e => setBusinessForm(f => ({ ...f, pricing: e.target.value }))} />
              <Textarea label="Sales Pitch" value={businessForm.salesPitch} onChange={e => setBusinessForm(f => ({ ...f, salesPitch: e.target.value }))} />
              <Input label="Working Hours" value={businessForm.workingHours} onChange={e => setBusinessForm(f => ({ ...f, workingHours: e.target.value }))} placeholder="Mon-Sat, 10 AM - 7 PM" />
              <Textarea label="Support Details" value={businessForm.supportDetails} onChange={e => setBusinessForm(f => ({ ...f, supportDetails: e.target.value }))} />
              <Button loading={orgMutation.isPending} onClick={() => orgMutation.mutate()}>
                Save Business Profile
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold">Organization Gemini Key</h3>
              <p className="text-sm text-muted-foreground">Use a custom Gemini API key for this organization. If empty, the system key is used.</p>
              <Input
                label="Gemini API Key"
                type="password"
                value={aiForm.geminiApiKey}
                onChange={e => setAiForm({ geminiApiKey: e.target.value })}
                placeholder="AIza..."
              />
              <div className="flex gap-2">
                <Button variant="outline" loading={validateAiMutation.isPending} disabled={!aiForm.geminiApiKey} onClick={() => validateAiMutation.mutate()}>
                  Validate Key
                </Button>
                <Button loading={orgMutation.isPending} onClick={() => orgMutation.mutate()}>
                  Save AI Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {tab === 'whatsapp' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">WhatsApp Web Sessions</h3>
                  <p className="text-sm text-muted-foreground mt-1">Connect WhatsApp Web before starting campaigns.</p>
                </div>
                <Button
                  loading={createSessionMutation.isPending}
                  onClick={() => createSessionMutation.mutate()}
                  className="shrink-0"
                >
                  Add Session
                </Button>
              </div>

              <Input
                label="Session Name"
                value={sessionName}
                onChange={e => setSessionName(e.target.value)}
                placeholder="Main WhatsApp"
              />

              <div className="space-y-3">
                {sessions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center">
                    <QrCode className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No WhatsApp session connected yet.</p>
                  </div>
                ) : sessions.map((session: any) => {
                  const qrImage = session.qrCode
                    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(session.qrCode)}`
                    : '';

                  return (
                    <div key={session.id} className="rounded-xl border border-border p-4 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{session.name}</p>
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                              session.status === 'CONNECTED'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : session.status === 'SCANNING'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            }`}>
                              {session.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {session.phone ? `+${session.phone}` : 'Phone not connected'} · {session.messagesSent || 0} sent
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => reconnectMutation.mutate(session.id)}
                            className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
                            title="Reconnect"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          {session.qrCode && (
                            <button
                              onClick={() => window.open(qrImage, '_blank', 'width=420,height=520')}
                              className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
                              title="Open QR"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteSessionMutation.mutate(session.id)}
                            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {qrImage && (
                        <div className="flex items-center gap-4 rounded-xl bg-muted/40 p-4">
                          <img src={qrImage} alt="WhatsApp login QR code" className="w-36 h-36 rounded-lg bg-white p-2" />
                          <div className="text-sm text-muted-foreground">
                            Open WhatsApp on your phone, tap Linked devices, then scan this QR code.
                            <div className="mt-3">
                              <Button size="sm" variant="outline" onClick={() => window.open(qrImage, '_blank', 'width=420,height=520')}>
                                <ExternalLink className="w-3.5 h-3.5" />
                                Open QR Window
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {tab === 'billing' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold">Plans</h3>
              <div className="grid gap-3">
                {plans.map((plan: any) => (
                  <div key={plan.plan} className="rounded-xl border border-border p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{plan.plan}</p>
                      <p className="text-xs text-muted-foreground">{plan.features?.join(' · ')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{plan.amount ? `₹${(plan.amount / 100).toLocaleString('en-IN')}` : 'Free'}</p>
                      {plan.amount > 0 && (
                        <Button size="sm" variant="outline" loading={checkoutPlan === plan.plan} onClick={() => handlePlanCheckout(plan.plan)}>
                          Pay
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold">Payment History</h3>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground">Plan</th>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground">Amount</th>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground">Status</th>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p: any) => (
                      <tr key={p.id} className="border-t border-border">
                        <td className="px-3 py-2">{p.plan}</td>
                        <td className="px-3 py-2">₹{(p.amount / 100).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2">{p.status}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                    {payments.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No payments yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {user.role === 'SUPER_ADMIN' && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold">Super Admin Plan Manager</h3>
                <Link href="/dashboard/admin" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                  Open full super admin dashboard <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                <select
                  value={manualOrgId}
                  onChange={(e) => {
                    const org = adminOrganizations.find((item: any) => item.id === e.target.value);
                    setManualOrgId(e.target.value);
                    if (org?.plan) setManualPlan(org.plan);
                    setManualPlanExpiry(org?.planExpiry ? new Date(org.planExpiry).toISOString().slice(0, 10) : '');
                  }}
                  className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm"
                >
                  {adminOrganizations.map((orgItem: any) => (
                    <option key={orgItem.id} value={orgItem.id}>
                      {orgItem.name} · {orgItem.plan} · {orgItem._count?.users || 0} users
                    </option>
                  ))}
                </select>
                <select value={manualPlan} onChange={(e) => setManualPlan(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm">
                  {['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'].map(plan => <option key={plan} value={plan}>{plan}</option>)}
                </select>
                <Input
                  label="Plan Expiry"
                  type="date"
                  value={manualPlanExpiry}
                  onChange={(e) => setManualPlanExpiry(e.target.value)}
                />
                <Textarea
                  label="Reason"
                  value={manualPlanReason}
                  onChange={(e) => setManualPlanReason(e.target.value)}
                  placeholder="Manual upgrade, trial extension, enterprise contract..."
                />
                <Button
                  loading={planOverrideMutation.isPending}
                  disabled={!manualOrgId}
                  onClick={() => planOverrideMutation.mutate()}
                >
                  Update Organization Plan
                </Button>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {tab === 'security' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold">Change Password</h3>
              <Input
                label="Current Password"
                type="password"
                value={pwForm.currentPassword}
                onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
              />
              <Input
                label="New Password"
                type="password"
                value={pwForm.newPassword}
                onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
              />
              <Input
                label="Confirm New Password"
                type="password"
                value={pwForm.confirm}
                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                error={pwForm.confirm && pwForm.confirm !== pwForm.newPassword ? 'Passwords do not match' : undefined}
              />
              <Button
                loading={pwMutation.isPending}
                disabled={!pwForm.currentPassword || !pwForm.newPassword || pwForm.newPassword !== pwForm.confirm}
                onClick={() => pwMutation.mutate()}
              >
                Update Password
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
