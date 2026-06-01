'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth.store';
import { Button, Input } from '@/components/ui';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Zap, MessageSquare, Users, BarChart3 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, register, isLoading } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [resetToken, setResetToken] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: 'admin@wacrm.pro', password: 'Admin@123', orgName: '', confirmPassword: '' });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('resetToken');
    if (token) {
      setResetToken(token);
      setMode('reset');
      setForm(f => ({ ...f, password: '', confirmPassword: '' }));
    }
  }, []);

  const handleSubmit = async () => {
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
        router.push('/dashboard');
        toast.success('Welcome back!');
      } else {
        if (!form.name || !form.orgName) return toast.error('Please fill all fields');
        await register({ name: form.name, email: form.email, password: form.password, orgName: form.orgName });
        router.push('/dashboard');
        toast.success('Account created!');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleForgotPassword = async () => {
    if (!form.email) return toast.error('Enter your email');
    setLocalLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: form.email });
      toast.success('Password reset link sent if the email exists');
      setMode('login');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to send reset link');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters');
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
    setLocalLoading(true);
    try {
      await api.post('/auth/reset-password', { token: resetToken, password: form.password });
      toast.success('Password updated. Please sign in.');
      setMode('login');
      setForm(f => ({ ...f, password: '', confirmPassword: '' }));
      router.replace('/auth/login');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to reset password');
    } finally {
      setLocalLoading(false);
    }
  };

  const features = [
    { icon: MessageSquare, text: 'Bulk WhatsApp Campaigns' },
    { icon: Users, text: 'Full CRM & Lead Management' },
    { icon: BarChart3, text: 'Analytics & AI Insights' },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-brand flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fff' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl">WACrm Pro</span>
          </div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              WhatsApp Marketing<br />at Scale
            </h1>
            <p className="text-white/70 text-lg mb-8">
              Send personalized campaigns, manage leads, and grow your business with AI.
            </p>
            <div className="space-y-3">
              {features.map((f, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex items-center gap-3 text-white/90"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                    <f.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-medium">{f.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
        <p className="text-white/50 text-sm relative">© 2025 WACrm Pro. All rights reserved.</p>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl gradient-brand flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold">WACrm Pro</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold">
              {mode === 'login' && 'Welcome back'}
              {mode === 'register' && 'Create account'}
              {mode === 'forgot' && 'Forgot password'}
              {mode === 'reset' && 'Reset password'}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {mode === 'login' && 'Sign in to your dashboard'}
              {mode === 'register' && 'Start your WhatsApp marketing journey'}
              {mode === 'forgot' && 'Enter your email to receive a reset link'}
              {mode === 'reset' && 'Choose a new password for your account'}
            </p>
          </div>

          {/* Demo credentials banner */}
          {mode === 'login' && (
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-sm">
              <p className="font-medium text-primary">Demo credentials pre-filled</p>
              <p className="text-muted-foreground text-xs mt-0.5">admin@wacrm.pro / Admin@123</p>
            </div>
          )}

          <div className="space-y-4">
            {mode === 'register' && (
              <>
                <Input label="Your Name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Rahul Sharma" />
                <Input label="Organization Name" value={form.orgName} onChange={e => set('orgName', e.target.value)} placeholder="My Business" />
              </>
            )}
            {mode !== 'reset' && (
              <Input label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" />
            )}
            {mode !== 'forgot' && (
              <Input label={mode === 'reset' ? 'New Password' : 'Password'} type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" />
            )}
            {mode === 'reset' && (
              <Input label="Confirm Password" type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} placeholder="••••••••" />
            )}
          </div>

          <Button
            className="w-full"
            size="lg"
            loading={isLoading || localLoading}
            onClick={mode === 'forgot' ? handleForgotPassword : mode === 'reset' ? handleResetPassword : handleSubmit}
          >
            {mode === 'login' && 'Sign In'}
            {mode === 'register' && 'Create Account'}
            {mode === 'forgot' && 'Send Reset Link'}
            {mode === 'reset' && 'Update Password'}
          </Button>

          {mode === 'login' && (
            <div className="flex items-center justify-between text-sm">
              <button onClick={() => setMode('forgot')} className="text-primary font-medium hover:underline">
                Forgot password?
              </button>
              <span className="text-muted-foreground">
                Don't have an account?{' '}
                <button onClick={() => setMode('register')} className="text-primary font-medium hover:underline">
                  Sign up
                </button>
              </span>
            </div>
          )}

          {mode !== 'login' && (
            <p className="text-center text-sm text-muted-foreground">
              <button onClick={() => setMode('login')} className="text-primary font-medium hover:underline">
                Back to sign in
              </button>
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
