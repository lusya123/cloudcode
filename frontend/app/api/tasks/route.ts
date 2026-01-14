import { NextResponse } from 'next/server';
import { getBackendUrl } from '../../../lib/api';

export async function GET() {
  const response = await fetch(`${getBackendUrl()}/api/tasks`);
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
