import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

function isPrivateAddress(ip: string) {
  const value = ip.toLowerCase();
  if (value.includes(':')) {
    if (value.startsWith('::ffff:')) return isPrivateAddress(value.slice(7));
    return value === '::' || value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:') || value.startsWith('ff');
  }
  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 || parts[0] >= 224 ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && (parts[1] === 168 || (parts[1] === 0 && parts[2] === 0) || (parts[1] === 0 && parts[2] === 2) || (parts[1] === 88 && parts[2] === 99))) ||
    (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19 || (parts[1] === 51 && parts[2] === 100))) ||
    (parts[0] === 203 && parts[1] === 0 && parts[2] === 113);
}

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = request.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'URL gambar tidak ada.' }, { status: 400 });
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) return NextResponse.json({ error: 'Konfigurasi Supabase belum lengkap.' }, { status: 500 });
    const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'Sesi login tidak valid.' }, { status: 401 });
    let parsed: URL;
    try { parsed = new URL(url); } catch { return NextResponse.json({ error: 'URL gambar tidak valid.' }, { status: 400 }); }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return NextResponse.json({ error: 'URL tidak diizinkan.' }, { status: 400 });
    const addresses = isIP(parsed.hostname) ? [{ address: parsed.hostname }] : await lookup(parsed.hostname, { all: true });
    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) return NextResponse.json({ error: 'Host gambar tidak diizinkan.' }, { status: 400 });
    const response = await fetch(parsed.toString(), { signal: AbortSignal.timeout(30000), redirect: 'error' });
    if (!response.ok) return NextResponse.json({ error: 'Gagal mengambil gambar.' }, { status: 502 });
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    if (!contentType.toLowerCase().startsWith('image/')) return NextResponse.json({ error: 'Respons bukan file gambar.' }, { status: 415 });
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 15 * 1024 * 1024) return NextResponse.json({ error: 'Ukuran gambar terlalu besar.' }, { status: 413 });
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 15 * 1024 * 1024) return NextResponse.json({ error: 'Ukuran gambar terlalu besar.' }, { status: 413 });
    return new NextResponse(bytes, { headers: { 'Content-Type': contentType, 'Content-Disposition': 'attachment; filename="yumna-ai-image.png"', 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Tidak dapat mengunduh gambar.' }, { status: 500 });
  }
}
