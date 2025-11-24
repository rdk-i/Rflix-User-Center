# Rencana Implementasi Lengkap – Rflix‑API

## 1. Registrasi & Approval

- **Form Registrasi** publik dengan pilihan paket langganan (1‑12 bulan).
- Data dikirim ke endpoint `POST /api/registration` yang membuat _pending user_ di Jellyfin dan menyimpan `expirationDate`.
- Admin dapat **approve** atau **reject** melalui dashboard admin (tab _Pending_). Approve meng‑aktifkan akun, reject menghapusnya.
- Notifikasi (opsional) dapat ditambahkan di tahap selanjutnya.

### 1.5 Halaman Login (Admin & User)

- **Form Login Admin** (`public/admin_login.html`) dan **Form Login User** (`public/user_login.html`).
- Kedua form menggunakan **Google reCAPTCHA v2** **atau** **Cloudflare Turnstile** (pilihan admin) untuk mencegah serangan brute‑force.
- **UI Admin Settings**: pada _Admin → Settings → Captcha Provider_ admin dapat memilih antara **Google reCAPTCHA** atau **Cloudflare Turnstile** dan mengisi **Site‑Key** & **Secret‑Key** masing‑masing.
- **Backend**: endpoint `POST /api/auth/login` memverifikasi token sesuai provider yang dipilih:
  - Google: request ke `https://www.google.com/recaptcha/api/siteverify`.
  - Cloudflare: request ke `https://challenges.cloudflare.com/turnstile/v0/siteverify`.
- **Error handling**: bila verifikasi gagal, kembalikan **400** dengan pesan “Captcha verification failed”.
- **Autentikasi**: login berhasil menghasilkan **JWT** (atau session cookie) dengan klaim `role: "admin"` atau `role: "user"` serta `jellyfinUserId` bila user.
- **Rate limiting** pada endpoint login: maksimal **5 percobaan per menit per IP**; setiap kegagalan dicatat di audit log (IP, User‑Agent) untuk deteksi brute‑force.
- **Provider default**: Cloudflare Turnstile (sesuai preferensi Anda). Kunci disimpan di environment variables (`CAPTCHA_PROVIDER=cloudflare`, `CLOUDFLARE_SITE_KEY`, `CLOUDFLARE_SECRET_KEY`).

## 2. Manajemen Pengguna di Dashboard Admin

- **Create User** (manual oleh admin).
- **Disable User** dengan tanggal akhir atau jumlah hari (scheduler otomatis men‑disable saat kedaluwarsa).
- **Enable User** kembali.
- **Delete User** – hanya dapat dilakukan secara manual oleh admin.
- Semua aksi ter‑integrasi dengan Jellyfin API (`POST /Users/New`, `PUT /Users/{id}/Policy`, `DELETE /Users/{id}`).
- Scheduler (`server/scheduler/disable_expired.js`) memeriksa tabel `user_expiration` tiap jam.

## 3. Paket Langganan & Dashboard Pengguna

- Pada registrasi, pengguna memilih paket (1‑12 bulan). Sistem menghitung `expirationDate` dan menyimpannya.
- **Dashboard Admin** menampilkan kolom **Expiration** pada tabel semua user.
- **Dashboard Pengguna** (`public/user_dashboard.html`) menampilkan status langganan, sisa hari, dan tombol _Perpanjang_ (fitur future).

## 4. Notifikasi Telegram

### 4.1. Admin

- **Pengaturan Bot API Key**: admin dapat memasukkan token bot Telegram yang akan dipakai.
- **Pemilihan Notifikasi**: admin dapat memilih jenis notifikasi yang ingin dikirim (pendaftaran baru, langganan hampir habis, akun dinon‑aktifkan, dll.) via UI checklist.
- **Chat ID Tujuan**: admin dapat menambahkan satu atau lebih _chat ID_ (grup atau pribadi) yang akan menerima notifikasi.
- Pengaturan disimpan di `config/telegram.json` atau basis data kecil (SQLite/JSON).

