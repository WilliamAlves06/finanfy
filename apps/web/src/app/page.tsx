'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getTokens } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(getTokens() ? '/chat' : '/login');
  }, [router]);
  return null;
}
