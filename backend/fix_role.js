/**
 * Script: Cập nhật role của user trong Firestore
 * Chạy: node fix_role.js
 */
require('dotenv').config();
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

// Khởi tạo Firebase Admin (giống server.js)
if (getApps().length === 0) {
  const serviceAccountPath = './serviceAccountKey.json';
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    initializeApp({ credential: cert(serviceAccount) });
  } else {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({ credential: cert(serviceAccount) });
  }
}

const db = getFirestore();

// ✏️ THAY EMAIL CỦA BẠN VÀO ĐÂY:
const TARGET_EMAIL = 'phamthuyyen.phuong520999@gmail.com';
const NEW_ROLE = 'teacher'; // teacher | admin | student

async function fixRole() {
  console.log(`🔍 Tìm user với email: ${TARGET_EMAIL}`);

  const snapshot = await db.collection('Users')
    .where('email', '==', TARGET_EMAIL)
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.log('❌ Không tìm thấy user với email này trong collection Users.');
    console.log('👉 Thử liệt kê tất cả users:');
    const all = await db.collection('Users').limit(20).get();
    all.forEach(doc => {
      const d = doc.data();
      console.log(`  - [${doc.id}] email: ${d.email}, role: ${d.role}`);
    });
    return;
  }

  const userDoc = snapshot.docs[0];
  const before = userDoc.data();
  console.log(`✅ Tìm thấy: ${before.email} | Role hiện tại: "${before.role}"`);

  await userDoc.ref.update({ role: NEW_ROLE });
  console.log(`🎉 Đã cập nhật role thành "${NEW_ROLE}" thành công!`);
  console.log('👉 Hãy đăng xuất và đăng nhập lại trên ứng dụng để áp dụng.');
}

fixRole().catch(err => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
