# JOURNAL AI WRITER

Platform kecerdasan buatan untuk menyusun, mengembangkan, menyunting, mengelola referensi terverifikasi (Crossref, OpenAlex, Semantic Scholar), serta memformat dan mengekspor artikel ilmiah ke `.docx` dan `.pdf`.

## Menjalankan Secara Lokal

```bash
npm install
cp .env.example .env
# Isi GEMINI_API_KEY di .env
npm run dev
```

Aplikasi berjalan pada `http://localhost:3000`.

## Push ke GitHub & Deploy ke Vercel

### 1. Push ke GitHub

```bash
git init
git add .
git commit -m "Initial commit: JOURNAL AI WRITER"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

### 2. Deploy ke Vercel

1. Buka [vercel.com/new](https://vercel.com/new) dan impor repositori GitHub Anda.
2. Vercel akan otomatis membaca konfigurasi dari `vercel.json`:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Serverless API**: `/api/index.ts` menangani seluruh rute `/api/*`
3. Tambahkan **Environment Variables** pada pengaturan proyek Vercel:
   - `GEMINI_API_KEY` = API key Gemini Anda
4. Klik **Deploy**.

> Catatan: Pada mode serverless Vercel, data ruang kerja juga disinkronkan secara otomatis ke `localStorage` browser agar naskah, referensi, dan riwayat aktivitas tetap aman meskipun terjadi *cold start*.
