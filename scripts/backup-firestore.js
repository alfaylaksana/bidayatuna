// Script backup otomatis: menarik data dari Firestore (koleksi 'maktabah'
// dan draft Instan 'instan_draft/current'), lalu menyimpannya sebagai
// file JSON di folder backup-json/. Dijalankan oleh GitHub Actions
// terjadwal — lihat .github/workflows/backup-firestore.yml

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

function namaFileAman(str) {
  return (str || 'tanpa-nama')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'tanpa-nama';
}

async function backup() {
  const outDir = path.join(__dirname, '..', 'backup-json');
  const maktabahDir = path.join(outDir, 'maktabah');
  const arrisalahDir = path.join(outDir, 'arrisalah');
  fs.mkdirSync(maktabahDir, { recursive: true });
  fs.mkdirSync(arrisalahDir, { recursive: true });

  // 1) Backup semua kitab di koleksi 'maktabah'
  const snap = await db.collection('maktabah').get();
  let count = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const judul = namaFileAman(data.judulIndo || doc.id);
    const filename = path.join(maktabahDir, `${judul}__${doc.id}.json`);
    fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf8');
    count++;
  }
  console.log(`✅ Backup ${count} kitab dari koleksi 'maktabah'.`);

  // 2) Backup draft Instan (kalau ada)
  const draftDoc = await db.collection('instan_draft').doc('current').get();
  if (draftDoc.exists) {
    fs.writeFileSync(
      path.join(outDir, 'instan-draft.json'),
      JSON.stringify(draftDoc.data(), null, 2),
      'utf8'
    );
    console.log('✅ Backup draft Instan berhasil.');
  } else {
    console.log('ℹ️  Tidak ada draft Instan aktif saat ini — dilewati.');
  }

  // 3) Backup Ar-Risalah — dokumen profil (arrisalah/profil)
  const profilDoc = await db.collection('arrisalah').doc('profil').get();
  if (profilDoc.exists) {
    fs.writeFileSync(
      path.join(arrisalahDir, 'profil.json'),
      JSON.stringify(profilDoc.data(), null, 2),
      'utf8'
    );
    console.log('✅ Backup profil Ar-Risalah berhasil.');
  } else {
    console.log('ℹ️  Dokumen profil Ar-Risalah tidak ditemukan — dilewati.');
  }

  // 4) Backup Ar-Risalah — koleksi per halaman (arrisalah_halaman)
  const halSnap = await db.collection('arrisalah_halaman').get();
  let halCount = 0;
  const semuaHalaman = [];
  halSnap.forEach(doc => {
    semuaHalaman.push({ id: doc.id, ...doc.data() });
    halCount++;
  });
  fs.writeFileSync(
    path.join(arrisalahDir, 'halaman.json'),
    JSON.stringify(semuaHalaman, null, 2),
    'utf8'
  );
  console.log(`✅ Backup ${halCount} halaman dari koleksi 'arrisalah_halaman'.`);

  // 5) Catat waktu backup terakhir
  fs.writeFileSync(
    path.join(outDir, 'last-backup.txt'),
    `Backup terakhir: ${new Date().toISOString()} (UTC)\n`,
    'utf8'
  );
}

backup().catch(err => {
  console.error('❌ Backup gagal:', err);
  process.exit(1);
});
