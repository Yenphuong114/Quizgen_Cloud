const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');
const Papa = require('../Quizgen_Cloud/node_modules/papaparse');

const serviceAccount = require('./serviceAccountKey.json');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function cleanupAndSync() {
  console.log("🔍 Đang quét toàn bộ câu hỏi trong Firestore...");
  const snapshot = await db.collection("Questions").get();
  console.log(`📊 Tổng số câu hỏi hiện tại: ${snapshot.size}`);

  let deletedCount = 0;
  const batchSize = 400;
  let batch = db.batch();
  let countInBatch = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    const ans = (data.correct_answer || '').trim();
    const isCorrupted = 
      !['A', 'B', 'C', 'D'].includes(ans) || 
      ans.length > 2 || 
      (data.question_text && data.question_text.includes('p_1') && !data.question_text.includes('p_4')) ||
      (data.question_text === 'Khoa học máy tính (MMLU)') ||
      (data.subject === 'Khoa học máy tính (CS)' && data.chapter === 'MMLU Benchmark');

    if (isCorrupted) {
      batch.delete(doc.ref);
      deletedCount++;
      countInBatch++;
      if (countInBatch >= batchSize) {
        batch.commit();
        batch = db.batch();
        countInBatch = 0;
      }
    }
  });

  if (countInBatch > 0) {
    await batch.commit();
  }

  console.log(`🧹 Đã xóa thành công ${deletedCount} câu hỏi bị lỗi / rác khỏi Firestore!`);

  // Đọc file mmlu_dataset.csv chuẩn để nạp lại
  const csvPath = path.resolve(__dirname, '../Quizgen_Cloud/mmlu_dataset.csv');
  if (fs.existsSync(csvPath)) {
    console.log("📥 Đang đọc file mmlu_dataset.csv chuẩn để nạp...");
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
    
    // Kiểm tra xem trong DB đã có bao nhiêu câu của môn này rồi để tránh nạp trùng
    const currentMMLUSnap = await db.collection("Questions")
      .where("subject", "==", "Khoa học máy tính (MMLU)")
      .get();
    
    console.log(`ℹ️ Số câu 'Khoa học máy tính (MMLU)' hợp lệ hiện còn trong DB: ${currentMMLUSnap.size}`);
    
    if (currentMMLUSnap.size < 50) {
      console.log(`🚀 Đang nạp ${parsed.data.length} câu hỏi MMLU chuẩn vào Firestore...`);
      let insertBatch = db.batch();
      let insertCount = 0;
      
      parsed.data.forEach(row => {
        const docRef = db.collection("Questions").doc();
        insertBatch.set(docRef, {
          subject: row.subject || "Khoa học máy tính (MMLU)",
          chapter: row.chapter || "Đề chuẩn quốc tế",
          difficulty: row.difficulty || "Hard",
          question_text: row.question_text,
          options: [row.optionA, row.optionB, row.optionC, row.optionD].filter(Boolean),
          correct_answer: (row.correct_answer || '').trim().toUpperCase(),
          created_by: "system_admin",
          creator_email: "admin@quizgen.cloud",
          created_at: FieldValue.serverTimestamp()
        });
        insertCount++;
      });

      await insertBatch.commit();
      console.log(`✅ Đã nạp thành công ${insertCount} câu hỏi MMLU chuẩn vào Cloud Firestore!`);
    } else {
      console.log("✅ Đã có đủ câu hỏi MMLU hợp lệ trong DB, không cần nạp bù.");
    }
  }

  // Thống kê lại
  const finalSnap = await db.collection("Questions").get();
  console.log(`\n🎉 HOÀN TẤT! Tổng số câu hỏi sạch trong Firestore hiện tại: ${finalSnap.size}`);
}

cleanupAndSync()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ Lỗi:", err);
    process.exit(1);
  });
