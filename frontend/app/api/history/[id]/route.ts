import { NextResponse } from 'next/server';
import { getBackendUrl } from '../../../../lib/api';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const response = await fetch(`${getBackendUrl()}/api/history/${params.id}`);
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
