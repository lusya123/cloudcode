import { NextResponse } from 'next/server';
import { getBackendUrl } from '../../../lib/api';

export async function POST(request: Request) {
  const payload = await request.json();
  const response = await fetch(`${getBackendUrl()}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
