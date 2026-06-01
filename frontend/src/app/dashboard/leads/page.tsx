'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { cn, STAGE_COLORS, STAGE_LABELS, SOURCE_LABELS, timeAgo, initials } from '@/lib/utils';
import { Button, Badge, Card, Input, Select, Modal, EmptyState, Skeleton } from '@/components/ui';
import toast from 'react-hot-toast';
import {
  Users, Plus, Search, Filter, Upload, Download, MoreVertical,
  Phone, MapPin, Building2, Tag, Star, ChevronRight, Trash2, Edit,
  SlidersHorizontal, RefreshCw,
} from 'lucide-react';
import { LeadDetailPanel } from '@/components/crm/LeadDetailPanel';
import { CreateLeadModal } from '@/components/crm/CreateLeadModal';
import { useAuthStore } from '@/store/auth.store';

const STAGES = ['', 'NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST', 'DORMANT'];

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [view, setView] = useState<'table' | 'kanban'>('table');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['leads', search, stage, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (stage) params.set('stage', stage);
      const { data } = await api.get(`/leads?${params}`);
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leads/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead deleted');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to delete lead'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (payload: { leadIds?: string[]; all?: boolean }) => api.post('/leads/bulk-delete', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead'] });
      setSelectedLeadIds([]);
      setBulkDeleteOpen(false);
      setDeleteAllOpen(false);
      toast.success(res.data?.message || 'Selected leads deleted');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to delete selected leads'),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post('/leads/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      const d = res.data.data;
      toast.success(`Imported ${d.imported} leads (${d.skipped} skipped)`);
    },
    onError: () => toast.error('Import failed'),
  });

  const handleExport = async () => {
    try {
      const res = await api.get('/leads/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'leads.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Export is blocked or failed');
    }
  };

  const leads = data?.data || [];
  const pagination = data?.pagination;
  const visibleLeadIds = leads.map((lead: any) => lead.id);
  const selectedOnPage = visibleLeadIds.filter((id: string) => selectedLeadIds.includes(id));
  const allVisibleSelected = visibleLeadIds.length > 0 && selectedOnPage.length === visibleLeadIds.length;

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds((ids) =>
      ids.includes(leadId) ? ids.filter((id) => id !== leadId) : [...ids, leadId]
    );
  };

  const toggleSelectAllVisible = () => {
    setSelectedLeadIds((ids) => {
      if (allVisibleSelected) return ids.filter((id) => !visibleLeadIds.includes(id));
      return Array.from(new Set([...ids, ...visibleLeadIds]));
    });
  };

  return (
    <div className="flex h-full gap-4 -m-6">
      {/* Main panel */}
      <div className={cn('flex-1 flex flex-col overflow-hidden p-6', selectedLead && 'hidden lg:flex')}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Leads & CRM</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {pagination?.total || 0} total leads
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
            {['ADMIN', 'SUPER_ADMIN'].includes(user?.role || '') && (
              <Button variant="destructive" size="sm" onClick={() => setDeleteAllOpen(true)}>
                <Trash2 className="w-3.5 h-3.5" />
                Delete All
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-3.5 h-3.5" />
              Import CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && importMutation.mutate(e.target.files[0])}
            />
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              Add Lead
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name, phone, company..."
              className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <select
            value={stage}
            onChange={(e) => { setStage(e.target.value); setPage(1); }}
            className="h-9 rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All Stages</option>
            {STAGES.slice(1).map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>

          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {selectedLeadIds.length > 0 && (
          <div className="sticky top-0 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
            <p className="text-sm font-medium">{selectedLeadIds.length} selected</p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedLeadIds([])}>
                Clear
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto scrollbar-thin rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all visible leads"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Location</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Source</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stage</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden xl:table-cell">Score</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Added</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {isLoading && Array(8).fill(0).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  {Array(9).fill(0).map((_, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td>
                  ))}
                </tr>
              ))}
              {!isLoading && leads.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      icon={<Users className="w-8 h-8 text-muted-foreground" />}
                      title="No leads yet"
                      description="Add leads manually, import from CSV, or scrape from Google Maps, Justdial & IndiaMART"
                      action={<Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Add First Lead</Button>}
                    />
                  </td>
                </tr>
              )}
              <AnimatePresence>
                {leads.map((lead: any) => (
                  <motion.tr
                    key={lead.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectedLead(lead)}
                    className={cn(
                      'border-t border-border hover:bg-muted/30 cursor-pointer transition-colors group',
                      selectedLeadIds.includes(lead.id) && 'bg-primary/5'
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${lead.name}`}
                        checked={selectedLeadIds.includes(lead.id)}
                        onChange={() => toggleLeadSelection(lead.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full gradient-brand flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {initials(lead.name)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{lead.name}</p>
                          {lead.company && <p className="text-xs text-muted-foreground">{lead.company}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{lead.phone}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {lead.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {lead.city}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">{SOURCE_LABELS[lead.source] || lead.source}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium', STAGE_COLORS[lead.stage])}>
                        {STAGE_LABELS[lead.stage]}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <div className="flex items-center gap-1">
                        <div className="flex-1 h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${lead.score}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{lead.score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">{timeAgo(lead.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete ${lead.name}? Leads with message or activity history are protected and will not be deleted.`)) {
                            deleteMutation.mutate(lead.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="text-sm px-2">{page} / {pagination.pages}</span>
              <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Lead Detail Slide-in Panel */}
      <AnimatePresence>
        {selectedLead && (
          <LeadDetailPanel
            leadId={selectedLead.id}
            onClose={() => setSelectedLead(null)}
          />
        )}
      </AnimatePresence>

      {/* Create Lead Modal */}
      <CreateLeadModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} title="Delete selected leads" size="sm">
        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Delete {selectedLeadIds.length} selected lead{selectedLeadIds.length === 1 ? '' : 's'} without message/activity history.
            Leads with history are protected and will be skipped.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={bulkDeleteMutation.isPending}
              onClick={() => bulkDeleteMutation.mutate({ leadIds: selectedLeadIds })}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={deleteAllOpen} onClose={() => setDeleteAllOpen(false)} title="Delete all leads" size="sm">
        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            This will delete leads without message/activity history. Leads with history are protected and will be skipped.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteAllOpen(false)}>Cancel</Button>
            <Button variant="destructive" loading={bulkDeleteMutation.isPending} onClick={() => bulkDeleteMutation.mutate({ all: true })}>
              <Trash2 className="w-4 h-4" />
              Delete All Leads
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
