# Tugas 5 - Validasi, Error Handling & Audit Log

Aplikasi Sistem Review Kantin kampus yang dilengkapi dengan sistem Audit Log. Backend dibangun dengan Express.js dan Microsoft SQL Server, sedangkan frontend dibangun dengan React dan TypeScript melalui Axios.

Fitur utama Tugas 5 meliputi pencatatan audit autentikasi (LOGIN dan LOGOUT beserta `ip_address`, `user_agent`, dan `result`), endpoint riwayat serta detail audit khusus admin dengan filter dan pagination database, proteksi tabel `AUDIT_LOGS` bersifat append-only menggunakan trigger SQL Server, halaman riwayat dan modal detail di frontend, serta fitur bonus pencatatan audit atomik untuk tabel `STALLS` dan `REVIEWS`.

## Teknologi

| Bagian | Teknologi |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Axios, lucide-react |
| Backend | Node.js, Express 5, TypeScript (tsx), mssql, Drizzle ORM, Zod, JWT, bcryptjs, Swagger UI |
| Database | Microsoft SQL Server |

## Struktur Proyek

```text
.
|-- backend/
|   |-- sql/
|   |   |-- 00-setup-mixed-mode.sql
|   |   |-- 01-create-database-and-user.sql
|   |   |-- 02-schema.sql
|   |   |-- 03-seed.sql
|   |   `-- 04-audit-log-append-only.sql   # Index performa dan trigger append-only AUDIT_LOGS
|   |-- src/
|   |   |-- controllers/                   # authController, stallController, reviewController, auditLogController
|   |   |-- db/                            # index.ts (pool + Drizzle), request.ts, transaction.ts
|   |   |-- dtos/                          # auditLogDto, authDto, stallDto, reviewDto
|   |   |-- errors/                        # AppError, ValidationError, UnauthorizedError, ForbiddenError, NotFoundError
|   |   |-- middlewares/                   # auth, authorize, validate, errorHandler, notFound
|   |   |-- repositories/                  # auditLogRepository, stallRepository, reviewRepository, userRepository
|   |   |-- routes/                        # authRouter, stallRouter, auditLogRouter
|   |   |-- schemas/                       # auditLogSchema, authSchema, stallSchema, reviewSchema
|   |   `-- services/                      # auditLogService, authService, stallService, reviewService
|   |-- .env.example
|   `-- test-e2e.ts                        # Pengujian otomatis endpoint, filter, RBAC, trigger, dan bonus
`-- frontend/
    |-- src/
    |   |-- components/                    # Header, ProtectedRoute, StallCard, StallForm, ConfirmDialog, ui
    |   |-- context/                       # AuthContext, ToastContext
    |   |-- lib/                           # http.ts, api.ts, audit.ts, errors.ts, format.ts, permissions.ts
    |   |-- pages/                         # AuditLogPage, StallListPage, StallDetailPage, StallFormPage, LoginPage, RegisterPage, ProfilePage, StatusPages
    |   `-- types/                         # api.ts, auditLog.ts
    `-- .env.example
```

## Prasyarat

- Node.js 22 atau lebih baru
- Microsoft SQL Server aktif dengan database `review_kantin`
- Port `3000` (backend) dan `5173` (frontend) tersedia

## Instalasi dan Menjalankan

### 1. Database SQL Server

Jalankan skrip SQL di folder `backend/sql/` secara berurutan di SSMS menggunakan akun dengan hak DDL (misalnya Windows Authentication / sysadmin):

1. `00-setup-mixed-mode.sql` (jika belum)
2. `01-create-database-and-user.sql` (jika belum)
3. `02-schema.sql` (jika belum)
4. `03-seed.sql` (jika belum)
5. `04-audit-log-append-only.sql` (membuat index audit dan trigger `TR_AUDIT_LOGS_AppendOnly`)

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Isi kredensial database dan JWT_SECRET pada file .env
npm run dev
```

Backend berjalan di `http://localhost:3000` dan dokumentasi Swagger di `http://localhost:3000/docs`.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend berjalan di `http://localhost:5173`.

## Konfigurasi Environment

### backend/.env.example

| Variabel | Keterangan |
| --- | --- |
| `PORT` | Port server Express (default `3000`) |
| `CORS_ORIGIN` | Origin frontend yang diizinkan (default `http://localhost:5173`) |
| `DB_SERVER`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Koneksi database SQL Server |
| `DB_ENCRYPT`, `DB_TRUST_SERVER_CERTIFICATE` | Opsi enkripsi koneksi SQL Server |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Secret key dan masa berlaku JWT |
| `BCRYPT_SALT_ROUNDS` | Jumlah salt round untuk hashing password |

