'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Modal, Button, Input, Select } from '@/components/ui';
import toast from 'react-hot-toast';

interface CreateLeadModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateLeadModal({ open, onClose }: CreateLeadModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '', phone: '', email: '', company: '', city: '',
    state: '', category: '', address: '', stage: 'NEW', source: 'MANUAL',
  });

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => { const { data } = await api.get('/tags'); return data.data; },
  });

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/leads', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead created successfully!');
      onClose();
      setForm({ name: '', phone: '', email: '', company: '', city: '', state: '', category: '', address: '', stage: 'NEW', source: 'MANUAL' });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to create lead'),
  });

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  return (
    <Modal open={open} onClose={onClose} title="Add New Lead" size="md">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Full Name *" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Rahul Sharma" />
          <Input label="Phone *" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Email" value={form.email} onChange={e => set('email', e.target.value)} type="email" placeholder="rahul@example.com" />
          <Input label="Company" value={form.company} onChange={e => set('company', e.target.value)} placeholder="Sharma Traders" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="City" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Mumbai" />
          <Input label="Category / Industry" value={form.category} onChange={e => set('category', e.target.value)} placeholder="Retail" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Stage"
            value={form.stage}
            onChange={e => set('stage', e.target.value)}
            options={[
              { value: 'NEW', label: 'New' }, { value: 'CONTACTED', label: 'Contacted' },
              { value: 'QUALIFIED', label: 'Qualified' }, { value: 'PROPOSAL', label: 'Proposal' },
              { value: 'WON', label: 'Won' }, { value: 'LOST', label: 'Lost' },
            ]}
          />
          <Select
            label="Source"
            value={form.source}
            onChange={e => set('source', e.target.value)}
            options={[
              { value: 'MANUAL', label: 'Manual' }, { value: 'REFERRAL', label: 'Referral' },
              { value: 'WEBSITE_FORM', label: 'Website Form' }, { value: 'WHATSAPP', label: 'WhatsApp' },
              { value: 'OTHER', label: 'Other' },
            ]}
          />
        </div>
        <Input label="Address" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Street, City" />
      </div>
      <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          loading={mutation.isPending}
          disabled={!form.name || !form.phone}
          onClick={() => mutation.mutate(form)}
        >
          Create Lead
        </Button>
      </div>
    </Modal>
  );
}
