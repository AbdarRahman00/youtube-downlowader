import { NextResponse } from 'next/server';
import { getStatusMap } from './store';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get('ids')?.split(',') || [];
  
  const store = getStatusMap();
  const status = {};
  for (const id of ids) {
    status[id] = store[id] || 'none';
  }
  
  return NextResponse.json(status);
}
