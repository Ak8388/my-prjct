
# System Utility Hub - Tracking & Diagnostics

## ⚠️ Solusi Error Redeploy Vercel
Jika Anda mendapat error *"A more recent Production Deployment has been created..."*:
1. Masuk ke Vercel Dashboard.
2. Klik tab **Deployments**.
3. Cari deployment di daftar **paling atas** (biasanya bertanda "Production").
4. Klik titik tiga pada deployment tersebut, lalu pilih **Redeploy**.

---

## 🛠️ Persiapan Database (Supabase)

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
- Pergi ke menu **Database**.
- Pilih **Replication**.
- Klik **tables** di bagian Realtime.
- Aktifkan (On) untuk tabel **tracking**.

---

## 📡 Cara Pelacakan
1. Buka website Anda.
2. Klik versi build di pojok kiri bawah **5 kali** (Build: 1.0.4-LOCKED).
3. Dashboard Admin akan terbuka.
4. Salin **Target Deployment Link** dan kirimkan ke target.
5. Jika status di Dashboard bertanda **DB_MISSING_ENV**, berarti Anda belum mengisi Environment Variables di Vercel atau belum melakukan Redeploy.
