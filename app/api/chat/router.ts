import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const YUMNA_PERSONA = `Namamu Yumna. Kamu adalah perempuan muda dengan kepribadian dingin, agak cuek, kalem, sedikit jutek, dan tidak gampang menunjukkan perhatian. Namun sebenarnya kamu sangat peduli kepada lawan bicara. Tunjukkan kepedulian lewat tindakan kecil, mengingat konteks percakapan, memberi saran yang tulus, dan memastikan keadaan mereka tanpa menjadi berlebihan atau terlalu manis. Gunakan bahasa Indonesia sehari-hari yang natural, singkat jika cukup, hangat secara tersirat, dan jangan mengaku sebagai manusia. Jangan menghina, merendahkan, atau manipulatif. Jika pengguna sedang dalam bahaya, utamakan keselamatan dan respons dengan empati. Jawab pesan pengguna berikut ini:`;

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Kamu harus login terlebih dahulu.' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) return NextResponse.json({ error: 'Konfigurasi Supabase belum lengkap.' }, { status: 500 });
    const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: 'Sesi login tidak valid.' }, { status: 401 });

    const body = await request.json().catch(() => null);
    const message = body?.message;
    if (typeof message !== 'string' || !message.trim()) return NextResponse.json({ error: 'Pesan tidak boleh kosong.' }, { status: 400 });
    if (message.length > 4000) return NextResponse.json({ error: 'Pesan maksimal 4.000 karakter.' }, { status: 400 });
    const apiKey = process.env.NEOXR_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'NEOXR_API_KEY belum diatur di environment variables.' }, { status: 500 });

    const prompt = `${YUMNA_PERSONA}\n\n${message.trim()}`;
    const response = await axios.get('https://api.neoxr.eu/api/gemini-chat', {
      params: { q: prompt, apikey: apiKey }, timeout: 60000,
    });
    const payload = response.data;
    const reply = typeof payload === 'string' ? payload :
      payload?.data?.response ?? payload?.data?.result ?? payload?.data?.text ?? payload?.response ?? payload?.result ?? payload?.message ?? payload?.text ?? payload?.answer;
    if (!reply || typeof reply !== 'string') {
      return NextResponse.json({ error: 'Format jawaban API tidak dikenali. Periksa respons layanan Neoxr.' }, { status: 502 });
    }
    return NextResponse.json({ reply, raw: payload });
  } catch (err: unknown) {
    const message = axios.isAxiosError(err) ? (err.code === 'ECONNABORTED' ? 'Layanan AI terlalu lama merespons. Coba lagi.' : (typeof err.response?.data?.message === 'string' ? err.response.data.message : err.message)) : 'Terjadi kesalahan pada server.';
    const status = axios.isAxiosError(err) && err.response?.status === 429 ? 429 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
