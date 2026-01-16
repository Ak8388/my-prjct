
# System Utility Hub - Tracking & Diagnostics

## 🔓 SOLUSI DATA TIDAK MASUK (PENTING)
Supabase secara default melarang pengisian data dari aplikasi luar (RLS). Anda harus mematikan proteksi ini agar link target bisa mengirim data:

1. Buka **SQL Editor** di Supabase.
2. Jalankan perintah berikut:
   ```sql
   ALTER TABLE tracking DISABLE ROW LEVEL SECURITY;
   ```
3. Pastikan juga **Realtime** sudah aktif (Database > Replication > Tables > Centang tracking).

---

## 🔓 Solusi Diminta Login Vercel
Jika saat membuka link di HP muncul layar login Vercel:
1. Buka dashboard **Vercel > Settings > Deployment Protection**.
2. Cari **Vercel Authentication** dan pilih **Disabled**.
3. Klik **Save**, lalu **Redeploy** (Deployments > Titik Tiga > Redeploy).

---

## 📡 Cara Pelacakan
1. Dashboard Admin: Buka website Anda, klik tulisan build di pojok kiri bawah **5 kali**.
2. Status Database: Pastikan muncul indikator hijau **DB_LINKED** di atas.
3. Kirim Link: Gunakan link dari bagian "Target Deployment Link".
4. Izin Lokasi: Saat target membuka link dan klik tombol, browser akan minta izin lokasi. **Target WAJIB menekan "Allow/Izinkan"** agar data terkirim.
