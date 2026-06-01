import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function formatDate(date: string | Date, fmt = 'MMM d, yyyy') { return format(new Date(date), fmt); }
export function timeAgo(date: string | Date) { return formatDistanceToNow(new Date(date), { addSuffix: true }); }
export function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
export function initials(name: string) { return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }

export const STAGE_COLORS: Record<string, string> = {
  NEW: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  CONTACTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  QUALIFIED: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  PROPOSAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  NEGOTIATION: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  WON: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  LOST: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  DORMANT: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};
export const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  RUNNING: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  PAUSED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  COMPLETED: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};
export const STAGE_LABELS: Record<string, string> = {
  NEW: 'New', CONTACTED: 'Contacted', QUALIFIED: 'Qualified',
  PROPOSAL: 'Proposal', NEGOTIATION: 'Negotiation', WON: 'Won', LOST: 'Lost', DORMANT: 'Dormant',
};
export const SOURCE_LABELS: Record<string, string> = {
  MANUAL: 'Manual', CSV_IMPORT: 'CSV', GOOGLE_MAPS: 'Google Maps',
  JUSTDIAL: 'Justdial', INDIAMART: 'IndiaMART', WEBSITE_FORM: 'Website', WHATSAPP: 'WhatsApp', OTHER: 'Other',
};
export const WA_VARIABLES = ['{{name}}', '{{phone}}', '{{city}}', '{{company}}', '{{category}}'];

export const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  NEW_LEAD: 'New Lead',
  INTERESTED: 'Interested',
  NOT_INTERESTED: 'Not Interested',
  FOLLOW_UP_PENDING: 'Follow-Up Pending',
  CALLBACK: 'Callback',
  CONVERTED: 'Converted',
  CLOSED: 'Closed',
  NO_RESPONSE: 'No Response',
};

export const CUSTOMER_STATUS_COLORS: Record<string, string> = {
  NEW_LEAD: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  INTERESTED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  NOT_INTERESTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  FOLLOW_UP_PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  CALLBACK: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  CONVERTED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  CLOSED: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  NO_RESPONSE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
};
