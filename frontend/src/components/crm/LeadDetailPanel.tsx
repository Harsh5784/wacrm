'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { cn, STAGE_COLORS, STAGE_LABELS, SOURCE_LABELS, timeAgo, initials } from '@/lib/utils';
import { Button, Badge, Skeleton, Input, Textarea } from '@/components/ui';
import toast from 'react-hot-toast';
import { X, Phone, Mail, MapPin, Building2, Tag, MessageSquare, Bot, Edit3, Plus, Clock } from 'lucide-react';

const STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST', 'DORMANT'];
const RESPONSE_ACTIONS = [
  { label: 'Interested', stage: 'QUALIFIED', customerStatus: 'INTERESTED' },
  { label: 'Not Interested', stage: 'LOST', customerStatus: 'NOT_INTERESTED' },
  { label: 'Follow Up Later', stage: 'CONTACTED', customerStatus: 'FOLLOW_UP_PENDING' },
  { label: 'Call Back', stage: 'CONTACTED', customerStatus: 'CALLBACK' },
  { label: 'Converted', stage: 'WON', customerStatus: 'CONVERTED' },
  { label: 'No Response', stage: 'DORMANT', customerStatus: 'NO_RESPONSE' },
];

export function LeadDetailPanel({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'activity'>('overview');
  const [noteContent, setNoteContent] = useState('');
  const [editingStage, setEditingStage] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: async () => {
      const { data } = await api.get(`/leads/${leadId}`);
      return data.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: (updates: any) => api.put(`/leads/${leadId}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead updated');
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (content: string) => api.post(`/leads/${leadId}/notes`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      setNoteContent('');
      toast.success('Note added');
    },
  });

  const aiScoreMutation = useMutation({
    mutationFn: () => api.post(`/ai/score-lead/${leadId}`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      toast.success(`AI Score: ${res.data.data.score}/100 — ${res.data.data.reasoning}`);
    },
  });

  const lead = data;

  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="w-full lg:w-[420px] flex-shrink-0 border-l border-border bg-card overflow-y-auto scrollbar-thin"
    >
      {/* Header */}
      <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border px-5 py-4 flex items-center justify-between z-10">
        <h2 className="font-semibold">Lead Details</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="p-5 space-y-4">
          {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : lead && (
        <div className="p-5 space-y-5">
          {/* Avatar & name */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl gradient-brand flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
              {initials(lead.name)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg leading-tight">{lead.name}</h3>
              {lead.company && <p className="text-sm text-muted-foreground">{lead.company}</p>}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {editingStage ? (
                  <select
                    value={lead.stage}
                    onChange={(e) => { updateMutation.mutate({ stage: e.target.value }); setEditingStage(false); }}
                    className="text-xs rounded-lg border border-border bg-card px-2 py-1 focus:outline-none"
                    autoFocus
                    onBlur={() => setEditingStage(false)}
                  >
                    {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                  </select>
                ) : (
                  <button
                    onClick={() => setEditingStage(true)}
                    className={cn('px-2.5 py-0.5 rounded-md text-xs font-medium', STAGE_COLORS[lead.stage])}
                  >
                    {STAGE_LABELS[lead.stage]}
                  </button>
                )}
                <Badge variant="secondary">{SOURCE_LABELS[lead.source]}</Badge>
              </div>
            </div>
          </div>

          {/* Score */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">AI Lead Score</span>
                <span className="text-sm font-bold text-primary">{lead.score}/100</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${lead.score}%` }}
                  className={cn('h-full rounded-full', lead.score >= 70 ? 'bg-green-500' : lead.score >= 40 ? 'bg-amber-500' : 'bg-red-500')}
                />
              </div>
            </div>
            <Button size="sm" variant="outline" loading={aiScoreMutation.isPending} onClick={() => aiScoreMutation.mutate()}>
              <Bot className="w-3.5 h-3.5" />
              Score
            </Button>
          </div>

          {/* Contact info */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact Info</p>
            {[
              { icon: Phone, label: lead.phone, href: `tel:${lead.phone}` },
              { icon: Mail, label: lead.email, href: `mailto:${lead.email}` },
              { icon: MapPin, label: [lead.city, lead.state].filter(Boolean).join(', ') },
              { icon: Building2, label: lead.category },
            ].filter(i => i.label).map((item, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm">
                <item.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                {item.href ? (
                  <a href={item.href} className="text-primary hover:underline truncate">{item.label}</a>
                ) : (
                  <span className="text-muted-foreground truncate">{item.label}</span>
                )}
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`https://wa.me/${lead.phone?.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 h-9 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              WhatsApp
            </a>
            <Link
              href={`/dashboard/ai-assistant?lead=${lead.id}`}
              className="flex items-center justify-center gap-2 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
            >
              <Bot className="w-4 h-4" />
              AI Assist
            </Link>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Response</p>
            <div className="grid grid-cols-2 gap-2">
              {RESPONSE_ACTIONS.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  size="sm"
                  loading={updateMutation.isPending}
                  onClick={() => updateMutation.mutate({
                    stage: action.stage,
                    customerStatus: action.customerStatus,
                    customFields: {
                      ...(lead.customFields || {}),
                      responseStatus: action.label,
                      responseUpdatedAt: new Date().toISOString(),
                    },
                  })}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-border">
            <div className="flex gap-4">
              {(['overview', 'notes', 'activity'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'pb-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
                    activeTab === tab
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          {activeTab === 'overview' && (
            <div className="space-y-3">
              {lead.tags?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {lead.tags.map((lt: any) => (
                      <span
                        key={lt.tag.id}
                        className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ background: lt.tag.color }}
                      >
                        {lt.tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {lead.address && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Address</p>
                  <p className="text-sm text-muted-foreground">{lead.address}</p>
                </div>
              )}
              {lead.rating && (
                <div className="flex items-center gap-1">
                  <span className="text-amber-500">★</span>
                  <span className="text-sm font-medium">{lead.rating}</span>
                  <span className="text-xs text-muted-foreground">rating</span>
                </div>
              )}
              <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                Added {timeAgo(lead.createdAt)}
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Add a note..."
                  className="min-h-[80px] text-sm"
                />
                <Button
                  size="sm"
                  disabled={!noteContent.trim()}
                  loading={addNoteMutation.isPending}
                  onClick={() => addNoteMutation.mutate(noteContent)}
                  className="w-full"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Note
                </Button>
              </div>
              <div className="space-y-3 mt-4">
                {lead.notes?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
                ) : lead.notes?.map((note: any) => (
                  <div key={note.id} className="p-3 rounded-xl bg-muted/50 space-y-1.5">
                    <p className="text-sm">{note.content}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{note.author.name}</span>
                      <span>·</span>
                      <span>{timeAgo(note.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-3">
              {lead.activities?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
              ) : lead.activities?.map((activity: any) => (
                <div key={activity.id} className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(activity.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