### 4.2. User

- Pada _user dashboard_ terdapat toggle **Enable Telegram Notification** (yes/no).
- Jika di‑aktifkan, sistem menyimpan `telegramChatId` (diperoleh dari bot melalui perintah `/start` atau input manual) pada profil pengguna.
- Notifikasi ke user meliputi: reminder 3 hari sebelum masa berlangganan habis, konfirmasi perpanjangan, dan notifikasi ketika akun di‑disable/aktifkan.

### 4.3. Implementasi Backend

- **Endpoint** `POST /api/notifications/telegram/config` (admin) untuk menyimpan bot token, chat IDs, dan jenis notifikasi.
- **Endpoint** `POST /api/notifications/telegram/user` (user) untuk meng‑update preferensi (`enabled: true/false`, `chatId`).
- **Utility** `telegram.js` yang membungkus panggilan ke API Telegram (`sendMessage`).
- Scheduler yang sudah ada akan memanggil utility ini ketika mendeteksi event (pendaftaran baru, kedaluwarsa, dll.).

## 5. Fitur Tambahan (dipilih)

### 5.1. Notifikasi Email / Push

- **Tujuan**: Mengirim email atau push notification kepada admin dan/atau user ketika terjadi peristiwa penting (pendaftaran baru, masa langganan hampir habis, akun dinon‑aktifkan/diaktifkan).
- **UI Admin**: Pada _Settings → Notification Preferences_ terdapat checklist untuk memilih jenis notifikasi (Email, Push, atau keduanya).
- **UI User**: Toggle **Enable Email / Push** pada _User Dashboard_.
- **Backend**: Endpoint `POST /api/notifications/config` (admin) dan `POST /api/notifications/user` (user) menyimpan preferensi di `config/notification.json` atau tabel `user_notifications`.
- **Utility**: Modul `notification.js` dengan fungsi `sendEmail(to, subject, html)` (menggunakan **nodemailer**) dan `sendPush(toDevice, payload)` (menggunakan **Firebase Cloud Messaging**).
- **Trigger**: Dipanggil oleh scheduler atau event handler (registrasi, disable, enable, renewal, dll.).
- **Keamanan**: Kredensial SMTP / FCM disimpan di environment variables, tidak pernah di‑repo.
- **Pengujian**: Mock SMTP/FCM, unit test untuk utility, integration test untuk endpoint.

### 5.2. Riwayat Aktivitas (Audit Log)

- **Tujuan**: Menyimpan jejak semua aksi admin (create, disable, enable, delete, perubahan paket, perubahan konfigurasi).
- **Penyimpanan**: Tabel `audit_log` (SQLite) dengan kolom `id`, `adminId`, `action`, `targetUserId`, `details` (JSON), `timestamp`, `ip`, `userAgent`.
- **Middleware**: `auditLogger` dipasang pada semua route admin; contoh: `auditLogger('CREATE_USER', req.body)`.
- **UI**: Tab **Logs** pada _Admin Dashboard_ menampilkan tabel dengan filter tanggal, tipe aksi, pencarian username.
- **Rotasi**: Cron job harian memindahkan log >90 hari ke arsip CSV atau menghapusnya.
- **Keamanan**: Hanya role **super‑admin** yang dapat mengekspor log.
- **Pengujian**: Verifikasi setiap route menulis entri log yang tepat; uji filter & export.

### 5.3. Paket Diskon & Kupon

