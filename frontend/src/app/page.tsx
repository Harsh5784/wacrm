import Link from 'next/link';
import {
  BarChart3,
  Bot,
  Check,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  Lock,
  MessageSquare,
  Search,
  Shield,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';

const features = [
  { icon: MessageSquare, title: 'Shared WhatsApp Inbox', desc: 'One organization number, shared conversations, unread counts, direct sends, assignments, and follow-up queues.' },
  { icon: Zap, title: 'Campaign Safety Engine', desc: 'Daily caps, batch pauses, warm-up aware timing, and campaign duration estimates before messages are sent.' },
  { icon: Search, title: 'Lead Scraper', desc: 'Generate leads from Google Maps, Justdial, and IndiaMART with source links, locations, ratings, and import controls.' },
  { icon: Users, title: 'CRM Pipeline', desc: 'Manage leads, statuses, reminders, notes, tags, ownership, bulk delete, CSV import, and export permissions.' },
  { icon: Bot, title: 'AI Assistant', desc: 'Create campaign drafts, reply suggestions, lead scoring, follow-up copy, and business-aware responses.' },
  { icon: BarChart3, title: 'Analytics', desc: 'Track leads, replies, delivery, active conversations, hot leads, campaign performance, and team productivity.' },
  { icon: UserCheck, title: 'Team Management', desc: 'Invite users, assign roles, deactivate users, auto-assign support chats, and monitor closed deals by executive.' },
  { icon: CreditCard, title: 'Billing & Plans', desc: 'Razorpay checkout, plan upgrades, payment history, manual plan override, and pricing controls for super admins.' },
  { icon: Lock, title: 'Super Admin Controls', desc: 'Set scraper limits, campaign limits, export restrictions, download permissions, plan pricing, and organization access.' },
];

const workflows = [
  'Scrape or import leads',
  'Assign contacts to executives',
  'Send safe WhatsApp campaigns',
  'Handle replies from shared inbox',
  'Track follow-ups and closed deals',
];

const plans = [
  { name: 'Starter', price: '₹999', items: ['Small teams', 'Lead CRM', 'Basic campaigns', 'Shared inbox'] },
  { name: 'Professional', price: '₹2,499', highlighted: true, items: ['AI assistant', 'Lead scraper', 'Team performance', 'Advanced analytics'] },
  { name: 'Enterprise', price: 'Custom', items: ['Custom limits', 'Priority support', 'Super-admin controls', 'Dedicated setup'] },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-brand">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-bold leading-none">WACrm Pro</p>
              <p className="text-xs text-muted-foreground">WhatsApp CRM for growing teams</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/auth/login" className="hidden rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:inline-flex">
              Sign in
            </Link>
            <Link href="/auth/login" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
              Open App <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-border">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1fr_32rem] lg:py-20">
          <div className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
              <Shield className="h-4 w-4" />
              Shared inbox, safer campaigns, lead generation, and CRM in one place
            </div>
            <h1 className="max-w-4xl text-4xl font-bold leading-tight md:text-6xl">
              Run your WhatsApp sales operation from one dashboard.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              WACrm Pro brings WhatsApp campaigns, CRM, lead scraping, AI replies, team assignment, billing, and super-admin controls into a practical business workspace.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/auth/login" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary/90">
                Start using WACrm <ChevronRight className="h-4 w-4" />
              </Link>
              <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-muted">
                View dashboard
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Live Business Overview</p>
                <p className="text-xs text-muted-foreground">Campaign and inbox control center</p>
              </div>
              <LayoutDashboard className="h-5 w-5 text-primary" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Follow-ups', '128', 'Open queue'],
                ['Replies', '42%', 'Reply rate'],
                ['Messages', '3,840', 'This month'],
                ['Deals', '₹8.4L', 'Closed value'],
              ].map(([label, value, sub]) => (
                <div key={label} className="rounded-xl border border-border bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-bold">{value}</p>
                  <p className="mt-1 text-xs text-primary">{sub}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-border p-4">
              <p className="mb-3 text-sm font-semibold">Campaign timing</p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Recipients</span><span>500 leads</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Today</span><span>80 messages</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Timing</span><span>22-55s + batch pauses</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-3xl font-bold">Every feature a sales team needs</h2>
          <p className="mt-2 text-muted-foreground">Built around practical workflows: generate leads, message safely, manage replies, assign work, and measure results.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-border bg-card p-5">
              <feature.icon className="mb-4 h-6 w-6 text-primary" />
              <h3 className="font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold">A clean operating workflow</h2>
            <p className="mt-3 text-muted-foreground">The platform is designed for repeated sales work, not a marketing-only landing flow.</p>
          </div>
          <div className="space-y-3">
            {workflows.map((item, index) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">{index + 1}</span>
                <span className="font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold">Plans for every stage</h2>
          <p className="mt-2 text-muted-foreground">Pricing can be controlled from the super-admin dashboard.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.name} className={`rounded-xl border p-6 ${plan.highlighted ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <p className="mt-2 text-3xl font-bold">{plan.price}</p>
              <ul className="mt-5 space-y-2">
                {plan.items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row">
          <span>WACrm Pro</span>
          <span>WhatsApp CRM, campaigns, lead generation, AI, analytics, team management, billing, and super-admin controls.</span>
        </div>
      </footer>
    </main>
  );
}
