
# System Utility Hub - Tracking & Diagnostics

Aplikasi ini dirancang untuk memantau status perangkat dan lokasi dengan antarmuka diagnostik sistem.

## Cara Konfigurasi API KEY (PENTING)

Aplikasi ini menggunakan Google Gemini API untuk menganalisis lokasi. Agar fitur ini berjalan, Anda harus memasukkan `API_KEY`.

### Opsi A: Deploy ke Vercel/Netlify (Produksi)
1. Buka dashboard hosting Anda (Vercel/Netlify).
2. Masuk ke bagian **Settings** -> **Environment Variables**.
3. Tambahkan variabel baru:
   - **Key**: `API_KEY`
   - **Value**: `(Tempel API Key dari Google AI Studio di sini)`
4. Simpan dan lakukan **Redeploy**.

### Opsi B: Jalankan di Localhost
1. Buat file bernama `.env` di folder utama (root).
2. Masukkan baris berikut:
   ```env
   API_KEY=KODE_API_ANDA_DI_SINI
   ```

## Cara Penggunaan
1. **Link Admin**: Akses URL utama (misal: `https://app-anda.vercel.app`). Klik tulisan "Build: 1.0.4..." di pojok kiri bawah sebanyak 5 kali untuk membuka panel admin.
2. **Link Target (Istri)**: Di panel admin, salin "Link Untuk Istri". Kirimkan link tersebut ke HP target. Saat link dibuka, HP target akan otomatis mengirimkan data lokasi ke panel admin Anda sambil menampilkan dashboard diagnostik palsu.

## Keamanan
- Jangan pernah membagikan file `.env` atau memasukkan API Key langsung ke dalam file `.tsx`.
- Pastikan HP target memberikan izin "Lokasi" (Location) saat diminta oleh browser.