### frontend/.env.example

| Variabel | Keterangan |
| --- | --- |
| `VITE_API_BASE_URL` | URL dasar API backend tanpa `/` di akhir (default `http://localhost:3000`) |

## Akun Uji (Seed)

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@kantin.test` | `admin123` |
| Owner | `budi.owner@kantin.test` | `rahasia123` |
| Customer | `andi@kantin.test` | `rahasia123` |

## Endpoint Utama

| Method | Path | Akses | Fungsi |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Publik | Registrasi pengguna baru (role `customer`) |
| `POST` | `/auth/login` | Publik | Login, mengembalikan JWT, dan mencatat audit `LOGIN` (`ip_address`, `user_agent`, `role`, `result`) |
| `POST` | `/auth/logout` | Terautentikasi | Logout dan mencatat audit `LOGOUT` secara best-effort |
| `GET` | `/auth/me` | Terautentikasi | Informasi pengguna yang sedang login |
| `GET` | `/stalls` | Publik | Daftar warung dengan pencarian, filter, dan pagination |
| `GET` | `/stalls/:id` | Publik | Detail warung |
| `POST` | `/stalls` | Owner, Admin | Tambah warung dan mencatat audit `CREATE_STALL` dalam satu transaksi |
| `PUT` | `/stalls/:id` | Owner (milik sendiri), Admin | Ubah warung dan mencatat audit `UPDATE_STALL` (`before`, `after`, `changed`) dalam satu transaksi |
| `DELETE` | `/stalls/:id` | Admin | Hapus warung dan mencatat audit `DELETE_STALL` (`before`) dalam satu transaksi |
| `POST` | `/stalls/:id/reviews` | Terautentikasi | Tambah review warung dan mencatat audit `CREATE_REVIEW` dalam satu transaksi |
| `GET` | `/api/audit-logs` | Admin | Daftar riwayat audit log dengan filter dan pagination database |
| `GET` | `/api/audit-logs/:id` | Admin | Detail satu catatan audit log (mengembalikan `404` jika tidak ditemukan) |

### Parameter Query `GET /api/audit-logs`

| Parameter | Tipe | Default | Aturan |
| --- | --- | --- | --- |
| `page` | integer | `1` | Minimal `1`. Nilai `0` atau negatif ditolak `400` |
| `pageSize` | integer | `20` | Antara `1` sampai `100`. Di luar rentang ditolak `400` |
| `action` | string | tanpa filter | Maksimal 50 karakter, cocok persis |
| `targetTable` | string | tanpa filter | Maksimal 50 karakter, cocok persis |
| `targetId` | integer | tanpa filter | Bilangan bulat positif |
| `userId` | integer | tanpa filter | Bilangan bulat positif |
| `from` | tanggal | tanpa filter | Format `YYYY-MM-DD`, tanggal valid kalender, inklusif awal hari |
| `to` | tanggal | tanpa filter | Format `YYYY-MM-DD`, tanggal valid kalender, inklusif akhir hari |

Ketentuan validasi tambahan:
- Semua filter digabung dengan logika `AND`.
- Jika `from` lebih besar dari `to`, backend mengembalikan `400`.
- Parameter yang tidak dikenal ditolak dengan `400` (skema Zod `.strict()`).
- Hasil diurutkan berdasarkan `created_at DESC, id DESC`.
- `userName` dan `userEmail` diambil dari tabel `USERS` melalui `LEFT JOIN` saat data dibaca.

## Proteksi Append-Only Database

Tabel `dbo.AUDIT_LOGS` dilindungi oleh trigger `TR_AUDIT_LOGS_AppendOnly` (`INSTEAD OF UPDATE, DELETE`) yang menolak seluruh operasi `UPDATE` dan `DELETE` dengan error `50010: AUDIT_LOGS bersifat append-only.`. Aplikasi juga tidak menyediakan endpoint untuk mengubah atau menghapus audit log.

## Pengujian Otomatis

Untuk menjalankan pengujian otomatis terhadap autentikasi (`LOGIN`/`LOGOUT`), RBAC (`401`/`403`/`200`), filter query, validasi (`400`), detail (`200`/`404`), trigger append-only, serta bonus audit `STALLS` dan `REVIEWS`:

```bash
cd backend
npm run test:e2e
```
