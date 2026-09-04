require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Middleware để in log mỗi khi có Frontend gọi tới API
app.use((req, res, next) => {
  console.log(`\n[${new Date().toLocaleTimeString()}] 🟢 NHẬN REQUEST: ${req.method} ${req.url}`);
  next();
});

// Khởi tạo Firebase Admin SDK
const serviceAccountPath = './serviceAccountKey.json';
let db = null;
if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = require(serviceAccountPath);
  initializeApp({
    credential: cert(serviceAccount)
  });
  console.log("✅ Đã kết nối Firebase Admin SDK thành công.");
  db = getFirestore();
} else {
  console.error("❌ LỖI NGHIÊM TRỌNG: Không tìm thấy file serviceAccountKey.json!");
  console.error("Vui lòng vào Firebase Console -> Project Settings -> Service accounts -> Generate new private key");
  console.error("Sau đó đổi tên file tải về thành 'serviceAccountKey.json' và copy vào thư mục 'backend'.");
}

// Route mặc định khi truy cập http://localhost:5000
app.get('/', (req, res) => {
  res.send("<h2>🚀 Quizgen Cloud API đang hoạt động mượt mà!</h2><p>Các Endpoint khả dụng: POST /api/questions/upload, POST /api/exams/generate</p>");
});

// ==========================================
// API 1: Upload Câu hỏi (Data Import)
// Lấy mảng dữ liệu từ Frontend và đẩy vào Firestore
// ==========================================
app.post('/api/questions/upload', async (req, res) => {
  if (!db) return res.status(500).json({ error: "Backend chưa được cấp quyền Firebase (Thiếu serviceAccountKey.json)" });

  try {
    const { questions } = req.body;
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: "Dữ liệu không hợp lệ. Yêu cầu một mảng 'questions'." });
    }

    const batch = db.batch();
    const questionsRef = db.collection("Questions");

    questions.forEach((q) => {
      const newDocRef = questionsRef.doc(); // Tự động tạo ID
      batch.set(newDocRef, {
        subject: q.subject || "Điện toán đám mây",
        chapter: q.chapter || "Chương 1",
        difficulty: q.difficulty || "Medium",
        question_text: q.question_text,
        options: q.options || [],
        correct_answer: q.correct_answer,
        created_at: FieldValue.serverTimestamp()
      });
    });

    await batch.commit();
    res.status(200).json({ message: `Đã thêm thành công ${questions.length} câu hỏi.` });
  } catch (error) {
    console.error("Lỗi khi upload câu hỏi:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API 2: Sinh đề thi tự động (Cloud Processing)
// Lấy tất cả câu hỏi, random chọn N câu, và tạo Đề thi
// ==========================================
app.post('/api/exams/generate', async (req, res) => {
  if (!db) return res.status(500).json({ error: "Backend chưa được cấp quyền Firebase (Thiếu serviceAccountKey.json)" });

  try {
    const numQuestions = req.body.numQuestions || 5;

    // Truy vấn lấy toàn bộ câu hỏi (Do Firestore không hỗ trợ Random trực tiếp tốt)
    // Trong thực tế nếu DB lớn, ta sẽ dùng kỹ thuật pagination hoặc random hash
    const snapshot = await db.collection("Questions").get();

    if (snapshot.empty) {
      return res.status(404).json({ error: "Chưa có câu hỏi nào trong hệ thống!" });
    }

    let allQuestions = [];
    snapshot.forEach(doc => {
      allQuestions.push({ id: doc.id, ...doc.data() });
    });

    // Thuật toán Random xáo trộn mảng
    const shuffled = allQuestions.sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffled.slice(0, Math.min(numQuestions, allQuestions.length));

    // Lưu đề thi vào Firestore
    const examData = {
      title: `Đề thi ngẫu nhiên ${new Date().toLocaleTimeString()}`,
      total_questions: selectedQuestions.length,
      questions: selectedQuestions,
      created_at: FieldValue.serverTimestamp()
    };

    const examRef = await db.collection("ExamPapers").add(examData);

    // Trả kết quả về cho Frontend
    res.status(200).json({
      id: examRef.id,
      ...examData
    });
  } catch (error) {
    console.error("Lỗi khi tạo đề thi:", error);
    res.status(500).json({ error: error.message });
  }
});

// Khởi động Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend Server đang chạy tại cổng http://localhost:${PORT}`);
});
