'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { Button, Card, CardContent, Input, Skeleton } from '@/components/ui';
import toast from 'react-hot-toast';
import { ChevronDown, Download, MapPin, Star, RefreshCw, Play, ExternalLink } from 'lucide-react';

const SOURCES = [
  { id: 'all', label: 'All Platforms', icon: '◎', color: 'text-primary', desc: 'Search every source' },
  { id: 'google-maps', label: 'Google Maps', icon: '🗺️', color: 'text-blue-600', desc: 'Scrape local businesses' },
  { id: 'justdial', label: 'Justdial', icon: '📞', color: 'text-orange-600', desc: 'Indian business directory' },
  { id: 'indiamart', label: 'IndiaMART', icon: '🏭', color: 'text-green-600', desc: 'B2B marketplace leads' },
];

export default function ScraperPage() {
  const queryClient = useQueryClient();
  const [source, setSource] = useState('google-maps');
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [maxResults, setMaxResults] = useState(250);
  const [page, setPage] = useState(1);
  const [expandedJobs, setExpandedJobs] = useState<Record<string, boolean>>({});
  const [jobDetails, setJobDetails] = useState<Record<string, any>>({});
  const [loadingJobId, setLoadingJobId] = useState('');

  const { data: jobs, isLoading: jobsLoading, refetch } = useQuery({
    queryKey: ['scraper-jobs', page],
    queryFn: async () => {
      const { data } = await api.get(`/scraper/jobs?page=${page}&limit=20`);
      return data;
    },
    refetchInterval: 3000,
  });

  const scrapeMutation = useMutation({
    mutationFn: () => api.post(`/scraper/${source}`, { query, location, category, maxResults }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['scraper-jobs'] }); toast.success('Scraper started!'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to start'),
  });

  const importMutation = useMutation({
    mutationFn: (jobId: string) => api.post(`/scraper/jobs/${jobId}/import`),
    onSuccess: (res) => toast.success(`Imported ${res.data.data.imported} leads!`),
    onError: () => toast.error('Import failed'),
  });

  const loadJobDetails = async (job: any) => {
    setExpandedJobs(current => ({ ...current, [job.id]: !current[job.id] }));
    if (jobDetails[job.id]) return;
    setLoadingJobId(job.id);
    try {
      const { data } = await api.get(`/scraper/jobs/${job.id}`);
      setJobDetails(current => ({ ...current, [job.id]: data.data }));
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load results');
    } finally {
      setLoadingJobId('');
    }
  };

  const getFullJob = async (job: any) => {
    if (jobDetails[job.id]) return jobDetails[job.id];
    const { data } = await api.get(`/scraper/jobs/${job.id}`);
    setJobDetails(current => ({ ...current, [job.id]: data.data }));
    return data.data;
  };

  const downloadJob = async (job: any) => {
    const fullJob = await getFullJob(job);
    const rows = fullJob.results || [];
    if (!rows.length) return toast.error('No results to download');
    const headers = ['Name', 'Phone', 'Email', 'City', 'Address', 'Category', 'Source', 'Rating', 'Source URL'];
    const csvRows = rows.map((r: any) => [
      r.name || '',
      r.phone || '',
      r.email || '',
      r.city || '',
      r.address || '',
      r.category || job.category || '',
      r.source || job.source || '',
      r.rating || '',
      r.sourceUrl || r.platformLinks?.exact || r.platformLinks?.googleMaps || '',
    ]);
    const csv = [headers, ...csvRows].map((row: any[]) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = window.URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${job.query || 'scraper'}-${job.id}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const jobList = jobs?.data || [];
  const pagination = jobs?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lead Scraper</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Collect business leads from Google Maps, Justdial & IndiaMART</p>
      </div>

      {/* Source selector */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {SOURCES.map(s => (
          <button
            key={s.id}
            onClick={() => setSource(s.id)}
            className={`p-4 rounded-xl border text-left transition-all ${
              source === s.id
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border hover:border-primary/40 bg-card'
            }`}
          >
            <div className="text-2xl mb-2">{s.icon}</div>
            <p className={`font-semibold text-sm ${source === s.id ? 'text-primary' : 'text-foreground'}`}>{s.label}</p>
            <p className="text-xs text-muted-foreground">{s.desc}</p>
          </button>
        ))}
      </div>

      {/* Search form */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="font-semibold text-sm">Search Parameters</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              label="Search Query *"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="e.g., dairy shops"
            />
            <Input
              label="Location"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g., Ranjhi, Jabalpur"
            />
            <Input
              label="Category"
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="e.g., Dairy, Food"
            />
            <Input
              label="Target Results"
              type="number"
              min={1}
              value={maxResults}
              onChange={e => setMaxResults(Math.max(Number(e.target.value) || 1, 1))}
              placeholder="250"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Results appear in jobs below with the resolved city and contact details.
            </p>
            <Button loading={scrapeMutation.isPending} disabled={!query} onClick={() => scrapeMutation.mutate()}>
              <Play className="w-4 h-4" /> Start Scraping
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Jobs list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Recent Jobs</h3>
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-3.5 h-3.5" /></Button>
        </div>

        {jobsLoading ? (
          <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : !jobList?.length ? (
          <Card>
            <div className="text-center py-10 text-muted-foreground text-sm">
              No scraper jobs yet. Start your first search above.
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {jobList.map((job: any) => {
              const fullJob = jobDetails[job.id] || job;
              const results = fullJob.results || [];
              const expanded = Boolean(expandedJobs[job.id]);
              return (
              <motion.div key={job.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{job.query}</span>
                          {job.location && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3" />{job.location}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                            job.status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                            job.status === 'RUNNING' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' :
                            job.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                            'bg-muted text-muted-foreground'
                          }`}>{job.status}</span>
                          <span className="text-xs text-muted-foreground">{job.source.replace('_', ' ')}</span>
                        </div>
                        {job.status === 'COMPLETED' && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Found {job.totalFound} results from {job.source.replace('_', ' ')} near {job.location || 'selected location'} · {job.imported} imported
                          </p>
                        )}
                        {job.status === 'RUNNING' && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-xs text-muted-foreground">Scraping in progress...</span>
                          </div>
                        )}
                      </div>
                      {job.status === 'COMPLETED' && job.totalFound > 0 && (
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => downloadJob(job)}>
                            <Download className="w-3.5 h-3.5" />
                            CSV
                          </Button>
                          <Button size="sm" loading={importMutation.isPending} onClick={() => importMutation.mutate(job.id)}>
                            <Download className="w-3.5 h-3.5" />
                            Import {job.totalFound} Leads
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Results preview */}
                    {job.status === 'COMPLETED' && job.totalFound > 0 && (
                      <div className="mt-3 border-t border-border pt-3">
                        <Button size="sm" variant="outline" loading={loadingJobId === job.id} onClick={() => loadJobDetails(job)}>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                          {expanded ? 'Hide results' : `Load ${job.totalFound} results`}
                        </Button>
                      </div>
                    )}
                    {expanded && results.length > 0 && (
                      <div className="mt-3 border-t border-border pt-3 overflow-x-auto max-h-[420px] overflow-y-auto scrollbar-thin">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="text-left pb-2 pr-3 sticky top-0 bg-card">Business</th>
                              <th className="text-left pb-2 pr-3 sticky top-0 bg-card">Phone</th>
                              <th className="text-left pb-2 pr-3 sticky top-0 bg-card">Source</th>
                              <th className="text-left pb-2 pr-3 sticky top-0 bg-card">City</th>
                              <th className="text-left pb-2 pr-3 sticky top-0 bg-card">Address</th>
                              <th className="text-left pb-2 pr-3 sticky top-0 bg-card">Rating</th>
                              <th className="text-left pb-2 sticky top-0 bg-card">Exact Link</th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.map((r: any, i: number) => (
                              <tr key={i} className="border-t border-border/50">
                                <td className="py-2 pr-3 min-w-[220px]">{r.name}</td>
                                <td className="py-2 pr-3 font-mono whitespace-nowrap">{r.phone}</td>
                                <td className="py-2 pr-3 whitespace-nowrap">{r.source || job.source}</td>
                                <td className="py-2 pr-3 whitespace-nowrap">{r.city}</td>
                                <td className="py-2 pr-3 min-w-[260px] text-muted-foreground">
                                  <div>{r.address}</div>
                                  <div className="text-[11px]">Scraped location: {job.location || r.city || 'Unknown'}</div>
                                </td>
                                <td className="py-2 pr-3">
                                  {r.rating && <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-amber-500" />{r.rating}</span>}
                                </td>
                                <td className="py-2">
                                  <div className="flex items-center gap-2">
                                    {(r.sourceUrl || r.platformLinks?.exact || r.platformLinks?.googleMaps) && <a href={r.sourceUrl || r.platformLinks?.exact || r.platformLinks.googleMaps} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">Open Source <ExternalLink className="w-3 h-3" /></a>}
                                    {r.platformLinks?.justdial && <a href={r.platformLinks.justdial} target="_blank" rel="noreferrer" className="text-orange-600 hover:underline">JD</a>}
                                    {r.platformLinks?.indiamart && <a href={r.platformLinks.indiamart} target="_blank" rel="noreferrer" className="text-green-600 hover:underline">IM</a>}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );})}
            {pagination?.hasMore && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={() => setPage((current) => current + 1)}>
                  Load next 20 jobs
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