- **Tujuan**: Memungkinkan admin membuat kode kupon yang memberikan potongan persentase atau nilai tetap pada paket langganan.
- **Model Data**: Tabel `coupons` (`code`, `type` (`percent`/`fixed`), `value`, `validFrom`, `validTo`, `maxUses`, `usedCount`).
- **UI Admin**: Form **Create Coupon** (code, tipe, nilai, tanggal berlaku, batas penggunaan). Daftar kupon aktif dengan status.
- **UI User**: Field **Enter Coupon Code** pada _User Dashboard_; setelah valid, sistem memperpanjang `expirationDate` sesuai diskon.
- **Backend**: Endpoint `POST /api/coupons` (admin) → insert; `POST /api/coupons/redeem` (user) → validasi, update `usedCount`, perpanjang langganan.
- **Validasi**: Pastikan kupon belum kedaluwarsa, belum melebihi `maxUses`, dan belum pernah dipakai oleh user yang sama.
- **Pengujian**: Unit test untuk validasi kupon, integration test untuk flow redeem, UI test untuk error handling.

### 5.4. Statistik Penggunaan

- **Tujuan**: Menyajikan metrik operasional (jumlah pengguna aktif, churn rate, total jam streaming, rata‑rata sesi per user, dll.).
- **Pengumpulan Data**: Scheduler `stats_collector.js` memanggil Jellyfin API `GET /Statistics/Users` & `GET /Statistics/Playback` tiap jam, menyimpan di tabel `usage_stats`.
- **UI Admin**: Dashboard **Analytics** menampilkan chart (Chart.js) untuk tiap metrik, pilihan rentang waktu (7 hari, 30 hari, 90 hari).
- **Export**: Tombol **Export CSV** untuk mengunduh data mentah.
- **Keamanan**: Hanya role **analytics** yang dapat mengakses.
- **Pengujian**: Mock API Jellyfin, pastikan data tersimpan & chart menampilkan nilai yang tepat.

### 5.5. Self‑Service Renewal

- **Tujuan**: Memungkinkan pengguna memperpanjang masa langganan tanpa menunggu admin.
- **UI User**: Tombol **Perpanjang Langganan** pada _User Dashboard_ → modal pilih paket (1‑12 bulan) atau masukkan kode kupon.
- **Backend**: Endpoint `POST /api/users/:id/renew` menerima `months` & optional `couponCode`. Logika: <ul><li>Hitung `newExpiration = currentExpiration + months`.</li><li>Jika ada kupon, terapkan diskon.</li><li>Update `user_expiration` di DB.</li></ul>
- **Notifikasi**: Setelah sukses, kirim notifikasi **Email** & **Telegram** (jika di‑enable).
- **Pengujian**: Test skenario renewal dengan/ tanpa kupon, pastikan tanggal diperpanjang dengan benar.

### 5.6. Role‑Based Access Control (RBAC)

- **Tujuan**: Membatasi hak akses berdasarkan peran (admin, moderator, support, user).
- **Model**: Tabel `roles` (`id`, `name`, `permissions` JSON) & tabel `user_roles` (`userId`, `roleId`).
- **Permissions**: Daftar aksi: `CREATE_USER`, `DISABLE_USER`, `VIEW_STATS`, `MANAGE_COUPONS`, `CONFIG_TELEGRAM`, dll.
- **Middleware**: `authorize(requiredPermissions)` memeriksa `req.user.role.permissions`. Diletakkan sebelum setiap route admin.
- **UI Admin**: Halaman **Roles** untuk membuat/ubah peran dan meng‑assign permission via checkbox list.
- **Keamanan**: Endpoint yang tidak memiliki permission mengembalikan **403 Forbidden**.
- **Pengujian**: Unit test middleware, integration test tiap peran mengakses endpoint yang diizinkan/tidak diizinkan.

### 5.7. Integrasi dengan Media‑Server Monitoring

