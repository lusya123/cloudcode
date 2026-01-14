'use client';

import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';

const fetcher = (resource: string) => fetch(resource).then((res) => res.json());

export function Providers({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ fetcher }}>{children}</SWRConfig>;
}
