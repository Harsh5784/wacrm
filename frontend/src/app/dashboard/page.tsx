'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { formatNumber, timeAgo, STAGE_COLORS, STAGE_LABELS } from '@/lib/utils';
import { StatCard, Card, CardHeader, CardTitle, CardContent, Badge, Skeleton } from '@/components/ui';
import { useAuthStore } from '@/store/auth.store';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';
import { format } from 'date-fns';
import {
  Users, MessageSquare, TrendingUp, Zap,
  CheckCircle, Clock, AlertCircle, Activity, Flame, UserCheck,
} from 'lucide-react';

const STAGE_PIE_COLORS = ['#94a3b8', '#3b82f6', '#8b5cf6', '#f59e0b', '#f97316', '#22c55e', '#ef4444', '#64748b'];

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/dashboard');
      return data.data;
    },
    refetchInterval: 30000,
  });

  const stats = data?.overview;
  const dailyData = (data?.dailyAnalytics || []).map((d: any) => ({
    date: format(new Date(d.date), 'MMM d'),
    sent: d.messagesSent,
    delivered: d.messagesDelivered,
    replies: d.repliesReceived,
    leads: d.newLeads,
  }));

  const stageData = (data?.leadsByStage || []).map((s: any) => ({
    name: STAGE_LABELS[s.stage] || s.stage,
    value: s.count,
  }));

  const recentActivities = data?.recentActivities || [];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Here's what's happening with your business today.</p>
      </div>

      {/* Stat cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <motion.div variants={itemVariants}>
          {isLoading ? <Skeleton className="h-28" /> : (
            <StatCard
              title="Total Leads"
              value={formatNumber(stats?.totalLeads || 0)}
              change={`+${stats?.newLeadsToday || 0} today`}
              changeType="positive"
              icon={<Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
              iconBg="bg-blue-100 dark:bg-blue-900/30"
            />
          )}
        </motion.div>
        <motion.div variants={itemVariants}>
          {isLoading ? <Skeleton className="h-28" /> : (
            <StatCard
              title="Messages Sent"
              value={formatNumber(stats?.messagesSent || 0)}
              change={`${stats?.todayMessages || 0} today`}
              changeType="positive"
              icon={<MessageSquare className="w-5 h-5 text-green-600 dark:text-green-400" />}
              iconBg="bg-green-100 dark:bg-green-900/30"
            />
          )}
        </motion.div>
        <motion.div variants={itemVariants}>
          {isLoading ? <Skeleton className="h-28" /> : (
            <StatCard
              title="Active Campaigns"
              value={stats?.runningCampaigns || 0}
              change={`${stats?.totalCampaigns || 0} total`}
              changeType="neutral"
              icon={<Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
              iconBg="bg-amber-100 dark:bg-amber-900/30"
            />
          )}
        </motion.div>
        <motion.div variants={itemVariants}>
          {isLoading ? <Skeleton className="h-28" /> : (
            <StatCard
              title="Reply Rate"
              value={stats?.messagesSent > 0 ? `${((stats?.totalReplied / stats?.messagesSent) * 100).toFixed(1)}%` : '0%'}
              change={`${formatNumber(stats?.totalReplied || 0)} replies`}
              changeType="positive"
              icon={<TrendingUp className="w-5 h-5 text-violet-600 dark:text-violet-400" />}
              iconBg="bg-violet-100 dark:bg-violet-900/30"
            />
          )}
        </motion.div>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-5 gap-4"
      >
        {[
          { title: 'No Reply Leads', value: stats?.noReplyLeads || 0, icon: <AlertCircle className="w-4 h-4 text-orange-600" />, bg: 'bg-orange-100 dark:bg-orange-900/30' },
          { title: 'Follow-Up Pending', value: stats?.followUpPending || 0, icon: <Clock className="w-4 h-4 text-amber-600" />, bg: 'bg-amber-100 dark:bg-amber-900/30', href: '/dashboard/inbox?status=FOLLOW_UP_PENDING&includeAll=true' },
          { title: 'Interested Leads', value: stats?.interestedLeads || 0, icon: <UserCheck className="w-4 h-4 text-green-600" />, bg: 'bg-green-100 dark:bg-green-900/30' },
          { title: 'Active Conversations', value: stats?.activeConversations || 0, icon: <MessageSquare className="w-4 h-4 text-blue-600" />, bg: 'bg-blue-100 dark:bg-blue-900/30' },
          { title: 'Hot Leads', value: stats?.hotLeads || 0, icon: <Flame className="w-4 h-4 text-red-600" />, bg: 'bg-red-100 dark:bg-red-900/30' },
        ].map((item) => (
          <motion.div key={item.title} variants={itemVariants}>
            {isLoading ? <Skeleton className="h-24" /> : (
              <Card className="h-24 p-4">
                <Link href={(item as any).href || '/dashboard/leads'} className="block h-full">
                <div className="flex h-full items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{item.title}</p>
                    <p className="text-xl font-bold mt-1">{formatNumber(item.value)}</p>
                    {(item as any).href && <p className="text-[11px] text-primary mt-1">Open pending follow-ups</p>}
                  </div>
                  <div className={`p-2 rounded-lg ${item.bg}`}>{item.icon}</div>
                </div>
                </Link>
              </Card>
            )}
          </motion.div>
        ))}
      </motion.div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Messages chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Message Activity (7 days)</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-56" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="sent" stroke="#22c55e" fill="url(#colorSent)" strokeWidth={2} name="Sent" />
                    <Area type="monotone" dataKey="delivered" stroke="#3b82f6" fill="url(#colorDelivered)" strokeWidth={2} name="Delivered" />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Lead stages pie */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Leads by Stage</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-56" /> : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={stageData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={2}>
                        {stageData.map((_: any, i: number) => (
                          <Cell key={i} fill={STAGE_PIE_COLORS[i % STAGE_PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {stageData.slice(0, 5).map((s: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: STAGE_PIE_COLORS[i] }} />
                          <span className="text-muted-foreground">{s.name}</span>
                        </div>
                        <span className="font-medium">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Campaign delivery stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Delivery Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: 'Messages Sent', value: stats?.messagesSent || 0, icon: <MessageSquare className="w-3.5 h-3.5" />, color: 'text-blue-500' },
                  { label: 'Delivered', value: stats?.messagesDelivered || 0, icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'text-green-500' },
                  { label: 'Failed', value: stats?.messagesFailed || 0, icon: <AlertCircle className="w-3.5 h-3.5" />, color: 'text-red-500' },
                  { label: 'Replied', value: stats?.totalReplied || 0, icon: <TrendingUp className="w-3.5 h-3.5" />, color: 'text-violet-500' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={item.color}>{item.icon}</span>
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                    </div>
                    <span className="font-semibold">{formatNumber(item.value)}</span>
                  </div>
                ))}
                {isLoading && <Skeleton className="h-32" />}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent activity */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
              ) : recentActivities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No activity yet</div>
              ) : (
                <div className="space-y-3">
                  {recentActivities.slice(0, 5).map((activity: any) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Activity className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground leading-snug">{activity.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{activity.lead?.name}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{timeAgo(activity.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
