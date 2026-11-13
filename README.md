# Yumna AI

Website AI chat bergaya Neobrutalism. Next.js + Supabase Auth/Database + Axios + Vercel.

## 1. Siapkan Supabase
1. Buat project di https://supabase.com.
2. Buka **SQL Editor**, jalankan isi `supabase/schema.sql`.
3. Buka **Project Settings → API**. Salin Project URL dan `anon` public key.
4. Untuk pengujian, buka **Authentication → Providers → Email**. Atur konfirmasi email sesuai kebutuhan. Jika konfirmasi aktif, user harus verifikasi email sebelum login.

## 2. Jalankan lokal
```bash
npm install
cp .env.example .env.local
```
Isi `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
NEOXR_API_KEY=YOUR_NEOXR_API_KEY
```
Lalu:
```bash
npm run dev
```
Buka http://localhost:3000.

## 3. Pemeriksaan sebelum deploy
```bash
npm run build
```
Pastikan build selesai tanpa error. Perintah `npm run lint` tersedia jika ingin menjalankan ESLint setelah dependency terpasang. Jika mengubah environment variables di Vercel, lakukan redeploy. Jangan commit `.env.local`.

## 4. Deploy ke Vercel
1. Push folder project ini ke repository GitHub.
2. Import repository di https://vercel.com/new.
3. Tambahkan environment variables yang sama di **Project → Settings → Environment Variables**.
4. Deploy. Setiap perubahan di branch production akan memicu deployment baru.

## 5. Catatan keamanan & API
- API Neoxr dipanggil dari `/api/chat` (chat) dan `/api/image` (generator gambar) di server. API key tidak dikirim ke browser.
- Generator gambar memakai endpoint `https://api.neoxr.eu/api/bardimg` dengan parameter `q` dan `apikey`. Aktifkan tombol **BUAT GAMBAR**, tulis prompt, lalu tekan tombol generate. Hasilnya tersimpan di riwayat chat sebagai gambar dan dapat diunduh.
- Download gambar URL eksternal diproksikan melalui `/api/image/download` setelah autentikasi; gambar data URI diunduh langsung dari browser.
- Jangan menaruh API key langsung di source code. Simpan hanya di `NEOXR_API_KEY` pada `.env.local` dan Vercel Environment Variables. Jika key pernah dibagikan secara publik, rotasi key melalui penyedia API.
- Endpoint yang diberikan hanya menerima parameter `q`. Implementasi mengirim instruksi persona + pesan user dalam satu query. Jika API tidak mendukung konteks percakapan, Yumna belum memiliki ingatan lintas pesan dari sisi model; riwayatnya tetap tersimpan di database dan tampil di UI.
- Respons API dicoba dibaca dari beberapa field umum (`data.response`, `data.result`, `response`, `result`, `message`, `text`, `answer`). Jika bentuk JSON Neoxr berbeda, sesuaikan ekstraksi `reply` pada `app/api/chat/route.ts`.
- RLS memastikan user hanya dapat membaca dan mengubah sesi serta pesan miliknya, termasuk memvalidasi kepemilikan sesi induk. SQL aman dijalankan ulang karena policy lama dihapus sebelum dibuat ulang. Jangan menaruh service-role key di frontend.
