'use client';

import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Bot,
  CheckCheck,
  Clock,
  FileText,
  Image,
  Paperclip,
  Plus,
  Search,
  Send,
  UserCheck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  cn,
  CUSTOMER_STATUS_COLORS,
  CUSTOMER_STATUS_LABELS,
  initials,
  timeAgo,
} from '@/lib/utils';
import { Button, Modal, Skeleton } from '@/components/ui';

const CUSTOMER_STATUSES = [
  'NEW_LEAD',
  'INTERESTED',
  'NOT_INTERESTED',
  'FOLLOW_UP_PENDING',
  'CALLBACK',
  'CONVERTED',
  'CLOSED',
  'NO_RESPONSE',
];

const QUICK_REPLIES = [
  'Thanks for your reply. Can I share pricing and details?',
  'Sure, I will call you back. What time works best?',
  'Noted. I will follow up with you tomorrow.',
  'Can you confirm your requirement and city?',
];

function messageStatusIcon(status: string) {
  if (status === 'READ') return <CheckCheck className="w-3.5 h-3.5 text-blue-500" />;
  if (status === 'DELIVERED') return <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />;
  if (status === 'SENT') return <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />;
  return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
}

export default function InboxPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState(searchParams?.get('search') || '');
  const [status, setStatus] = useState(searchParams?.get('status') || '');
  const [includeAllContacts, setIncludeAllContacts] = useState(searchParams?.get('includeAll') === 'true');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [directOpen, setDirectOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [directPhone, setDirectPhone] = useState('');
  const [directName, setDirectName] = useState('');
  const [directMessage, setDirectMessage] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');

  const chatsQuery = useQuery({
    queryKey: ['whatsapp-chats', search, status, includeAllContacts],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (includeAllContacts || search) params.set('includeAll', 'true');
      const { data } = await api.get(`/whatsapp/chats?${params}`);
      return data.data;
    },
    refetchInterval: 5000,
  });

  const selectedLead = useMemo(
    () => (chatsQuery.data || []).find((chat: any) => chat.id === selectedLeadId) || chatsQuery.data?.[0],
    [chatsQuery.data, selectedLeadId]
  );

  const messagesQuery = useQuery({
    queryKey: ['whatsapp-chat', selectedLead?.id],
    queryFn: async () => {
      const { data } = await api.get(`/whatsapp/chats/${selectedLead.id}/messages`);
      return data.data;
    },
    enabled: Boolean(selectedLead?.id),
    refetchInterval: 3000,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['team'],
    queryFn: async () => {
      const { data } = await api.get('/team');
      return data.data;
    },
  });

  const { data: summary } = useQuery({
    queryKey: ['whatsapp-chats-summary'],
    queryFn: async () => {
      const { data } = await api.get('/whatsapp/chats/summary');
      return data.data;
    },
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: (payload: any) => api.post(`/whatsapp/chats/${selectedLead.id}/send`, payload),
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chat', selectedLead.id] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to send message'),
  });

  const directSendMutation = useMutation({
    mutationFn: () => api.post('/whatsapp/direct/send', {
      phone: directPhone,
      name: directName,
      content: directMessage,
    }),
    onSuccess: (res) => {
      setDirectPhone('');
      setDirectName('');
      setDirectMessage('');
      setDirectOpen(false);
      setSelectedLeadId(res.data.data.lead.id);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats-summary'] });
      toast.success('Message sent');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to send message'),
  });

  const autoAssignMutation = useMutation({
    mutationFn: () => api.post('/whatsapp/chats/auto-assign'),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
      toast.success(`Assigned ${res.data.data.assigned} conversations`);
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Auto-assign failed'),
  });

  const statusMutation = useMutation({
    mutationFn: (payload: any) => api.put(`/whatsapp/chats/${selectedLead.id}/status`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chat', selectedLead.id] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
      toast.success('Customer updated');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to update customer'),
  });

  const aiMutation = useMutation({
    mutationFn: async () => {
      const latest = (messagesQuery.data?.messages || []).slice(-6).map((m: any) => `${m.direction}: ${m.content}`).join('\n');
      const { data } = await api.post('/ai/reply-suggestions', {
        incomingMessage: latest || 'Customer conversation',
        leadName: selectedLead.name,
        context: `Lead status ${selectedLead.customerStatus}. Generate a short WhatsApp-ready reply in English or Hinglish.`,
      });
      return data.data.replies?.[0]?.text;
    },
    onSuccess: (reply) => {
      if (reply) setMessage(reply);
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'AI suggestion failed'),
  });

  const uploadAndSend = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const upload = await api.post('/settings/upload-file', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    const uploaded = upload.data.data;
    const mediaType = file.type.startsWith('image/')
      ? 'IMAGE'
      : file.type.startsWith('audio/')
        ? 'AUDIO'
        : file.type.startsWith('video/')
          ? 'VIDEO'
          : 'DOCUMENT';
    sendMutation.mutate({
      content: message,
      mediaUrl: uploaded.url,
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
      mediaType,
    });
  };

  const chats = chatsQuery.data || [];
  const messages = messagesQuery.data?.messages || [];
  const lead = messagesQuery.data?.lead || selectedLead;
  const canReassign = ['ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(String(currentUser?.role || ''));

  return (
    <div className="flex h-[calc(100vh-5.5rem)] overflow-hidden rounded-lg border border-border bg-card">
      <aside className="w-full md:w-80 lg:w-96 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border space-y-3">
          <div>
            <h1 className="text-xl font-bold">Shared Inbox</h1>
            <p className="text-xs text-muted-foreground">
              {Number(summary?.unreadMessages) > 0
                ? `${summary.unreadMessages} unread messages in ${summary.unreadChats} chats`
                : 'WhatsApp conversations, replies, ownership, and follow-ups'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" onClick={() => setDirectOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              New Message
            </Button>
            <Button size="sm" variant="outline" loading={autoAssignMutation.isPending} onClick={() => autoAssignMutation.mutate()}>
              <UserCheck className="w-3.5 h-3.5" />
              Auto Assign
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats or messages"
              className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All customer statuses</option>
            {CUSTOMER_STATUSES.map((s) => <option key={s} value={s}>{CUSTOMER_STATUS_LABELS[s]}</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={includeAllContacts}
              onChange={(e) => setIncludeAllContacts(e.target.checked)}
              className="accent-primary"
            />
            Search all CRM contacts, including customers without chats
          </label>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {chatsQuery.isLoading && Array(8).fill(0).map((_, i) => <div key={i} className="p-4"><Skeleton className="h-14" /></div>)}
          {!chatsQuery.isLoading && chats.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No WhatsApp conversations yet.</div>
          )}
          {chats.map((chat: any) => {
            const last = chat.messages?.[0];
            return (
              <button
                key={chat.id}
                onClick={() => setSelectedLeadId(chat.id)}
                className={cn(
                  'w-full p-4 border-b border-border text-left hover:bg-muted/40 transition-colors',
                  selectedLead?.id === chat.id && 'bg-primary/5'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                    {initials(chat.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{chat.name}</p>
                      {last && <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(last.createdAt)}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{last?.content || chat.phone}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={cn('px-2 py-0.5 rounded-md text-[11px] font-medium', CUSTOMER_STATUS_COLORS[chat.customerStatus])}>
                        {CUSTOMER_STATUS_LABELS[chat.customerStatus]}
                      </span>
                      {chat.unreadCount > 0 && <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-green-600 text-white text-[11px] flex items-center justify-center">{chat.unreadCount}</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <main className="hidden md:flex flex-1 flex-col min-w-0">
        {!lead ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Select a conversation</div>
        ) : (
          <>
            <header className="h-20 border-b border-border px-5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold truncate">{lead.name}</h2>
                  <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium', CUSTOMER_STATUS_COLORS[lead.customerStatus])}>
                    {CUSTOMER_STATUS_LABELS[lead.customerStatus]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {lead.phone} · {lead.assignedTo?.name ? `Assigned to ${lead.assignedTo.name}` : 'Unassigned'}
                </p>
                {lead.customFields?.replyState && <p className="text-xs text-amber-600 mt-1">{lead.customFields.replyState}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canReassign && <div className="relative">
                  <Button variant="outline" size="sm" onClick={() => setAssignOpen(open => !open)}>
                    <UserCheck className="w-3.5 h-3.5" />
                    {lead.assignedTo?.name || 'Assign'}
                  </Button>
                  {assignOpen && (
                    <div className="absolute right-0 top-10 z-20 w-56 rounded-lg border border-border bg-card shadow-lg p-1">
                      <button
                        onClick={() => { statusMutation.mutate({ assignedToId: '' }); setAssignOpen(false); }}
                        className="w-full text-left rounded-md px-3 py-2 text-xs hover:bg-muted"
                      >
                        Unassigned
                      </button>
                      {members.map((m: any) => (
                        <button
                          key={m.id}
                          onClick={() => { statusMutation.mutate({ assignedToId: m.id }); setAssignOpen(false); }}
                          className="w-full text-left rounded-md px-3 py-2 text-xs hover:bg-muted"
                        >
                          {m.name} <span className="text-muted-foreground">({m.role})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>}
                <Button variant="outline" size="sm" onClick={() => aiMutation.mutate()} loading={aiMutation.isPending}>
                  <Bot className="w-3.5 h-3.5" />
                  Suggest
                </Button>
              </div>
            </header>

            <div className="border-b border-border px-5 py-3 flex flex-wrap items-center gap-2">
              <select
                value={lead.customerStatus}
                onChange={(e) => statusMutation.mutate({ customerStatus: e.target.value })}
                className="h-9 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none"
              >
                {CUSTOMER_STATUSES.map((s) => <option key={s} value={s}>{CUSTOMER_STATUS_LABELS[s]}</option>)}
              </select>
              <input
                type="datetime-local"
                value={followUpAt}
                onChange={(e) => setFollowUpAt(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => statusMutation.mutate({ customerStatus: 'FOLLOW_UP_PENDING', followUpAt })}
                disabled={!followUpAt}
              >
                <Clock className="w-3.5 h-3.5" />
                Set Follow-Up
              </Button>
              {lead.followUpAt && (
                <span className="text-xs text-muted-foreground">
                  Follow-up: {new Date(lead.followUpAt).toLocaleString()}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-muted/20 scrollbar-thin">
              {messagesQuery.isLoading && <Skeleton className="h-40" />}
              {messages.map((m: any) => (
                <div key={m.id} className={cn('flex', m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[72%] rounded-2xl px-4 py-2 text-sm shadow-sm',
                    m.direction === 'OUTBOUND' ? 'bg-green-600 text-white rounded-br-sm' : 'bg-card border border-border rounded-bl-sm'
                  )}>
                    {m.mediaUrl && (
                      <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="mb-2 flex items-center gap-2 underline">
                        {m.mediaType === 'IMAGE' ? <Image className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        {m.fileName || m.mediaType}
                      </a>
                    )}
                    <p className="whitespace-pre-line">{m.content}</p>
                    <div className={cn('mt-1 flex items-center justify-end gap-1 text-[10px]', m.direction === 'OUTBOUND' ? 'text-white/80' : 'text-muted-foreground')}>
                      <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {m.direction === 'OUTBOUND' && messageStatusIcon(m.status)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <footer className="border-t border-border p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {QUICK_REPLIES.map((reply) => (
                  <button key={reply} onClick={() => setMessage(reply)} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted transition-colors">
                    {reply}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadAndSend(e.target.files[0])}
                />
                <Button variant="outline" size="icon" onClick={() => fileRef.current?.click()} disabled={sendMutation.isPending}>
                  <Paperclip className="w-4 h-4" />
                </Button>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (message.trim()) sendMutation.mutate({ content: message });
                    }
                  }}
                  placeholder="Reply from CRM..."
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <Button loading={sendMutation.isPending} disabled={!message.trim()} onClick={() => sendMutation.mutate({ content: message })}>
                  <Send className="w-4 h-4" />
                  Send
                </Button>
              </div>
            </footer>
          </>
        )}
      </main>
      <Modal open={directOpen} onClose={() => setDirectOpen(false)} title="New WhatsApp Message" size="sm">
        <div className="p-6 space-y-3">
          <input
            value={directPhone}
            onChange={(e) => setDirectPhone(e.target.value)}
            placeholder="WhatsApp phone"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            value={directName}
            onChange={(e) => setDirectName(e.target.value)}
            placeholder="Name optional"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <textarea
            value={directMessage}
            onChange={(e) => setDirectMessage(e.target.value)}
            placeholder="Message"
            rows={4}
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDirectOpen(false)}>Cancel</Button>
            <Button
              loading={directSendMutation.isPending}
              disabled={!directPhone.trim() || !directMessage.trim()}
              onClick={() => directSendMutation.mutate()}
            >
              <Send className="w-4 h-4" />
              Send
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
