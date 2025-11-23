# Panduan Deployment Rflix-API ke Debian VM (Metode GUI Wizard)

Panduan ini telah disederhanakan. Anda hanya perlu melakukan instalasi dasar via SSH, lalu sisanya (konfigurasi database, admin, dll) dilakukan melalui **Web GUI Wizard**.

## 1. Persiapan Server (Via SSH)

Masuk ke server Anda menggunakan SSH:

```bash
ssh user@ip-server-anda
```

### Update System & Install Tools

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl build-essential python3 git unzip nginx
```

### Install Node.js (Versi 18 LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

---

## 2. Upload File (Via SFTP)

Gunakan FileZilla/WinSCP untuk upload file project ke server (misal ke folder `~/rflix-api`).

**File/Folder yang WAJIB diupload:**

- 📁 `public/`
- 📁 `server/`
- 📁 `migrations/`
- 📄 `package.json`
- 📄 `tailwind.config.js`

> **JANGAN** upload folder `node_modules`.

---

## 3. Jalankan Aplikasi (Via SSH)

Kembali ke terminal SSH, masuk ke folder aplikasi dan install dependensi:

```bash
cd ~/rflix-api
mkdir -p data logs
npm install
```

Jalankan aplikasi dengan PM2:

```bash
pm2 start server/index.js --name "rflix-api"
pm2 startup
pm2 save
```

---

## 4. Konfigurasi via Web Wizard (GUI) 🚀

Sekarang aplikasi sudah berjalan dalam **Mode Setup**.

1.  Buka browser Anda dan akses: `http://ip-server-anda:3000`
    _(Jika port 3000 tertutup firewall, Anda mungkin perlu membukanya dulu atau setup Nginx di langkah 5)_

2.  Anda akan melihat halaman **Rflix Setup Wizard**.

3.  Isi form yang tersedia:

    - **Server Config**: Biarkan default jika ragu.
    - **Jellyfin Connection**: Masukkan URL dan API Key Jellyfin Anda.
    - **Security**: Klik "Generate" untuk membuat JWT Secret.
    - **Create Admin**: Masukkan email dan password untuk akun Admin pertama Anda.

4.  Klik **"Install & Configure"**.

Wizard akan otomatis:

- ✅ Menyimpan konfigurasi (`.env`)
- ✅ Membuat database & tabel
- ✅ Membuat akun admin
- ✅ Merestart aplikasi

Setelah selesai, Anda akan diarahkan ke halaman Login Admin.

---

## 5. Setup Domain (Nginx Reverse Proxy)

Agar bisa diakses tanpa port 3000 (misal `rflix.domain.com`), setup Nginx:

```bash
sudo nano /etc/nginx/sites-available/rflix
```

Isi file:

```nginx
server {
    listen 80;
    server_name domain-anda.com; # Ganti dengan domain/IP Anda

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Aktifkan:

```bash
sudo ln -s /etc/nginx/sites-available/rflix /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Selesai! 🎉
