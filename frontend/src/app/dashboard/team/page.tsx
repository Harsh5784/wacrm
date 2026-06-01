'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { Button, Card, CardContent, Input, Modal, Badge, Skeleton } from '@/components/ui';
import { initials, timeAgo } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';
import { CheckCircle, Download, MessageSquare, TrendingUp, UserPlus, UserCheck, UserX, Mail, Clock, Trash2 } from 'lucide-react';

const ROLES = [
  { value: 'ADMIN', label: 'Admin', desc: 'Full access' },
  { value: 'MANAGER', label: 'Manager', desc: 'Manage leads & campaigns' },
  { value: 'MEMBER', label: 'Member', desc: 'View and add leads' },
];

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  ADMIN: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  MANAGER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  MEMBER: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export default function TeamPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [days, setDays] = useState('30');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [form, setForm] = useState({ name: '', email: '', role: 'MEMBER' });
  const rangeQuery = fromDate || toDate
    ? `from=${fromDate}&to=${toDate || new Date().toISOString().slice(0, 10)}`
    : `days=${days}`;

  const { data, isLoading } = useQuery({
    queryKey: ['team'],
    queryFn: async () => { const { data } = await api.get('/team'); return data.data; },
  });

  const { data: performance, isLoading: performanceLoading } = useQuery({
    queryKey: ['team-performance', days, fromDate, toDate],
    queryFn: async () => {
      const { data } = await api.get(`/team/performance?${rangeQuery}`);
      return data.data;
    },
  });

  const inviteMutation = useMutation({
    mutationFn: () => api.post('/team/invite', form),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success(`Invited! Temp password: ${res.data.data.tempPassword}`);
      setInviteOpen(false);
      setForm({ name: '', email: '', role: 'MEMBER' });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to invite'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => api.put(`/team/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['team'] }); toast.success('Updated'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/team/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success('Team member removed');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to remove member'),
  });

  const members = data || [];

  const downloadPerformanceReport = async () => {
    try {
      const response = await api.get(`/team/performance/report?${rangeQuery}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = fromDate || toDate ? `team-performance-${fromDate || 'start'}-${toDate || 'today'}.pdf` : `team-performance-${days}-days.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to download report');
    }
  };

  if (user?.role === 'MEMBER') {
    return (
      <Card>
        <CardContent className="p-8 text-sm text-muted-foreground">
          Team performance is available to admins and managers only.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{members.length} team members</p>
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <UserPlus className="w-4 h-4" /> Invite Member
        </Button>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Team Performance</h3>
              <p className="text-xs text-muted-foreground">Closed deals, replies, follow-ups, and work activity by executive.</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <select value={days} onChange={(e) => setDays(e.target.value)} className="h-9 rounded-lg border border-input bg-card px-3 text-sm">
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last 1 year</option>
              </select>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 rounded-lg border border-input bg-card px-3 text-sm" />
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 rounded-lg border border-input bg-card px-3 text-sm" />
              {(fromDate || toDate) && (
                <Button size="sm" variant="ghost" onClick={() => { setFromDate(''); setToDate(''); }}>
                  Clear dates
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={downloadPerformanceReport}>
                <Download className="w-3.5 h-3.5" />
                PDF Report
              </Button>
            </div>
          </div>
          {performanceLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground">Executive</th>
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground">Assigned</th>
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground">Closed Deals</th>
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground">Sent</th>
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground">Replies</th>
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground">Follow-Ups</th>
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground">Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {(performance?.members || []).map((member: any) => (
                    <tr key={member.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <p className="font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.role}</p>
                      </td>
                      <td className="px-3 py-2">{member.metrics.assignedLeads}</td>
                      <td className="px-3 py-2">
                        <div>
                          <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                            <CheckCircle className="w-3.5 h-3.5" />
                            {member.metrics.closedDeals}
                          </span>
                          {member.metrics.closedDealDetails?.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {member.metrics.closedDealDetails.slice(0, 3).map((deal: any) => (
                                <div key={deal.id} className="text-[11px] text-muted-foreground">
                                  <span className="font-medium text-foreground">{deal.name}</span>
                                  {deal.company && <span> · {deal.company}</span>}
                                  {deal.package && <span> · Package: {deal.package}</span>}
                                  {deal.dealValue && <span> · ₹{Number(deal.dealValue).toLocaleString('en-IN')}</span>}
                                  <span> · Started {new Date(deal.startedAt).toLocaleDateString()}</span>
                                  <span> · Closed {new Date(deal.closedAt).toLocaleDateString()}</span>
                                </div>
                              ))}
                              {member.metrics.closedDealDetails.length > 3 && (
                                <div className="text-[11px] text-muted-foreground">+{member.metrics.closedDealDetails.length - 3} more closed deals</div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                          {member.metrics.sentMessages}
                        </span>
                      </td>
                      <td className="px-3 py-2">{member.metrics.receivedMessages}</td>
                      <td className="px-3 py-2">{member.metrics.followUps}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                          {member.metrics.activities}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : (
        <div className="grid gap-3">
          {members.map((member: any, i: number) => (
            <motion.div key={member.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full gradient-brand flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {initials(member.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{member.name}</p>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${ROLE_COLORS[member.role]}`}>
                          {member.role}
                        </span>
                        {!member.isActive && (
                          <span className="px-2 py-0.5 rounded-md text-xs bg-red-100 text-red-700 dark:bg-red-900/30">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" />{member.email}
                        </span>
                        {member.lastLoginAt && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />Last seen {timeAgo(member.lastLoginAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select
                        value={member.role}
                        onChange={e => updateMutation.mutate({ id: member.id, data: { role: e.target.value } })}
                        className="h-8 rounded-lg border border-input bg-card px-2 text-xs focus:outline-none"
                      >
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                      <Button
                        size="sm"
                        variant={member.isActive ? 'outline' : 'default'}
                        onClick={() => updateMutation.mutate({ id: member.id, data: { isActive: !member.isActive } })}
                        className={member.isActive ? 'text-red-500 hover:bg-red-50' : ''}
                      >
                        {member.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        {member.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.confirm(`Remove ${member.name} from the team?`) && deleteMutation.mutate(member.id)}
                        className="text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Invite Modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite Team Member" size="sm">
        <div className="p-6 space-y-4">
          <Input label="Full Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Priya Sharma" />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="priya@company.com" />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Role</label>
            <div className="space-y-2">
              {ROLES.map(role => (
                <label key={role.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  form.role === role.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}>
                  <input type="radio" name="role" value={role.value} checked={form.role === role.value}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="mt-0.5 accent-primary" />
                  <div>
                    <p className="text-sm font-medium">{role.label}</p>
                    <p className="text-xs text-muted-foreground">{role.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
          <Button loading={inviteMutation.isPending} disabled={!form.name || !form.email} onClick={() => inviteMutation.mutate()}>
            Send Invite
          </Button>
        </div>
      </Modal>
    </div>
  );
}
