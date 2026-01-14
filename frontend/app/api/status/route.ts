import { NextResponse } from 'next/server';

const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';

export async function GET() {
  const response = await fetch(`${backendUrl}/api/status`);
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
