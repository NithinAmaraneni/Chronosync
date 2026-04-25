'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    // Redirect based on role
    switch (user?.role) {
      case 'admin':
        router.replace('/admin/dashboard');
        break;
      case 'student':
        router.replace('/student/dashboard');
        break;
      case 'faculty':
        router.replace('/faculty/dashboard');
        break;
      default:
        router.replace('/login');
    }
  }, [isAuthenticated, user, isLoading, router]);

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center">
      <div className="text-center animate-fadeIn">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold">
            <span className="text-indigo-400">Chrono</span>
            <span className="text-cyan-400">Sync</span>
          </h1>
        </div>
        <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mt-6" />
        <p className="text-slate-400 mt-3 text-sm">Loading your dashboard...</p>
      </div>
    </div>
  );
}
