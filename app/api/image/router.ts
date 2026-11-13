import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Kamu harus login terlebih dahulu.' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const apiKey = process.env.NEOXR_API_KEY;
    if (!supabaseUrl || !anonKey) return NextResponse.json({ error: 'Konfigurasi Supabase belum lengkap.' }, { status: 500 });
    if (!apiKey) return NextResponse.json({ error: 'NEOXR_API_KEY belum diatur.' }, { status: 500 });

    const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: 'Sesi login tidak valid.' }, { status: 401 });

    const body = await request.json().catch(() => null);
    const prompt = body?.prompt;
    if (typeof prompt !== 'string' || !prompt.trim()) return NextResponse.json({ error: 'Deskripsi gambar tidak boleh kosong.' }, { status: 400 });
    if (prompt.length > 1500) return NextResponse.json({ error: 'Prompt gambar maksimal 1.500 karakter.' }, { status: 400 });

    const response = await axios.get('https://api.neoxr.eu/api/bardimg', {
      params: { q: prompt.trim(), apikey: apiKey }, timeout: 60000,
    });
    const payload = response.data;
    const candidates = [payload?.data?.url, payload?.data?.image, payload?.data?.img, payload?.url, payload?.image, payload?.img, payload?.result, payload?.data];
    const image = candidates.find((item) => typeof item === 'string' && (/^https?:\/\//i.test(item) || /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(item) || item.startsWith('iVBOR') || item.startsWith('/9j/')));
    if (!image) return NextResponse.json({ error: 'Gambar tidak ditemukan pada respons API. Pastikan layanan Neoxr mengembalikan URL atau base64 gambar.' }, { status: 502 });
    let imageUrl: string;
    if (image.startsWith('data:image/')) imageUrl = image;
    else if (/^https?:\/\//i.test(image)) {
      const parsed = new URL(image);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return NextResponse.json({ error: 'Format URL gambar tidak valid.' }, { status: 502 });
      imageUrl = parsed.toString();
    } else imageUrl = `data:image/png;base64,${image}`;
    return NextResponse.json({ imageUrl });
  } catch (err: unknown) {
    const message = axios.isAxiosError(err) ? (err.code === 'ECONNABORTED' ? 'Pembuatan gambar melewati batas waktu. Coba lagi.' : (typeof err.response?.data?.message === 'string' ? err.response.data.message : err.message)) : 'Terjadi kesalahan saat membuat gambar.';
    const status = axios.isAxiosError(err) && err.response?.status === 429 ? 429 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
