
# System Utility Hub - Tracking Setup

## ✅ Status Resource (Screenshot Anda)
Resource yang Anda ambil di screenshot sudah **BENAR**.
- **URL**: Gunakan `https://dyhurwaynxpsjsrhphfh.supabase.co`
- **Anon Key**: Gunakan kunci panjang yang dimulai dengan `eyJ...`

## 🛠 Langkah Perbaikan Terakhir
Data tidak muncul kemungkinan besar karena tabel `tracking` belum ada di Supabase atau terhalang keamanan (RLS).

1. Buka Dashboard Supabase Anda.
2. Klik ikon **SQL Editor** di sidebar kiri.
3. Klik **New Query**.
4. Copy-paste kode SQL berikut:

```sql
-- 1. Buat tabel tracking
CREATE TABLE IF NOT EXISTS tracking (
  id TEXT PRIMARY KEY,
  latitude FLOAT8,
  longitude FLOAT8,
  accuracy FLOAT8,
  timestamp BIGINT
);

-- 2. Matikan proteksi (PENTING!)
ALTER TABLE tracking DISABLE ROW LEVEL SECURITY;

-- 3. Aktifkan Realtime agar dashboard update otomatis
ALTER publication supabase_realtime ADD TABLE tracking;
```

5. Klik tombol **Run**.
6. Selesai! Sekarang coba buka link diagnosa di HP lain dan klik tombol "Mulai Diagnosa". Data akan langsung muncul di dashboard utama.