- **Tujuan**: Menampilkan statistik penggunaan per‑user (jam streaming, konten paling sering ditonton) pada **Admin Dashboard**.
- **Pengambilan Data**: Scheduler `media_monitor.js` tiap 30 menit memanggil Jellyfin API `GET /Users/{id}/Views` & `GET /Items/{id}/PlaybackInfo`.
- **Model**: Tabel `user_media_stats` (`userId`, `itemId`, `playCount`, `totalTime`).
- **UI**: Tab **Media Usage** menampilkan tabel dengan filter **User**, **Item**, **Date Range**; chart **Top 10 Content**.
- **Keamanan**: Hanya role **admin** atau **analyst** yang dapat melihat.
- **Pengujian**: Mock API, verifikasi aggregasi data dan tampilan UI.

### 5.8. Dark‑Mode Toggle & Theme Customizer

- **Tujuan**: Menyediakan tampilan gelap premium serta kemampuan mengubah warna utama (HSL) secara dinamis.
- **Implementasi CSS**: Variabel CSS (`--primary-h`, `--primary-s`, `--primary-l`, `--bg`, `--text`) didefinisikan di `:root`. Dark mode meng‑override dengan nilai gelap.
- **UI**: Switch **Dark Mode** di header (admin & user). Pada **Settings → Theme**, terdapat slider untuk hue, saturation, lightness.
- **Persistensi**: Pilihan disimpan di `localStorage` untuk user, dan di `config/theme.json` untuk admin (global).
- **Responsif**: Semua komponen (cards, tables, modals) menggunakan variabel sehingga otomatis mengikuti tema.
- **Pengujian**: E2E test memastikan perubahan tema berlaku pada semua elemen dan tidak memengaruhi fungsi lain.

### 5.9. Internationalization (i18n) – Bahasa Indonesia & Inggris

- **Tujuan**: Menyajikan UI dalam dua bahasa (ID & EN).
- **Library**: `i18next` + `i18next-browser-languagedetector`.
- **File Bahasa**: `locales/id/translation.json` & `locales/en/translation.json`.
- **UI**: Dropdown **Language** di header. Pilihan disimpan di `localStorage` dan/atau cookie.
- **Fallback**: Jika key tidak ada di bahasa terpilih, fallback ke bahasa Inggris.
- **Pengujian**: Unit test memastikan semua keys ada di kedua file; UI test untuk pergantian bahasa tanpa reload.

### 5.10. Backup & Restore Pengguna

- **Tujuan**: Memungkinkan admin mengekspor semua data pengguna (profil, expiration, role, notification prefs) ke file JSON/CSV dan meng‑import kembali bila diperlukan.
- **Endpoint**: `GET /api/admin/users/export` → streaming JSON.<br>`POST /api/admin/users/import` (multipart file) → validasi dan insert/update.
- **Validasi**: Schema validator (`ajv`) memastikan struktur JSON sesuai.
- **Keamanan**: Hanya role **super‑admin** yang dapat mengakses; file tidak disimpan di server setelah proses selesai.
- **UI**: Tombol **Export Users** & **Import Users** pada **Admin → Users**.
- **Pengujian**: Test export dengan dataset besar, import dengan data yang sudah ada (upsert).

### 5.11. Captcha pada Form Registrasi

- **Tujuan**: Mencegah pendaftaran bot/spam dengan Google reCAPTCHA v2.
- **UI**: Widget reCAPTCHA di `public/registration.html`.
- **Backend**: Verifikasi token ke `https://www.google.com/recaptcha/api/siteverify` menggunakan secret key (`RECAPTCHA_SECRET`).
- **Konfigurasi**: Admin dapat memasukkan **Site Key** & **Secret Key** pada **Admin → Settings → reCAPTCHA**.
- **Error Handling**: Jika verifikasi gagal, kembalikan 400 dengan pesan “Captcha verification failed”.
- **Keamanan**: Kunci disimpan di environment variables.
- **Pengujian**: Mock response Google, pastikan registrasi ditolak tanpa token atau token invalid.

### 5.12. API Rate Limiting & Throttling

