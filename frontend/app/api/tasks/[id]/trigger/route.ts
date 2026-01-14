import { NextResponse } from 'next/server';
import { getBackendUrl } from '../../../../../lib/api';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const response = await fetch(`${getBackendUrl()}/api/tasks/${params.id}/trigger`, { method: 'POST' });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
