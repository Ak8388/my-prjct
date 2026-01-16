
# System Utility Hub - Tracking & Diagnostics

## ⚠️ Solusi Layar Blank (Kosong)
Jika setelah deploy layar hanya hitam/blank:
1.  **Cek API Key**: Pastikan Anda sudah menambahkan variabel `API_KEY` di Vercel.
2.  **Redeploy**: Setelah menambah variabel, Anda **HARUS** melakukan **Redeploy** (Deploy ulang) agar variabel tersebut terbaca oleh sistem.
3.  **Hapus Cache**: Coba buka website di mode Incognito/Samaran.

## 1. Cara Mendapatkan API KEY
1. Buka [Google AI Studio](https://aistudio.google.com/).
2. Klik tombol **"Get API key"** (ikon kunci) di sebelah kiri.
3. Klik tombol biru **"Create API key in new project"**.
4. **Salin** kode yang muncul (contoh: `AIzaSyB...`).

## 2. Cara Menaruh API KEY di Vercel
1. Buka [Dashboard Vercel](https://vercel.com/).
2. Klik nama project Anda.
3. Klik tab **Settings** -> **Environment Variables**.
4. Masukkan:
   - **Key**: `API_KEY`
   - **Value**: `(Tempelkan kode AIza tadi)`
5. Klik **Save**.
6. **PENTING**: Klik tab **Deployments**, klik tombol titik tiga `(...)` pada deployment terbaru, lalu pilih **Redeploy**.

## 3. Cara Masuk ke Panel Admin
1. Buka website Anda.
2. Di pojok kiri bawah, klik tulisan `Build: 1.0.4-stable-x64` sebanyak **5 kali**.
3. Panel Admin akan muncul secara otomatis.
