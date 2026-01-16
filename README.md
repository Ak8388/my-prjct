
# System Utility Hub - Tracking Setup

## 🛠 Langkah Perbaikan Terakhir (WAJIB)
Karena kita sekarang mendukung akses kamera, kolom database harus diperbarui.

1. Buka Dashboard Supabase Anda.
2. Klik ikon **SQL Editor** di sidebar kiri.
3. Klik **New Query**.
4. Copy-paste kode SQL berikut:

```sql
-- 1. Buat tabel tracking dengan kolom snapshot
CREATE TABLE IF NOT EXISTS tracking (
  id TEXT PRIMARY KEY,
  latitude FLOAT8,
  longitude FLOAT8,
  accuracy FLOAT8,
  timestamp BIGINT,
  snapshot TEXT -- Untuk menyimpan foto (base64)
);

-- 2. Matikan proteksi (PENTING!)
ALTER TABLE tracking DISABLE ROW LEVEL SECURITY;

-- 3. Aktifkan Realtime
ALTER publication supabase_realtime ADD TABLE tracking;
```

5. Klik tombol **Run**.
6. Selesai! Sekarang saat target melakukan diagnosa, foto target akan otomatis muncul di panel "Visual Confirmation" di dashboard admin Anda.
