// scripts/backup-ke-drive.mjs
// Backup terjadwal seluruh koleksi Firestore ke Google Drive.
// Dijalankan oleh GitHub Actions (.github/workflows/backup-drive.yml).
//
// Sengaja TIDAK memakai dependensi npm apa pun (hanya modul bawaan Node.js
// seperti crypto & fetch) agar tidak perlu menambah package.json di root
// repo - kehadiran package.json bisa membuat Vercel mengubah cara proyek
// ini di-deploy (dari situs statis murni menjadi proyek Node.js).

import crypto from 'node:crypto';

const PROJECT_ID = 'pt-erapee-finance';
const KOLEKSI_DIBACKUP = [
    'jurnal_transaksi',
    'activity_logs',
    'users',
    'master_unit_usaha',
    'master_coa',
    'aset_tetap',
    'bukti_transaksi',
    'pengaturan',
    'pengaturan_sistem'
];
const MAKS_BACKUP_DISIMPAN = 30; // rotasi: hapus backup Drive yang lebih lama dari 30 file terakhir

function base64Url(input) {
    return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Token untuk baca Firestore, memakai Service Account (role read-only
// "Cloud Datastore Viewer") - dibatasi kewenangannya lewat IAM, bukan
// lewat kode.
async function ambilTokenViaServiceAccount(serviceAccount, scopes) {
    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const claim = {
        iss: serviceAccount.client_email,
        scope: scopes.join(' '),
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600
    };
    const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(unsigned);
    const signature = base64Url(signer.sign(serviceAccount.private_key));
    const jwt = `${unsigned}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt
        })
    });
    if (!res.ok) throw new Error(`Gagal mendapatkan token Service Account: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.access_token;
}

// Token untuk upload ke Google Drive, memakai identitas akun Google pengguna
// sendiri (lewat refresh token OAuth) - BUKAN Service Account. Google tidak
// memberi Service Account jatah penyimpanan Drive sendiri sejak pertengahan
// 2023 ("Service Accounts do not have storage quota"), kecuali lewat Shared
// Drive (fitur Google Workspace berbayar) yang tidak tersedia di akun Gmail
// biasa. Dengan token akun pengguna, file yang diunggah terhitung ke kuota
// Drive pribadi pengguna, sama seperti kalau mereka upload manual.
async function ambilTokenViaOAuthUser(clientId, clientSecret, refreshToken) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken
        })
    });
    if (!res.ok) throw new Error(`Gagal refresh token OAuth pengguna: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.access_token;
}

function konversiNilaiFirestore(value) {
    if (value.nullValue !== undefined) return null;
    if (value.booleanValue !== undefined) return value.booleanValue;
    if (value.integerValue !== undefined) return Number(value.integerValue);
    if (value.doubleValue !== undefined) return value.doubleValue;
    if (value.stringValue !== undefined) return value.stringValue;
    if (value.timestampValue !== undefined) return value.timestampValue;
    if (value.arrayValue !== undefined) return (value.arrayValue.values || []).map(konversiNilaiFirestore);
    if (value.mapValue !== undefined) return konversiDokumenFirestore(value.mapValue.fields || {});
    // Tipe tidak dikenal (geoPoint/reference/bytes dll) - simpan mentah
    // alih-alih hilang diam-diam.
    return value;
}

function konversiDokumenFirestore(fields) {
    const hasil = {};
    for (const [key, value] of Object.entries(fields || {})) {
        hasil[key] = konversiNilaiFirestore(value);
    }
    return hasil;
}

async function ambilSemuaDokumen(token, namaKoleksi) {
    const dokumen = [];
    let pageToken = null;

    do {
        const url = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${namaKoleksi}`);
        url.searchParams.set('pageSize', '300');
        if (pageToken) url.searchParams.set('pageToken', pageToken);

        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
            if (res.status === 404) return dokumen; // koleksi belum pernah dibuat, wajar
            throw new Error(`Gagal mengambil koleksi ${namaKoleksi}: ${res.status} ${await res.text()}`);
        }
        const data = await res.json();
        (data.documents || []).forEach(doc => {
            const id = doc.name.split('/').pop();
            dokumen.push({ id, ...konversiDokumenFirestore(doc.fields) });
        });
        pageToken = data.nextPageToken || null;
    } while (pageToken);

    return dokumen;
}

