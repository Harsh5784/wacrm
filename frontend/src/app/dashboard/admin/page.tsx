'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Building2, CreditCard, Download, RefreshCw, Shield, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Button, Card, CardContent, Input, Skeleton, Textarea } from '@/components/ui';

const PLANS = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'];

export default function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [plan, setPlan] = useState('PROFESSIONAL');
  const [planExpiry, setPlanExpiry] = useState('');
  const [reason, setReason] = useState('');
  const [limits, setLimits] = useState({
    scraperMaxResults: 250,
    campaignDailyLimit: 50,
    campaignMinDelay: 22,
    campaignMaxDelay: 55,
    campaignBatchSize: 20,
    campaignBatchPauseMinutes: 12,
    maxCampaigns: 0,
  });
  const [allowLeadExport, setAllowLeadExport] = useState(true);
  const [pricing, setPricing] = useState({ STARTER: 99900, PROFESSIONAL: 249900, ENTERPRISE: 999900 });

  const orgsQuery = useQuery({
    queryKey: ['billing-admin-organizations'],
    queryFn: async () => {
      const { data } = await api.get('/billing/admin/organizations');
      return data.data;
    },
    enabled: authUser?.role === 'SUPER_ADMIN',
  });

  const updatePlanMutation = useMutation({
    mutationFn: () => api.put(`/billing/admin/organizations/${selectedOrgId}/plan`, {
      plan,
      planExpiry: planExpiry || null,
      reason: reason || 'Manual super admin plan change',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-admin-organizations'] });
      toast.success('Organization plan updated');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Plan update failed'),
  });

  const usersQuery = useQuery({
    queryKey: ['admin-org-users', selectedOrgId],
    queryFn: async () => {
      const { data } = await api.get(`/billing/admin/organizations/${selectedOrgId}/users`);
      return data.data;
    },
    enabled: Boolean(selectedOrgId) && authUser?.role === 'SUPER_ADMIN',
  });

  const updateSettingsMutation = useMutation({
    mutationFn: () => api.put(`/billing/admin/organizations/${selectedOrgId}/settings`, {
      limits,
      features: { allowLeadExport },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-admin-organizations'] });
      toast.success('Limits updated');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to update limits'),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, payload }: any) => api.put(`/billing/admin/users/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-org-users', selectedOrgId] });
      toast.success('User updated');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to update user'),
  });

  const updatePricingMutation = useMutation({
    mutationFn: () => api.put('/billing/admin/pricing', pricing),
    onSuccess: () => toast.success('Pricing updated'),
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to update pricing'),
  });

  const orgs = orgsQuery.data || [];
  const selectedOrg = orgs.find((org: any) => org.id === selectedOrgId);

  useEffect(() => {
    if (!selectedOrgId && orgs.length > 0) setSelectedOrgId(orgs[0].id);
  }, [orgs, selectedOrgId]);

  useEffect(() => {
    if (!selectedOrg) return;
    setPlan(selectedOrg.plan || 'FREE');
    setPlanExpiry(selectedOrg.planExpiry ? new Date(selectedOrg.planExpiry).toISOString().slice(0, 10) : '');
    const selectedLimits = selectedOrg.settings?.limits || {};
    setLimits({
      scraperMaxResults: Number(selectedLimits.scraperMaxResults || 250),
      campaignDailyLimit: Number(selectedLimits.campaignDailyLimit || 50),
      campaignMinDelay: Number(selectedLimits.campaignMinDelay || 22),
      campaignMaxDelay: Number(selectedLimits.campaignMaxDelay || 55),
      campaignBatchSize: Number(selectedLimits.campaignBatchSize || 20),
      campaignBatchPauseMinutes: Number(selectedLimits.campaignBatchPauseMinutes || 12),
      maxCampaigns: Number(selectedLimits.maxCampaigns || 0),
    });
    setAllowLeadExport(selectedOrg.settings?.features?.allowLeadExport !== false);
  }, [selectedOrg?.id]);

  if (authUser?.role !== 'SUPER_ADMIN') {
    return (
      <Card>
        <CardContent className="p-8 text-sm text-muted-foreground">
          Super admin access required.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Super Admin</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage organizations, plans, usage, and manual billing changes.</p>
        </div>
        <Button variant="outline" onClick={() => orgsQuery.refetch()}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {orgsQuery.isLoading ? (
        <div className="grid gap-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_26rem] gap-5">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground">Organization</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground">Plan</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground">Users</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground">Leads</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground">Campaigns</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgs.map((org: any) => (
                      <tr
                        key={org.id}
                        onClick={() => setSelectedOrgId(org.id)}
                        className={`border-t border-border cursor-pointer hover:bg-muted/40 ${selectedOrgId === org.id ? 'bg-primary/5' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                              {org.logo ? <img src={org.logo} alt={org.name} className="w-full h-full object-cover" /> : <Building2 className="w-4 h-4 text-muted-foreground" />}
                            </div>
                            <div>
                              <p className="font-medium">{org.name}</p>
                              <p className="text-xs text-muted-foreground">{org.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">{org.plan}</td>
                        <td className="px-4 py-3">{org._count?.users || 0}</td>
                        <td className="px-4 py-3">{org._count?.leads || 0}</td>
                        <td className="px-4 py-3">{org._count?.campaigns || 0}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(org.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold">Plan Control</h3>
              {selectedOrg && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <Users className="w-4 h-4 text-muted-foreground mb-1" />
                    <p className="text-lg font-semibold">{selectedOrg._count?.users || 0}</p>
                    <p className="text-xs text-muted-foreground">Users</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <Building2 className="w-4 h-4 text-muted-foreground mb-1" />
                    <p className="text-lg font-semibold">{selectedOrg._count?.leads || 0}</p>
                    <p className="text-xs text-muted-foreground">Leads</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <CreditCard className="w-4 h-4 text-muted-foreground mb-1" />
                    <p className="text-lg font-semibold">{selectedOrg._count?.payments || 0}</p>
                    <p className="text-xs text-muted-foreground">Payments</p>
                  </div>
                </div>
              )}
              <select value={plan} onChange={(e) => setPlan(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm">
                {PLANS.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
              <Input label="Plan Expiry" type="date" value={planExpiry} onChange={(e) => setPlanExpiry(e.target.value)} />
              <Textarea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Trial extension, manual upgrade, enterprise contract..." />
              <Button className="w-full" loading={updatePlanMutation.isPending} disabled={!selectedOrgId} onClick={() => updatePlanMutation.mutate()}>
                Save Plan
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedOrg && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">Org Limits</h3>
              </div>
              {[
                ['Scraper max results', 'scraperMaxResults'],
                ['Campaign daily limit', 'campaignDailyLimit'],
                ['Min delay seconds', 'campaignMinDelay'],
                ['Max delay seconds', 'campaignMaxDelay'],
                ['Batch size', 'campaignBatchSize'],
                ['Batch pause minutes', 'campaignBatchPauseMinutes'],
                ['Max campaigns (0 = unlimited)', 'maxCampaigns'],
              ].map(([label, key]) => (
                <Input
                  key={key}
                  label={label}
                  type="number"
                  value={(limits as any)[key]}
                  onChange={(e) => setLimits((current) => ({ ...current, [key]: Number(e.target.value) }))}
                />
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allowLeadExport}
                  onChange={(e) => setAllowLeadExport(e.target.checked)}
                  className="accent-primary"
                />
                Allow lead export/download
              </label>
              <Button className="w-full" loading={updateSettingsMutation.isPending} onClick={() => updateSettingsMutation.mutate()}>
                Save Limits
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">Users</h3>
              </div>
              <div className="space-y-2 max-h-[32rem] overflow-y-auto scrollbar-thin">
                {(usersQuery.data || []).map((user: any) => (
                  <div key={user.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <span className={`rounded-md px-2 py-0.5 text-xs ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <select
                        value={user.role}
                        onChange={(e) => updateUserMutation.mutate({ id: user.id, payload: { role: e.target.value } })}
                        className="h-8 flex-1 rounded-lg border border-input bg-card px-2 text-xs"
                      >
                        {['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MEMBER'].map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                      <Button
                        size="sm"
                        variant={user.isActive ? 'outline' : 'default'}
                        onClick={() => updateUserMutation.mutate({ id: user.id, payload: { isActive: !user.isActive } })}
                      >
                        {user.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">Pricing</h3>
              </div>
              <Input label="Starter price paise" type="number" value={pricing.STARTER} onChange={(e) => setPricing((p) => ({ ...p, STARTER: Number(e.target.value) }))} />
              <Input label="Professional price paise" type="number" value={pricing.PROFESSIONAL} onChange={(e) => setPricing((p) => ({ ...p, PROFESSIONAL: Number(e.target.value) }))} />
              <Input label="Enterprise price paise" type="number" value={pricing.ENTERPRISE} onChange={(e) => setPricing((p) => ({ ...p, ENTERPRISE: Number(e.target.value) }))} />
              <Button className="w-full" loading={updatePricingMutation.isPending} onClick={() => updatePricingMutation.mutate()}>
                Save Pricing
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
