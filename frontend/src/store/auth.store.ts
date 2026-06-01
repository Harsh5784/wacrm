import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, setTokens, clearTokens } from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  orgId: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  logo?: string;
}

interface AuthState {
  user: User | null;
  organization: Organization | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; orgName: string }) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      organization: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { email, password });
          setTokens(data.data.accessToken, data.data.refreshToken);
          set({ user: data.data.user, organization: data.data.organization, isLoading: false });
        } catch (error: any) {
          set({ isLoading: false });
          throw new Error(error.response?.data?.message || 'Login failed');
        }
      },

      register: async (formData) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/register', formData);
          setTokens(data.data.accessToken, data.data.refreshToken);
          set({ user: data.data.user, organization: data.data.organization, isLoading: false });
        } catch (error: any) {
          set({ isLoading: false });
          throw new Error(error.response?.data?.message || 'Registration failed');
        }
      },

      logout: async () => {
        try {
          const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
          await api.post('/auth/logout', { refreshToken });
        } catch {}
        clearTokens();
        set({ user: null, organization: null });
      },

      fetchMe: async () => {
        try {
          const { data } = await api.get('/auth/me');
          const { organization, ...user } = data.data;
          set({ user, organization });
        } catch (error: any) {
          if (error.response?.status === 401) {
            clearTokens();
            set({ user: null, organization: null });
          }
        }
      },
    }),
    {
      name: 'wacrm-auth',
      partialize: (state) => ({ user: state.user, organization: state.organization }),
    }
  )
);
