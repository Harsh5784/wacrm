'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { formatNumber, CAMPAIGN_STATUS_COLORS } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent, StatCard, Badge, Skeleton } from '@/components/ui';
import { format } from 'date-fns';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, MessageSquare, Users, CheckCircle, BarChart3 } from 'lucide-react';

const PERIODS = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30d');

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', period],
    queryFn: async () => {
      const { data } = await api.get(`/analytics?period=${period}`);
      return data.data;
    },
  });

  const { data: dashData } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/dashboard');
      return data.data;
    },
  });

  const stats = dashData?.overview;

  const dailyData = (data?.dailyData || []).map((d: any) => ({
    date: format(new Date(d.date), period === '90d' ? 'MMM d' : 'MMM d'),
    sent: d.messagesSent,
    delivered: d.messagesDelivered,
    failed: d.messagesFailed,
    replies: d.repliesReceived,
    leads: d.newLeads,
    won: d.wonLeads,
  }));

  const topCampaigns = data?.campaignPerformance || [];

  const deliveryPie = stats ? [
    { name: 'Delivered', value: stats.messagesDelivered, color: '#22c55e' },
    { name: 'Failed', value: stats.messagesFailed, color: '#ef4444' },
    { name: 'Pending', value: Math.max(0, stats.messagesSent - stats.messagesDelivered - stats.messagesFailed), color: '#f59e0b' },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track your performance metrics</p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-muted rounded-xl">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                period === p.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <StatCard title="Messages Sent" value={formatNumber(stats?.messagesSent || 0)} icon={<MessageSquare className="w-5 h-5 text-blue-600" />} iconBg="bg-blue-100 dark:bg-blue-900/30" />
            <StatCard title="Delivery Rate" value={stats?.messagesSent > 0 ? `${((stats.messagesDelivered / stats.messagesSent) * 100).toFixed(1)}%` : '—'} icon={<CheckCircle className="w-5 h-5 text-green-600" />} iconBg="bg-green-100 dark:bg-green-900/30" />
            <StatCard title="Reply Rate" value={stats?.messagesDelivered > 0 ? `${((stats.totalReplied / stats.messagesDelivered) * 100).toFixed(1)}%` : '—'} icon={<TrendingUp className="w-5 h-5 text-violet-600" />} iconBg="bg-violet-100 dark:bg-violet-900/30" />
            <StatCard title="Total Leads" value={formatNumber(stats?.totalLeads || 0)} change={`+${stats?.newLeadsWeek || 0} this week`} changeType="positive" icon={<Users className="w-5 h-5 text-amber-600" />} iconBg="bg-amber-100 dark:bg-amber-900/30" />
          </>
        )}
      </div>

      {/* Main chart */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Message Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-64" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="gSent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gReplies" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="sent" stroke="#22c55e" fill="url(#gSent)" strokeWidth={2} name="Sent" />
                  <Area type="monotone" dataKey="replies" stroke="#8b5cf6" fill="url(#gReplies)" strokeWidth={2} name="Replies" />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* New leads bar chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">New Leads Per Day</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-48" /> : (
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="leads" fill="#3b82f6" radius={[4, 4, 0, 0]} name="New Leads" />
                    <Bar dataKey="won" fill="#22c55e" radius={[4, 4, 0, 0]} name="Won" />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Delivery donut */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Delivery Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading || deliveryPie.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={deliveryPie} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                        {deliveryPie.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {deliveryPie.map((item: any) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-medium">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Top campaigns */}
      {topCampaigns.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-xs text-muted-foreground font-medium">Campaign</th>
                      <th className="text-right py-2 text-xs text-muted-foreground font-medium">Sent</th>
                      <th className="text-right py-2 text-xs text-muted-foreground font-medium">Delivered</th>
                      <th className="text-right py-2 text-xs text-muted-foreground font-medium">Replied</th>
                      <th className="text-right py-2 text-xs text-muted-foreground font-medium">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCampaigns.map((c: any) => (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{c.name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-xs ${CAMPAIGN_STATUS_COLORS[c.status]}`}>{c.status}</span>
                          </div>
                        </td>
                        <td className="py-3 text-right">{c.totalSent}</td>
                        <td className="py-3 text-right text-green-600">{c.totalDelivered}</td>
                        <td className="py-3 text-right text-violet-600">{c.totalReplied}</td>
                        <td className="py-3 text-right font-medium">
                          {c.totalDelivered > 0 ? `${((c.totalReplied / c.totalDelivered) * 100).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