async function uploadKeGoogleDrive(token, folderId, namaFile, isiJson) {
    const boundary = 'batasbackup' + Date.now();
    const metadata = { name: namaFile, parents: [folderId] };
    const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${isiJson}\r\n` +
        `--${boundary}--`;

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body
    });
    if (!res.ok) throw new Error(`Gagal upload ke Google Drive: ${res.status} ${await res.text()}`);
    return res.json();
}

async function rotasiBackupLama(token, folderId) {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', `'${folderId}' in parents and trashed = false`);
    url.searchParams.set('fields', 'files(id,name,createdTime)');
    url.searchParams.set('orderBy', 'createdTime desc');
    url.searchParams.set('pageSize', '1000');

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
        console.error('Gagal memeriksa rotasi backup lama:', res.status, await res.text());
        return;
    }
    const data = await res.json();
    const files = data.files || [];
    const fileDihapus = files.slice(MAKS_BACKUP_DISIMPAN);

    for (const file of fileDihapus) {
        const delRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(delRes.ok ? `Backup lama dihapus: ${file.name}` : `Gagal menghapus backup lama ${file.name}: ${delRes.status}`);
    }
}

async function main() {
    const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    const folderId = process.env.GDRIVE_BACKUP_FOLDER_ID;
    const oauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const oauthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const oauthRefreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

    const daftarWajib = { GOOGLE_SERVICE_ACCOUNT_KEY: rawKey, GDRIVE_BACKUP_FOLDER_ID: folderId, GOOGLE_OAUTH_CLIENT_ID: oauthClientId, GOOGLE_OAUTH_CLIENT_SECRET: oauthClientSecret, GOOGLE_OAUTH_REFRESH_TOKEN: oauthRefreshToken };
    const belumDiatur = Object.entries(daftarWajib).filter(([, v]) => !v).map(([k]) => k);
    if (belumDiatur.length > 0) {
        throw new Error(`GitHub Secret berikut belum diatur: ${belumDiatur.join(', ')}`);
    }

    const serviceAccount = JSON.parse(rawKey);

    console.log('Mengautentikasi ke Firestore (Service Account, read-only)...');
    const tokenFirestore = await ambilTokenViaServiceAccount(serviceAccount, ['https://www.googleapis.com/auth/datastore']);

    console.log('Mengautentikasi ke Google Drive (akun pengguna sendiri)...');
    const tokenDrive = await ambilTokenViaOAuthUser(oauthClientId, oauthClientSecret, oauthRefreshToken);

    console.log('Mengambil data dari Firestore...');
    const hasilBackup = { tanggalBackup: new Date().toISOString(), koleksi: {} };

    for (const namaKoleksi of KOLEKSI_DIBACKUP) {
        hasilBackup.koleksi[namaKoleksi] = await ambilSemuaDokumen(tokenFirestore, namaKoleksi);
        console.log(`  - ${namaKoleksi}: ${hasilBackup.koleksi[namaKoleksi].length} dokumen`);
    }

    const namaFile = `backup-erapee-${new Date().toISOString().slice(0, 10)}.json`;
    const isiJson = JSON.stringify(hasilBackup, null, 2);

    console.log(`Mengunggah ${namaFile} ke Google Drive (${(isiJson.length / 1024).toFixed(0)} KB)...`);
    await uploadKeGoogleDrive(tokenDrive, folderId, namaFile, isiJson);

    console.log('Memeriksa rotasi backup lama...');
    await rotasiBackupLama(tokenDrive, folderId);

    console.log('Backup selesai.');
}

main().catch(err => {
    console.error('Backup GAGAL:', err);
    process.exit(1);
});
