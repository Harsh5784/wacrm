'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { getToken } from '@/lib/api';

export function useAuth(redirectIfUnauthenticated = true) {
  const { user, fetchMe, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!user && token) {
      fetchMe();
    } else if (!user && !token && redirectIfUnauthenticated) {
      router.push('/auth/login');
    }
  }, [user, redirectIfUnauthenticated]);

  return { user, isLoading };
}

export function useRequireAuth() {
  const { user, isLoading } = useAuth(true);
  return { user, isLoading, isAuthenticated: !!user };
}