- **Tujuan**: Membatasi jumlah request per IP pada endpoint publik (registrasi, login) untuk mencegah serangan DDoS atau brute‑force.
- **Middleware**: `express-rate-limit` dengan konfigurasi: <ul><li>max = 20 request per 15 menit untuk `/api/registration`.</li><li>max = 30 request per 15 menit untuk `/api/login`.</li></ul>
- **Response**: `429 Too Many Requests` dengan pesan JSON yang jelas.
- **Logging**: Setiap pelanggaran dicatat di `audit_log` dengan tipe `RATE_LIMIT`.
- **Pengujian**: Simulasi burst request dengan `supertest` untuk memastikan limit berfungsi.

## 6. Infrastruktur & DevOps

- **Database**: SQLite file `data/rflix.db`. Semua tabel dibuat melalui migration script (`migrations/001_init.sql`).
- **Migration / Seed**: Skrip `npm run migrate` yang menjalankan semua file SQL di folder `migrations/`.
- **Scheduler Architecture**: Semua scheduled tasks berada di `server/scheduler/`. File `scheduler/index.js` meng‑import dan menjalankan tiap task, interval di‑konfigurasi lewat env (`DISABLE_EXPIRED_INTERVAL`, `STATS_COLLECT_INTERVAL`, dll.).
- **Service Layer**: `services/jellyfinService.js` menggunakan `axios` dengan circuit‑breaker (`opossum`). Semua controller memanggil service, bukan langsung ke Jellyfin API.
- **Logging**: Structured logging dengan `pino`. Log disimpan di `logs/app.log` dan juga output ke console.
- **Health Check**: Endpoint `GET /health` mengembalikan status `{ status: "ok", uptime: process.uptime() }`.
- **Docker**: Dockerfile disediakan untuk containerisasi; volume `/data` dipetakan ke host untuk menyimpan SQLite dan logs.
- **Backup Scheduler**: Cron job (`server/scheduler/backup_db.js`) yang menyalin `rflix.db` ke `backups/` dengan timestamp harian dan retensi 30 hari.
- **CI/CD**: GitHub Actions workflow yang menjalankan lint, unit tests, dan build Docker image.

## 7. Revision Guidelines (Ringkas)

### 1. Authentication & Security Enhancements

- JWT / session cookie, bcrypt, rate‑limit, CORS whitelist, CSRF (if cookies), unified error JSON.

### 2. Database Consolidation

- SQLite only, JSON for static config, schema definitions for all tables.

### 3. User Model Clarifications

- `api_users` table, link to Jellyfin `jellyfinUserId`, JWT‑based login.

### 4. Error Handling Framework

- Standard error object `{ code, message, details? }`.

### 5. Scheduler Architecture Update

- All tasks in `server/scheduler`, `scheduler/index.js`, env‑driven intervals.

### 6. Admin Activity Logging Improvement

- Log IP & User‑Agent, config changes, brute‑force detection.

### 7. Service Layer Introduction

- Jellyfin service wrapper, circuit‑breaker.

### 8. Documentation & Swagger

- OpenAPI 3 via Swagger, `docs/openapi.yaml`.

### 9. Additional Feature Recommendations

- Webhook outbound, admin impersonation, orphan Jellyfin user cleanup, media stat deletion on user removal.

### 10. Folder Structure Standardization

```
server/
 ├── controllers/
 ├── routes/
 ├── services/
 ├── scheduler/
 ├── utils/
 ├── models/
 ├── middlewares/
 ├── config/
 └── index.js

public/
 ├── registration.html
 ├── user_dashboard.html
 ├── admin_login.html
 ├── user_login.html
 └── admin_dashboard/
```

### 11. Security Layer Enhancements

- Strict cookie flags, JWT blacklist, input sanitization.

### 12. Enhancement for API Keys

- Document usage, secure storage via env.

### 13. Testing Coverage

- Unit tests (auth, scheduler, service, error), integration tests, E2E.

---

_Catatan_: Fitur **Payment Gateway** dan **Two‑Factor Authentication** tidak dimasukkan sesuai permintaan.
