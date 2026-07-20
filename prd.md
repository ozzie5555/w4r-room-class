Berikut adalah rangkuman catatan lengkap spesifikasi teknis dan fungsional Web War Room CTF & Programming yang telah kita susun secara menyeluruh:
### 1. Analisis Masalah & Kebutuhan
 * Masalah Utama: Kompetisi CTF sering kali mengalami *context switching* yang tinggi karena komunikasi dan kolaborasi terpecah di berbagai aplikasi (Discord untuk suara, aplikasi lain untuk berbagi kode/gambar), memicu beban bandwidth berlebih serta risiko kebocoran data sensitif.
 * Fungsi Utama: Membangun *war room* virtual yang terpusat, *real-time*, dan sekali pakai (ephemeral) yang berfokus pada sinkronisasi koordinat kanvas serta teks kode tanpa integrasi server media berat.
### 2. Objektif & Kinerja Sistem
 * Target Pengguna: Tim CTF dan Engineer kolaborator.
 * Objektif: Menyediakan aplikasi kolaborasi yang ringan, responsif, stabil, dan menjaga privasi absolut melalui sistem *auto-purge* data.
 * Target Kinerja: Latensi sinkronisasi WebSocket di bawah 100ms dan *cold load time* aplikasi di bawah 1.5 detik.
### 3. Spesifikasi Arsitektur Teknis (FE & BE)
 * Frontend (FE):
   * Menggunakan Vite + React.js (TypeScript strict mode) untuk performa render komponen yang cepat dan *type-safe*.
   * State Management: Menggunakan Zustand untuk menangani *transient state* (seperti kursor *real-time* dan koordinat kanvas) tanpa *overhead re-render* berlebih.
   * Styling: Menggunakan Tailwind CSS (JIT) untuk modularitas antarmuka.
   * Canvas Engine: Menggunakan native HTML5 Canvas API dengan optimasi requestAnimationFrame untuk interpolasi gambar yang halus.
 * Backend (BE):
   * Engine: Menggunakan Bun + Elysia.js untuk mencapai latensi HTTP dan WebSocket yang sangat rendah.
   * Database & I/O: Menggunakan SQLite dengan mode WAL (*Write-Ahead Logging*) aktif untuk operasi baca/tulis konkuren secara instan tanpa server database eksternal.
   * Protokol: WebSocket untuk komunikasi *bidirectional real-time* dengan serialisasi data JSON yang ringkas.
### 4. Manajemen Data Ephemeral (Siklus Hidup Ruangan)
 * Kebijakan Zero-Auth: Tidak ada tabel *Users* permanen; identitas pengguna menggunakan UUIDv4 yang digenerate di dalam sessionStorage.
 * Auto-Purge (Self-Destruct):
   * Sistem memonitor koneksi melalui *heartbeat* setiap 30 detik.
   * Jika jumlah partisipan aktif menyentuh angka 0, sistem memulai *grace period* selama 60 detik.
   * Jika tidak ada koneksi ulang, server mengeksekusi penghapusan permanen (DELETE FROM rooms ... CASCADE) untuk menghapus seluruh riwayat obrolan, kode, kanvas, dan file dari SQLite.
### 5. Arsitektur Layout UI/UX & Desain
 * Desain Visual & Aksesibilitas:
   * Palet Warna: Menggunakan warna dasar Deep Charcoal (#0D1117) untuk mencegah kelelahan mata (*eye-strain*) selama kompetisi panjang.
   * Tipografi Kode: Komponen Code Sandbox wajib menggunakan font JetBrains Mono guna membedakan karakter krusial dengan tegas (seperti angka 0 dan huruf O, atau 1, I, dan l).
 * Dashboard 3-Kolom (Grid 250px 1fr 300px):
   * Kolom Kiri (Participants): Daftar roster anggota dengan indikator status peran.
   * Kolom Tengah (Hybrid Workspace): Kanvas HTML5 berlatar *dot-grid* dengan komponen Code Sandbox melayang di atasnya (*z-index* tinggi, dapat digeser).
   * Kolom Kanan (Binaries & Tasks): Panel manajemen file binari serta *Flag Checklist* yang tersinkronisasi antar-klien.
### 6. Logika Akses "Oper Kapur" (Role-Based Access Control)
 * Matriks Peran: Host (admin ruang dengan kontrol penuh), Presenter (akses tulis aktif), dan Viewer (default *Read-Only* dengan *pointer-events-none* pada alat gambar).
 * Alur Protokol: Viewer mengirim REQUEST_CHALK \rightarrow Host melihat indikator berkedip (*pending*) \rightarrow Host menyetujui (GRANT_CHALK) \rightarrow Server memperbarui status menjadi Presenter melalui *event-driven state machine*. Host juga dapat menggunakan tombol darurat REVOKE_ALL_CHALK.
 * Layer Interaksi: Code Sandbox diletakkan di atas kanvas dengan tingkat opasitas tertentu (85%), sehingga coretan kanvas dari bawah tetap terlihat menembus area kode layaknya stabilo di atas kaca.