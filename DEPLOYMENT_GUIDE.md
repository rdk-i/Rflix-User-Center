# Panduan Deployment Rflix-API ke Debian VM

Panduan ini menjelaskan langkah-langkah lengkap untuk men-deploy aplikasi Rflix-API ke server Debian menggunakan SSH dan SFTP.

## 1. Persiapan Server (Via SSH)

Masuk ke server Anda menggunakan SSH:

```bash
ssh user@ip-server-anda
```

### Update System & Install Tools Dasar

Pastikan sistem Anda up-to-date dan install tool yang dibutuhkan untuk kompilasi database (SQLite):

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl build-essential python3 git unzip
```

### Install Node.js (Versi 18 LTS)

Aplikasi ini membutuhkan Node.js versi 18 atau lebih baru.

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

Cek instalasi:

```bash
node -v
npm -v
```

### Install Process Manager (PM2)

PM2 digunakan agar aplikasi tetap berjalan di background (production mode).

```bash
sudo npm install -g pm2
```

### Install Nginx (Web Server)

Nginx akan bertindak sebagai Reverse Proxy.

```bash
sudo apt install -y nginx
```

---

## 2. Upload File (Via SFTP)

Gunakan aplikasi seperti **FileZilla** atau **WinSCP** untuk mengupload file dari komputer lokal ke server.

1.  Buat folder untuk aplikasi di server, misalnya: `/var/www/rflix-api` atau di home directory `~/rflix-api`.

    - _Contoh di panduan ini kita gunakan home directory:_ `~/rflix-api`

    ```bash
    mkdir -p ~/rflix-api
    ```

2.  **Upload file/folder berikut** dari project lokal Anda ke folder `~/rflix-api` di server:

    - 📁 `public/` (Folder frontend)
    - 📁 `server/` (Folder backend)
    - 📁 `migrations/` (Script database)
    - 📄 `package.json`
    - 📄 `tailwind.config.js`
    - 📄 `.env.example`

    > **PENTING:** JANGAN upload folder `node_modules` atau `.git`. Kita akan install dependensi langsung di server.

3.  Buat folder tambahan yang dibutuhkan aplikasi di server:
    ```bash
    cd ~/rflix-api
    mkdir -p data logs
    ```

---

## 3. Instalasi & Konfigurasi

Kembali ke terminal SSH.

### Install Dependensi

```bash
cd ~/rflix-api
npm install
```

_Proses ini mungkin memakan waktu beberapa saat karena perlu meng-compile `better-sqlite3`._

### Konfigurasi Environment Variable

Salin file contoh konfigurasi dan edit sesuai kebutuhan server.

```bash
cp .env.example .env
nano .env
```

**Yang perlu diubah/diperhatikan di `.env`:**

- `NODE_ENV=production`
- `PORT=3000` (atau port lain jika diinginkan)
- `JELLYFIN_URL`: URL server Jellyfin Anda.
- `JELLYFIN_API_KEY`: API Key dari Jellyfin.
- `JWT_SECRET`: Ganti dengan string acak yang panjang dan aman.
- `DB_PATH=./data/rflix.db` (Pastikan path ini benar)

Simpan perubahan (`Ctrl+O`, `Enter`, `Ctrl+X`).

### Setup Database

Jalankan migrasi untuk membuat tabel database awal.

```bash
npm run migrate
```

---

## 4. Menjalankan Aplikasi

Jalankan aplikasi menggunakan PM2:

```bash
pm2 start server/index.js --name "rflix-api"
```

Agar aplikasi otomatis jalan saat server restart:

```bash
pm2 startup
pm2 save
```

Cek status aplikasi:

```bash
pm2 status
pm2 logs rflix-api
```

---

## 5. Konfigurasi Nginx (Reverse Proxy)

Agar aplikasi bisa diakses via domain (port 80/443) tanpa mengetik port 3000.

Buat file konfigurasi Nginx baru:

```bash
sudo nano /etc/nginx/sites-available/rflix
```

Isi dengan konfigurasi berikut (ganti `domain-anda.com` dengan domain asli atau IP server):

```nginx
server {
    listen 80;
    server_name domain-anda.com; # Ganti dengan domain atau IP Anda

    location / {
        proxy_pass http://localhost:3000; # Port aplikasi Node.js
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Aktifkan konfigurasi:

```bash
sudo ln -s /etc/nginx/sites-available/rflix /etc/nginx/sites-enabled/
sudo nginx -t # Cek apakah config valid
sudo systemctl restart nginx
```

Sekarang aplikasi seharusnya bisa diakses melalui `http://domain-anda.com`.

---

## 6. Setup SSL (HTTPS) - Opsional tapi Disarankan

Jika Anda menggunakan domain, sangat disarankan menggunakan HTTPS gratis dari Let's Encrypt.

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d domain-anda.com
```

Ikuti instruksi di layar. Certbot akan otomatis mengkonfigurasi Nginx untuk HTTPS.

---

## Troubleshooting

- **Aplikasi Error/Crash**: Cek log dengan `pm2 logs rflix-api`.
- **Database Error**: Pastikan folder `data` ada dan memiliki permission write (`chmod 755 data`).
- **502 Bad Gateway**: Artinya Nginx tidak bisa menghubungi Node.js. Pastikan aplikasi jalan (`pm2 status`) dan port di config Nginx cocok dengan `.env`.
