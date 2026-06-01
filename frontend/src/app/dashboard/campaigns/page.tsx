'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { cn, CAMPAIGN_STATUS_COLORS, CUSTOMER_STATUS_LABELS, formatNumber, WA_VARIABLES } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Plus, Play, Pause, Trash2, BarChart3, MessageSquare, Users, CheckCircle, AlertCircle, Zap, RefreshCw, Image, X, Upload, Bot, SlidersHorizontal } from 'lucide-react';

function StatCard({ title, value, icon, color }: any) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
      <div><p className="text-xs text-muted-foreground">{title}</p><p className="text-2xl font-bold mt-1">{value}</p></div>
      <div className={cn('p-2.5 rounded-xl', color)}>{icon}</div>
    </div>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, value || 0)}%` }} />
    </div>
  );
}

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [statsModal, setStatsModal] = useState<any>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => { const { data } = await api.get('/campaigns'); return data.data; },
    refetchInterval: 5000,
  });

  const startM = useMutation({ mutationFn: (id: string) => api.post(`/campaigns/${id}/start`), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Campaign started! 🚀'); }, onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to start') });
  const pauseM = useMutation({ mutationFn: (id: string) => api.post(`/campaigns/${id}/pause`), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Paused'); } });
  const resumeM = useMutation({ mutationFn: (id: string) => api.post(`/campaigns/${id}/resume`), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Resumed'); } });
  const sendUnsentM = useMutation({ mutationFn: (id: string) => api.post(`/campaigns/${id}/send-unsent`), onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ['campaigns'] }); toast.success(res.data?.message || 'Unsent contacts queued'); }, onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to queue unsent contacts') });
  const deleteM = useMutation({ mutationFn: (id: string) => api.delete(`/campaigns/${id}`), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Deleted'); } });

  const campaigns = data || [];
  const totalSent = campaigns.reduce((a: number, c: any) => a + c.totalSent, 0);
  const running = campaigns.filter((c: any) => c.status === 'RUNNING').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">WhatsApp Campaigns</h1><p className="text-sm text-muted-foreground mt-0.5">Create & manage outreach campaigns with images</p></div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setCreateOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"><Plus className="w-4 h-4" /> New Campaign</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total" value={campaigns.length} icon={<Zap className="w-5 h-5 text-violet-600" />} color="bg-violet-100 dark:bg-violet-900/30" />
        <StatCard title="Running" value={running} icon={<Play className="w-5 h-5 text-green-600" />} color="bg-green-100 dark:bg-green-900/30" />
        <StatCard title="Sent" value={formatNumber(totalSent)} icon={<MessageSquare className="w-5 h-5 text-blue-600" />} color="bg-blue-100 dark:bg-blue-900/30" />
        <StatCard title="Delivered" value={formatNumber(campaigns.reduce((a: number, c: any) => a + c.totalDelivered, 0))} icon={<CheckCircle className="w-5 h-5 text-emerald-600" />} color="bg-emerald-100 dark:bg-emerald-900/30" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : campaigns.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center">
          <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold mb-1">No campaigns yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first WhatsApp campaign with images</p>
          <button onClick={() => setCreateOpen(true)} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium">Create Campaign</button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c: any, i: number) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold">{c.name}</h3>
                      <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium', CAMPAIGN_STATUS_COLORS[c.status])}>{c.status}</span>
                      {c.imageUrl && <span className="flex items-center gap-1 text-xs text-blue-500"><Image className="w-3 h-3" />Image attached</span>}
                      {c.status === 'RUNNING' && <span className="flex items-center gap-1 text-xs text-green-600"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Live</span>}
                    </div>
                    {c.description && <p className="text-sm text-muted-foreground mb-2 line-clamp-1">{c.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c._count?.leads || 0} contacts</span>
                      <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{c.totalSent} sent</span>
                      <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3 h-3" />{c.totalDelivered} delivered</span>
                      {c.schedule && <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{c.schedule.sendableToday} msgs today · {c.schedule.humanDuration}</span>}
                      {c.totalFailed > 0 && <span className="flex items-center gap-1 text-red-500"><AlertCircle className="w-3 h-3" />{c.totalFailed} failed</span>}
                    </div>
                    {(c._count?.leads || 0) > 0 && <div className="mt-2"><Progress value={(c.totalSent / c._count.leads) * 100} /></div>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {c.status === 'DRAFT' && <button onClick={() => startM.mutate(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"><Play className="w-3.5 h-3.5" />Start</button>}
                    {c.status === 'RUNNING' && <button onClick={() => pauseM.mutate(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"><Pause className="w-3.5 h-3.5" />Pause</button>}
                    {c.status === 'PAUSED' && <button onClick={() => resumeM.mutate(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"><Play className="w-3.5 h-3.5" />Resume</button>}
                    {['PAUSED', 'COMPLETED', 'FAILED'].includes(c.status) && c.totalSent < (c._count?.leads || 0) && <button onClick={() => sendUnsentM.mutate(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/40 text-primary text-xs font-medium hover:bg-primary/10 transition-colors"><RefreshCw className="w-3.5 h-3.5" />Send Unsent</button>}
                    <button onClick={() => setStatsModal(c)} className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors"><BarChart3 className="w-4 h-4" /></button>
                    {c.status !== 'RUNNING' && <button onClick={() => deleteM.mutate(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {createOpen && <CreateCampaignModal onClose={() => setCreateOpen(false)} />}
      {statsModal && <StatsModal campaign={statsModal} onClose={() => setStatsModal(null)} />}
    </div>
  );
}

function CreateCampaignModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ name: '', description: '', messageTemplate: '' });
  const [leadFilter, setLeadFilter] = useState<'all' | 'stage' | 'select'>('all');
  const [stageFilter, setStageFilter] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [autoStart, setAutoStart] = useState(true);
  const [aiPrompt, setAiPrompt] = useState({ goal: '', audience: '', offer: '' });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customSchedule, setCustomSchedule] = useState<any>({});
  const [scheduleInitialized, setScheduleInitialized] = useState(false);

  const { data: leadsData } = useQuery({
    queryKey: ['leads-campaign', leadFilter, stageFilter, leadSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '1000' });
      if (leadFilter === 'select' && leadSearch) params.set('search', leadSearch);
      if (leadFilter === 'stage' && stageFilter) params.set('stage', stageFilter);
      const { data } = await api.get(`/campaigns/available-leads?${params}`);
      return data.data;
    },
    enabled: step === 3 && (leadFilter !== 'stage' || Boolean(stageFilter)),
  });

  const recipientCount = leadFilter === 'select'
    ? selectedLeads.length
    : (leadsData || []).length;

  const estimatePayload = {
    leadIds: leadFilter === 'select' ? selectedLeads : undefined,
    stageFilter: leadFilter === 'stage' ? stageFilter : undefined,
    ...customSchedule,
  };

  const { data: estimate } = useQuery({
    queryKey: ['campaign-estimate', leadFilter, stageFilter, selectedLeads, customSchedule],
    queryFn: async () => {
      const { data } = await api.post('/campaigns/estimate', estimatePayload);
      return data.data;
    },
    enabled: step === 3 && (leadFilter !== 'stage' || Boolean(stageFilter)) && (leadFilter !== 'select' || selectedLeads.length > 0),
  });

  useEffect(() => {
    if (!estimate?.safety || scheduleInitialized) return;
    setCustomSchedule({
      dailyLimit: estimate.safety.dailyLimit,
      minDelay: estimate.safety.minDelay,
      maxDelay: estimate.safety.maxDelay,
      batchSize: estimate.safety.batchSize,
      pauseMinutesAfterBatch: estimate.safety.pauseMinutesAfterBatch,
    });
    setScheduleInitialized(true);
  }, [estimate?.safety, scheduleInitialized]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData(); fd.append('image', file);
      const { data } = await api.post('/settings/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      return data.data.url;
    },
    onSuccess: (url) => { setUploadedImageUrl(url); toast.success('Image uploaded!'); },
    onError: () => toast.error('Image upload failed'),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/campaigns', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campaigns'] }); toast.success(autoStart ? 'Campaign created and started!' : 'Campaign created!'); onClose(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to create'),
  });

  const aiDraftMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/ai/campaign-draft', {
        goal: aiPrompt.goal || form.name || 'lead outreach',
        audience: aiPrompt.audience || 'CRM leads',
        offer: aiPrompt.offer || form.description || 'product or service introduction',
        language: 'hinglish',
        tone: 'professional',
      });
      return data.data;
    },
    onSuccess: (draft) => {
      setForm(current => ({
        name: draft.name || current.name,
        description: draft.description || current.description,
        messageTemplate: draft.messageTemplate || current.messageTemplate,
      }));
      toast.success('AI campaign draft created');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'AI draft failed'),
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { toast.error('Image too large (max 50MB)'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    uploadMutation.mutate(file);
  };

  const insertVar = (v: string) => setForm(f => ({ ...f, messageTemplate: f.messageTemplate + v }));

  const handleCreate = () => {
    const payload: any = { ...form };
    if (uploadedImageUrl) payload.imageUrl = uploadedImageUrl;
    if (leadFilter === 'stage' && stageFilter) payload.stageFilter = stageFilter;
    if (leadFilter === 'select' && selectedLeads.length) payload.leadIds = selectedLeads;
    payload.autoStart = autoStart;
    Object.assign(payload, customSchedule);
    createMutation.mutate(payload);
  };

  const currentSafety = estimate?.safety || customSchedule;
  const recommended = estimate?.recommended || estimate?.safety || {};
  const schedule = estimate?.schedule;
  const totalDays = currentSafety?.dailyLimit ? Math.ceil((estimate?.recipients || recipientCount) / currentSafety.dailyLimit) : 0;
  const totalMinutes = schedule?.estimatedDurationMinutes && totalDays ? schedule.estimatedDurationMinutes * totalDays : 0;
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="font-semibold">Create Campaign</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        {/* Steps indicator */}
        <div className="px-6 pt-4 flex items-center gap-2 flex-shrink-0">
          {['Details', 'Message + Image', 'Contacts'].map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors', step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}>{step > i + 1 ? '✓' : i + 1}</div>
              <span className={cn('text-xs', step === i + 1 ? 'text-foreground font-medium' : 'text-muted-foreground')}>{s}</span>
              {i < 2 && <div className={cn('h-0.5 w-8', step > i + 1 ? 'bg-primary' : 'bg-muted')} />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Campaign Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="BHARAT Milk Promotion May 2025" className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Campaign goal..." className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
              </div>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" />
                Timing is auto-calculated from super-admin limits. After contacts are selected, the campaign will show how many messages go today, the delay range, batch pauses, and estimated finish time.
              </div>
              <div className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Create with AI</h3>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <input value={aiPrompt.goal} onChange={e => setAiPrompt(p => ({ ...p, goal: e.target.value }))} placeholder="Goal" className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus:outline-none" />
                  <input value={aiPrompt.audience} onChange={e => setAiPrompt(p => ({ ...p, audience: e.target.value }))} placeholder="Audience" className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus:outline-none" />
                  <input value={aiPrompt.offer} onChange={e => setAiPrompt(p => ({ ...p, offer: e.target.value }))} placeholder="Offer" className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus:outline-none" />
                </div>
                <button onClick={() => aiDraftMutation.mutate()} disabled={aiDraftMutation.isPending} className="inline-flex items-center gap-2 rounded-lg border border-primary/40 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50">
                  <Bot className="w-3.5 h-3.5" />
                  {aiDraftMutation.isPending ? 'Generating...' : 'Generate campaign draft'}
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              {/* Image upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Attach Image (optional)</label>
                <div className="flex items-start gap-3">
                  <div
                    onClick={() => fileRef.current?.click()}
                    className={cn('flex-1 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors', imagePreview ? 'border-primary/40' : 'border-border hover:border-primary/40')}
                  >
                    {imagePreview ? (
                      <div className="relative">
                        <img src={imagePreview} alt="Preview" className="max-h-32 mx-auto rounded-lg object-contain" />
                        {uploadMutation.isPending && <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center text-white text-xs">Uploading...</div>}
                        {uploadedImageUrl && <p className="text-xs text-green-600 mt-1">✓ Uploaded successfully</p>}
                      </div>
                    ) : (
                      <div className="py-4">
                        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Click to upload image</p>
                        <p className="text-xs text-muted-foreground mt-1">JPG, PNG, GIF up to 50MB</p>
                      </div>
                    )}
                  </div>
                  {imagePreview && (
                    <button onClick={() => { setImageFile(null); setImagePreview(''); setUploadedImageUrl(''); }} className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*,video/mp4" className="hidden" onChange={handleImageSelect} />
              </div>

              {/* Message template */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Message Template *</label>
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {WA_VARIABLES.map(v => (
                    <button key={v} onClick={() => insertVar(v)} className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors font-mono">{v}</button>
                  ))}
                </div>
                <textarea
                  value={form.messageTemplate}
                  onChange={e => setForm(f => ({ ...f, messageTemplate: e.target.value }))}
                  rows={8}
                  placeholder={`🚀 BHARAT Milk – Smart Dairy Accounting Software 🥛\n\nनमस्ते {{name}} जी! 🙏\n\nअब अपनी डेयरी को Digital बनाइए...\n\n📞 Contact: +91 6284386495`}
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
                <p className="text-xs text-muted-foreground">{form.messageTemplate.length} characters</p>
              </div>

              {form.messageTemplate && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Preview</p>
                  <div className="p-3 rounded-xl rounded-tl-sm bg-muted max-w-xs text-sm leading-relaxed whitespace-pre-line">
                    {form.messageTemplate.replace(/\{\{name\}\}/g, 'Ramesh').replace(/\{\{city\}\}/g, 'Mumbai').replace(/\{\{company\}\}/g, 'Ramesh Dairy').replace(/\{\{category\}\}/g, 'Dairy')}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {step === 3 && (
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Who to send to?</label>
                <div className="grid grid-cols-3 gap-2">
                  {([['all', 'All Leads', 'Send to everyone'], ['stage', 'By Stage', 'Filter by stage'], ['select', 'Select Manually', 'Pick contacts']] as const).map(([val, label, desc]) => (
                    <button key={val} onClick={() => setLeadFilter(val)} className={cn('p-3 rounded-xl border text-left transition-all', leadFilter === val ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                      <p className={cn('text-sm font-medium', leadFilter === val ? 'text-primary' : '')}>{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {leadFilter === 'stage' && (
                <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className="w-full h-9 rounded-lg border border-input bg-card px-3 text-sm focus:outline-none">
                  <option value="">Select stage...</option>
                  {['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}

              {leadFilter === 'select' && (
                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-sm font-medium">{selectedLeads.length} selected</span>
                    <input
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                      placeholder="Search contacts"
                      className="h-8 flex-1 rounded-lg border border-input bg-transparent px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button onClick={() => setSelectedLeads(leadsData?.map((l: any) => l.id) || [])} className="text-xs text-primary hover:underline">Select All</button>
                  </div>
                  <div className="max-h-56 overflow-y-auto border border-border rounded-xl p-2 space-y-1">
                    {(leadsData || []).map((lead: any) => (
                      <label key={lead.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted cursor-pointer">
                        <input type="checkbox" checked={selectedLeads.includes(lead.id)} onChange={e => setSelectedLeads(p => e.target.checked ? [...p, lead.id] : p.filter(id => id !== lead.id))} className="accent-primary" />
                        <div>
                          <p className="text-sm font-medium">{lead.name}</p>
                          <p className="text-xs text-muted-foreground">{lead.phone} · {lead.city || 'No city'} · {lead.source}</p>
                        </div>
                      </label>
                    ))}
                    {(leadsData || []).length === 0 && (
                      <div className="p-4 text-center text-sm text-muted-foreground">No leads found. Import or scrape leads first.</div>
                    )}
                  </div>
                </div>
              )}

              {leadFilter === 'all' && (
                <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-sm text-green-700 dark:text-green-300">
                  ✓ Will send to ALL leads in your CRM automatically
                </div>
              )}

              <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Messages to be sent</p>
                    <p className="text-xs text-muted-foreground">
                      {leadFilter === 'stage' && !stageFilter
                        ? 'Select a stage to calculate recipients'
                        : `${estimate?.recipients || recipientCount} WhatsApp message${(estimate?.recipients || recipientCount) === 1 ? '' : 's'} will be queued`}
                    </p>
                  </div>
                  <span className="rounded-lg bg-primary/10 px-3 py-1.5 text-lg font-bold text-primary">
                    {leadFilter === 'stage' && !stageFilter ? '-' : (estimate?.recipients || recipientCount)}
                  </span>
                </div>
                {schedule && (
                  <div className="grid gap-2 rounded-lg bg-card p-3 text-xs">
                    <p className="font-medium text-foreground">Sending plan</p>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      <div><span className="text-muted-foreground">Per day</span><p className="font-semibold">{schedule.sendableToday} people</p></div>
                      <div><span className="text-muted-foreground">Delay</span><p className="font-semibold">{currentSafety.minDelay}-{currentSafety.maxDelay}s</p></div>
                      <div><span className="text-muted-foreground">Pause</span><p className="font-semibold">{currentSafety.pauseMinutesAfterBatch}m / {currentSafety.batchSize} msgs</p></div>
                      <div><span className="text-muted-foreground">Today time</span><p className="font-semibold">{schedule.humanDuration}</p></div>
                    </div>
                    <p className="text-muted-foreground">
                      Approx total: {totalDays} day{totalDays === 1 ? '' : 's'} · {totalHours ? `${totalHours}h ` : ''}{remainingMinutes}m active sending time. AI/recommended maximum today is {recommended.dailyLimit} messages.
                    </p>
                  </div>
                )}
                <button type="button" onClick={() => setShowAdvanced(open => !open)} className="inline-flex items-center gap-2 text-xs font-medium text-primary">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {showAdvanced ? 'Hide custom timing' : 'Customize timing'}
                </button>
                {showAdvanced && (
                  <div className="grid gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-2">
                    <label className="text-xs text-muted-foreground">Daily messages
                      <input type="number" min={1} max={recommended.dailyLimit || 1} value={customSchedule.dailyLimit || ''} onChange={e => setCustomSchedule((s: any) => ({ ...s, dailyLimit: Number(e.target.value) }))} className="mt-1 h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm" />
                    </label>
                    <label className="text-xs text-muted-foreground">Batch size
                      <input type="number" min={1} max={recommended.batchSize || 1} value={customSchedule.batchSize || ''} onChange={e => setCustomSchedule((s: any) => ({ ...s, batchSize: Number(e.target.value) }))} className="mt-1 h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm" />
                    </label>
                    <label className="text-xs text-muted-foreground">Min delay seconds
                      <input type="number" min={recommended.minDelay || 1} value={customSchedule.minDelay || ''} onChange={e => setCustomSchedule((s: any) => ({ ...s, minDelay: Number(e.target.value) }))} className="mt-1 h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm" />
                    </label>
                    <label className="text-xs text-muted-foreground">Max delay seconds
                      <input type="number" min={recommended.maxDelay || 1} value={customSchedule.maxDelay || ''} onChange={e => setCustomSchedule((s: any) => ({ ...s, maxDelay: Number(e.target.value) }))} className="mt-1 h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm" />
                    </label>
                    <label className="text-xs text-muted-foreground md:col-span-2">Pause minutes after each batch
                      <input type="number" min={recommended.pauseMinutesAfterBatch || 1} value={customSchedule.pauseMinutesAfterBatch || ''} onChange={e => setCustomSchedule((s: any) => ({ ...s, pauseMinutesAfterBatch: Number(e.target.value) }))} className="mt-1 h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm" />
                    </label>
                    <p className="text-xs text-muted-foreground md:col-span-2">Values above the AI/recommended maximum are automatically capped by the server.</p>
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={autoStart}
                    onChange={(e) => setAutoStart(e.target.checked)}
                    className="accent-primary"
                  />
                  Start campaign automatically after creating
                </label>
              </div>
            </motion.div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-between flex-shrink-0">
          <button onClick={() => step > 1 ? setStep(s => s - 1) : onClose()} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">{step === 1 ? 'Cancel' : 'Back'}</button>
          <button
            disabled={
              (step === 1 && !form.name) ||
              (step === 2 && !form.messageTemplate) ||
              (step === 3 && leadFilter === 'stage' && !stageFilter) ||
              (step === 3 && leadFilter === 'select' && selectedLeads.length === 0) ||
              (step === 3 && recipientCount === 0) ||
              createMutation.isPending || uploadMutation.isPending
            }
            onClick={() => step < 3 ? setStep(s => s + 1) : handleCreate()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createMutation.isPending ? 'Creating...' : step < 3 ? 'Next →' : autoStart ? 'Create & Start' : 'Create Campaign'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function StatsModal({ campaign, onClose }: { campaign: any; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['campaign-stats', campaign.id],
    queryFn: async () => { const { data } = await api.get(`/campaigns/${campaign.id}/stats`); return data.data; },
  });
  const { data: campaignLeads = [] } = useQuery({
    queryKey: ['campaign-leads', campaign.id],
    queryFn: async () => { const { data } = await api.get(`/campaigns/${campaign.id}/leads`); return data.data; },
  });
  const statusMutation = useMutation({
    mutationFn: ({ leadId, customerStatus }: any) => api.put(`/campaigns/${campaign.id}/leads/${leadId}/status`, { customerStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-leads', campaign.id] });
      toast.success('Lead status updated');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to update lead'),
  });
  const sendUnsentMutation = useMutation({
    mutationFn: () => api.post(`/campaigns/${campaign.id}/send-unsent`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-stats', campaign.id] });
      queryClient.invalidateQueries({ queryKey: ['campaign-leads', campaign.id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(res.data?.message || 'Unsent contacts queued');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to queue unsent contacts'),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-3xl p-6 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{campaign.name} — Stats</h2>
          <div className="flex items-center gap-2">
            {data?.unsent > 0 && (
              <button onClick={() => sendUnsentMutation.mutate()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium">
                <RefreshCw className="w-3.5 h-3.5" />
                Send to {data.unsent} Unsent
              </button>
            )}
            <button onClick={onClose}><X className="w-4 h-4" /></button>
          </div>
        </div>
        {data && (
          <div className="grid grid-cols-2 gap-3">
            {[['Total Contacts', data.total, 'text-foreground'], ['Unsent / Not Shared', data.unsent, 'text-amber-600'], ['Sent', data.sent, 'text-blue-600'], ['Delivered', data.delivered, 'text-green-600'], ['Failed', data.failed, 'text-red-500'], ['Replied', data.replied, 'text-violet-600'], ['Delivery Rate', `${data.deliveryRate}%`, 'text-primary'], ['Reply Rate', `${data.replyRate}%`, 'text-primary']].map(([label, value, color]) => (
              <div key={label as string} className="p-3 rounded-xl bg-muted/50">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={cn('text-xl font-bold mt-1', color as string)}>{value}</p>
              </div>
            ))}
          </div>
        )}
        <div className="mt-6">
          <h3 className="font-semibold mb-3">Campaign Lead Tracking</h3>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 text-xs text-muted-foreground">Lead</th>
                  <th className="text-left px-3 py-2 text-xs text-muted-foreground">Campaign Status</th>
                  <th className="text-left px-3 py-2 text-xs text-muted-foreground">Customer Status</th>
                  <th className="text-left px-3 py-2 text-xs text-muted-foreground">Sent</th>
                  <th className="text-left px-3 py-2 text-xs text-muted-foreground">Reason</th>
                </tr>
              </thead>
              <tbody>
                {campaignLeads.slice(0, 100).map((row: any) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <p className="font-medium">{row.lead.name}</p>
                      <p className="text-xs text-muted-foreground">{row.lead.phone}</p>
                    </td>
                    <td className="px-3 py-2">{row.status}</td>
                    <td className="px-3 py-2">
                      <select
                        value={row.lead.customerStatus}
                        onChange={(e) => statusMutation.mutate({ leadId: row.lead.id, customerStatus: e.target.value })}
                        className="h-8 rounded-lg border border-input bg-card px-2 text-xs focus:outline-none"
                      >
                        {Object.entries(CUSTOMER_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {row.sentAt ? new Date(row.sentAt).toLocaleString() : 'Not sent'}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {row.failReason || (row.sentAt ? 'Shared' : 'Not shared yet')}
                    </td>
                  </tr>
                ))}
                {campaignLeads.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No campaign leads yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
