require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Middleware để in log mỗi khi có Frontend gọi tới API
app.use((req, res, next) => {
  console.log(`\n[${new Date().toLocaleTimeString()}] 🟢 REQUEST: ${req.method} ${req.url}`);
  next();
});

// Khởi tạo Firebase Admin SDK
const serviceAccountPath = './serviceAccountKey.json';
let db = null;
let adminAuth = null;

try {
  if (getApps().length === 0) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      } catch {
        const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8');
        serviceAccount = JSON.parse(decoded);
      }
      initializeApp({ credential: cert(serviceAccount) });
      console.log("✅ Đã kết nối Firebase Admin SDK qua biến môi trường FIREBASE_SERVICE_ACCOUNT.");
    } else if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      initializeApp({ credential: cert(serviceAccount) });
      console.log("✅ Đã kết nối Firebase Admin SDK qua file serviceAccountKey.json.");
    } else {
      console.error("❌ LỖI NGHIÊM TRỌNG: Không tìm thấy file serviceAccountKey.json hoặc biến môi trường FIREBASE_SERVICE_ACCOUNT!");
    }
  }
  
  if (getApps().length > 0) {
    db = getFirestore();
    adminAuth = getAuth();
  }
} catch (initError) {
  console.error("❌ LỖI khởi tạo Firebase Admin:", initError.message);
}

// =========================================================================
// MIDDLEWARE: Xác thực danh tính & Vai trò (Authentication & RBAC Middleware)
// =========================================================================
async function authenticateToken(req, res, next) {
  if (!adminAuth || !db) {
    return res.status(500).json({ error: "Hệ thống cơ sở dữ liệu chưa sẵn sàng." });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Chưa đăng nhập hoặc thiếu Bearer Token hợp lệ." });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // Lấy thông tin user và vai trò từ collection "Users"
    const userDocRef = db.collection("Users").doc(uid);
    const userSnap = await userDocRef.get();

    let userData = null;
    if (!userSnap.exists) {
      // Nếu chưa có, tự động tạo hồ sơ mặc định (mặc định là 'teacher' để dễ trải nghiệm)
      userData = {
        uid: uid,
        email: decodedToken.email || "",
        displayName: decodedToken.name || decodedToken.email?.split('@')[0] || "User",
        role: "teacher", // 'teacher' | 'student' | 'admin'
        createdAt: FieldValue.serverTimestamp(),
        lastLogin: FieldValue.serverTimestamp()
      };
      await userDocRef.set(userData);
      console.log(`✨ Đã tự động tạo hồ sơ người dùng mới: ${userData.email} (${userData.role})`);
    } else {
      userData = userSnap.data();
      // Cập nhật thời điểm đăng nhập gần nhất
      userDocRef.update({ lastLogin: FieldValue.serverTimestamp() }).catch(() => {});
    }

    req.user = {
      uid: uid,
      email: decodedToken.email,
      name: userData.displayName || decodedToken.name,
      role: userData.role || "teacher"
    };

    next();
  } catch (err) {
    console.error("Lỗi xác thực Token:", err.message);
    return res.status(403).json({ error: "Phiên làm việc hết hạn hoặc Token không hợp lệ." });
  }
}

// Middleware kiểm tra quyền theo vai trò (Role-Based Authorization)
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Bạn không có quyền thực hiện hành động này. Yêu cầu một trong các vai trò: [${allowedRoles.join(', ')}]. Vai trò hiện tại của bạn: '${req.user?.role}'.` 
      });
    }
    next();
  };
}

// =========================================================================
// PUBLIC & HEALTH CHECK ROUTES
// =========================================================================
app.get('/', (req, res) => {
  res.send("<h2>🚀 Quizgen Cloud API v2.0 - Hỗ trợ RBAC & Ma trận đề thi</h2>");
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: db ? "connected" : "disconnected"
  });
});

// =========================================================================
// API NGƯỜI DÙNG & PHÂN QUYỀN (USER & RBAC)
// =========================================================================

// Lấy thông tin hồ sơ & vai trò hiện tại
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  res.status(200).json({
    user: req.user
  });
});

// Chuyển đổi / Cập nhật vai trò (Hỗ trợ demo nhanh giữa Giảng viên và Sinh viên)
app.post('/api/user/set-role', authenticateToken, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['teacher', 'student', 'admin'].includes(role)) {
      return res.status(400).json({ error: "Vai trò không hợp lệ. Chỉ chấp nhận 'teacher', 'student', 'admin'." });
    }

    await db.collection("Users").doc(req.user.uid).update({
      role: role,
      updatedAt: FieldValue.serverTimestamp()
    });

    req.user.role = role;
    console.log(`🔄 Cập nhật vai trò người dùng ${req.user.email} sang: ${role}`);

    res.status(200).json({
      message: `Đã cập nhật vai trò sang ${role}`,
      user: req.user
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =========================================================================
// API NGÂN HÀNG CÂU HỎI (QUESTIONS - CHỈ DÀNH CHO TEACHER & ADMIN)
// =========================================================================

// Thống kê toàn bộ kho câu hỏi theo môn và mức độ khó
app.get('/api/questions/stats', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const snapshot = await db.collection("Questions").get();
    const stats = {
      total: snapshot.size,
      bySubject: {},
      byDifficulty: { Easy: 0, Medium: 0, Hard: 0 }
    };

    snapshot.forEach(doc => {
      const q = doc.data();
      const subj = q.subject || "Chung";
      const diff = q.difficulty || "Medium";

      // Phân loại theo môn
      if (!stats.bySubject[subj]) {
        stats.bySubject[subj] = { total: 0, Easy: 0, Medium: 0, Hard: 0 };
      }
      stats.bySubject[subj].total += 1;
      if (stats.bySubject[subj][diff] !== undefined) {
        stats.bySubject[subj][diff] += 1;
      }

      // Phân loại tổng theo độ khó
      if (stats.byDifficulty[diff] !== undefined) {
        stats.byDifficulty[diff] += 1;
      }
    });

    res.status(200).json(stats);
  } catch (error) {
    console.error("Lỗi thống kê câu hỏi:", error);
    res.status(500).json({ error: error.message });
  }
});

// Upload câu hỏi hàng loạt (Có Validation chống trượt cột & dữ liệu rác)
app.post('/api/questions/upload', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { questions, defaultSubject } = req.body;
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: "Dữ liệu không hợp lệ. Yêu cầu một mảng 'questions'." });
    }

    const batch = db.batch();
    const questionsRef = db.collection("Questions");
    let validCount = 0;
    let skippedCount = 0;
    const validAnswers = ['A', 'B', 'C', 'D'];

    questions.forEach((q) => {
      const qText = (q.question_text || '').trim();
      let rawAns = (q.correct_answer || '').trim().toUpperCase();

      // Hỗ trợ map số 0, 1, 2, 3 thành A, B, C, D nếu có
      if (rawAns === '0') rawAns = 'A';
      else if (rawAns === '1') rawAns = 'B';
      else if (rawAns === '2') rawAns = 'C';
      else if (rawAns === '3') rawAns = 'D';

      const validOptions = (q.options || []).filter(opt => opt && String(opt).trim() !== "");

      // Validation nghiêm ngặt: Phải có nội dung câu hỏi, đáp án thuộc A, B, C, D và có ít nhất 2 lựa chọn
      if (!qText || !validAnswers.includes(rawAns) || validOptions.length < 2) {
        skippedCount++;
        return;
      }

      const assignedSubject = (q.subject && q.subject !== 'Điện toán đám mây' ? q.subject : (defaultSubject || q.subject || "Điện toán đám mây")).trim();

      const newDocRef = questionsRef.doc();
      batch.set(newDocRef, {
        subject: assignedSubject,
        chapter: (q.chapter || "Chương 1").trim(),
        difficulty: ['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : "Medium",
        question_text: qText,
        options: validOptions,
        correct_answer: rawAns,
        created_by: req.user.uid,
        creator_email: req.user.email,
        created_at: FieldValue.serverTimestamp()
      });
      validCount++;
    });

    if (validCount > 0) {
      await batch.commit();
    }

    res.status(200).json({ 
      message: `Đã nạp thành công ${validCount} câu hỏi chuẩn vào ngân hàng đề.${skippedCount > 0 ? ` (Bỏ qua ${skippedCount} câu không đúng định dạng A/B/C/D)` : ''}`,
      count: validCount,
      skipped: skippedCount
    });
  } catch (error) {
    console.error("Lỗi khi upload câu hỏi:", error);
    res.status(500).json({ error: error.message });
  }
});

// Thêm 1 câu hỏi thủ công vào ngân hàng (Manual Single Question Entry)
app.post('/api/questions/single', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { subject, chapter, difficulty, question_text, options, correct_answer } = req.body;
    const qText = (question_text || '').trim();
    let rawAns = (correct_answer || '').trim().toUpperCase();

    if (['0', '1', '2', '3'].includes(rawAns)) {
      rawAns = ['A', 'B', 'C', 'D'][Number(rawAns)];
    }

    const validOptions = (options || []).filter(opt => opt && String(opt).trim() !== "");
    const validAnswers = ['A', 'B', 'C', 'D'];

    if (!qText) {
      return res.status(400).json({ error: "Nội dung câu hỏi không được để trống." });
    }
    if (!validAnswers.includes(rawAns)) {
      return res.status(400).json({ error: "Đáp án đúng phải là một trong các phương án A, B, C, D." });
    }
    if (validOptions.length < 2) {
      return res.status(400).json({ error: "Câu hỏi cần tối thiểu 2 phương án lựa chọn." });
    }

    const docRef = await db.collection("Questions").add({
      subject: (subject || "Chung").trim(),
      chapter: (chapter || "Chương 1").trim(),
      difficulty: ['Easy', 'Medium', 'Hard'].includes(difficulty) ? difficulty : "Medium",
      question_text: qText,
      options: validOptions,
      correct_answer: rawAns,
      created_by: req.user.uid,
      creator_email: req.user.email,
      created_at: FieldValue.serverTimestamp()
    });

    res.status(200).json({
      message: "Đã thêm câu hỏi thành công vào ngân hàng!",
      id: docRef.id
    });
  } catch (error) {
    console.error("Lỗi khi thêm câu hỏi thủ công:", error);
    res.status(500).json({ error: error.message });
  }
});

// Lấy danh sách câu hỏi trong ngân hàng (Có lọc theo môn / độ khó, giới hạn xem tùy chỉnh)
app.get('/api/questions', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { subject, difficulty, limit = 50 } = req.query;
    let query = db.collection("Questions");

    if (subject && subject !== 'all') query = query.where("subject", "==", subject);
    if (difficulty && difficulty !== 'all') query = query.where("difficulty", "==", difficulty);

    let parsedLimit = 50;
    if (limit === 'all' || limit === '0' || Number(limit) >= 1000) {
      parsedLimit = 1000;
    } else {
      parsedLimit = Math.max(1, Math.min(1000, Number(limit) || 50));
    }

    const snapshot = await query.limit(parsedLimit).get();
    const questions = [];
    snapshot.forEach(doc => questions.push({ id: doc.id, ...doc.data() }));

    res.status(200).json({
      total: questions.length,
      questions: questions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Xóa 1 câu hỏi khỏi ngân hàng
app.delete('/api/questions/:id', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection("Questions").doc(id).delete();
    res.status(200).json({ message: "Đã xóa câu hỏi thành công." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =========================================================================
// API SINH ĐỀ & QUẢN LÝ ĐỀ THI (EXAMS)
// =========================================================================

// Sinh đề thi thông minh (Smart Matrix Generator - Chỉ Teacher & Admin)
app.post('/api/exams/generate', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { 
      title, 
      subject, 
      numQuestions = 5, 
      difficultyDistribution, // { Easy: 2, Medium: 2, Hard: 1 }
      durationMinutes = 15,
      startTime = null,
      endTime = null,
      preselectedQuestions = null
    } = req.body;

    let selectedQuestions = [];

    if (preselectedQuestions && Array.isArray(preselectedQuestions) && preselectedQuestions.length > 0) {
      selectedQuestions = preselectedQuestions;
    } else {
      const snapshot = await db.collection("Questions").get();

      if (snapshot.empty) {
        return res.status(404).json({ error: "Chưa có câu hỏi nào trong hệ thống! Vui lòng upload câu hỏi trước." });
      }

      let allQuestions = [];
      snapshot.forEach(doc => {
        allQuestions.push({ id: doc.id, ...doc.data() });
      });

      // Lọc theo môn học nếu có yêu cầu
      if (subject && subject !== 'all') {
        const filtered = allQuestions.filter(q => q.subject?.toLowerCase() === subject.toLowerCase());
        if (filtered.length >= 3) {
          allQuestions = filtered;
        }
      }

      // Thuật toán chọn theo phân bổ độ khó (nếu có cấu hình)
      if (difficultyDistribution && typeof difficultyDistribution === 'object') {
        const easyPool = allQuestions.filter(q => (q.difficulty || '').toLowerCase() === 'easy').sort(() => 0.5 - Math.random());
        const medPool = allQuestions.filter(q => (q.difficulty || '').toLowerCase() === 'medium').sort(() => 0.5 - Math.random());
        const hardPool = allQuestions.filter(q => (q.difficulty || '').toLowerCase() === 'hard').sort(() => 0.5 - Math.random());

        const reqEasy = Number(difficultyDistribution.Easy) || 0;
        const reqMed = Number(difficultyDistribution.Medium) || 0;
        const reqHard = Number(difficultyDistribution.Hard) || 0;

        selectedQuestions = [
          ...easyPool.slice(0, reqEasy),
          ...medPool.slice(0, reqMed),
          ...hardPool.slice(0, reqHard)
        ];

        // Nếu chưa đủ số lượng yêu cầu do pool thiếu, bù ngẫu nhiên từ phần còn lại
        if (selectedQuestions.length < numQuestions) {
          const remaining = allQuestions.filter(q => !selectedQuestions.some(sq => sq.id === q.id));
          const needed = numQuestions - selectedQuestions.length;
          selectedQuestions.push(...remaining.sort(() => 0.5 - Math.random()).slice(0, needed));
        }
      } else {
        // Random xáo trộn thông thường
        selectedQuestions = allQuestions.sort(() => 0.5 - Math.random()).slice(0, Math.min(numQuestions, allQuestions.length));
      }
    }

    // Hoán vị ngẫu nhiên thứ tự các câu hỏi trong đề
    selectedQuestions = selectedQuestions.sort(() => 0.5 - Math.random());

    // Tạo mã đề thi 6 số ngẫu nhiên
    const examCode = Math.floor(100000 + Math.random() * 900000).toString();

    const examData = {
      title: title || `Đề thi trắc nghiệm #${examCode}`,
      exam_code: examCode,
      subject: subject || "Tổng hợp",
      duration_minutes: durationMinutes,
      start_time: startTime || new Date().toISOString(),
      end_time: endTime || null,
      total_questions: selectedQuestions.length,
      questions: selectedQuestions,
      created_by: req.user.uid,
      creator_name: req.user.name,
      creator_email: req.user.email,
      created_at: FieldValue.serverTimestamp()
    };

    const examRef = await db.collection("ExamPapers").add(examData);

    res.status(200).json({
      id: examRef.id,
      ...examData
    });
  } catch (error) {
    console.error("Lỗi khi tạo đề thi:", error);
    res.status(500).json({ error: error.message });
  }
});

// Lấy danh sách tất cả các đề thi khả dụng
app.get('/api/exams', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection("ExamPapers").orderBy("created_at", "desc").limit(30).get();
    const exams = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      // Nếu là Sinh viên, ẩn trường correct_answer trong câu hỏi để chống gian lận
      let safeQuestions = data.questions || [];
      if (req.user.role === 'student') {
        safeQuestions = safeQuestions.map(q => {
          const { correct_answer, ...safeQ } = q;
          return safeQ;
        });
      }

      exams.push({
        id: doc.id,
        title: data.title,
        exam_code: data.exam_code,
        subject: data.subject,
        duration_minutes: data.duration_minutes || 15,
        start_time: data.start_time || null,
        end_time: data.end_time || null,
        total_questions: data.total_questions || safeQuestions.length,
        questions: safeQuestions,
        created_at: data.created_at,
        created_by: data.created_by,
        creator_name: data.creator_name
      });
    });

    res.status(200).json({ exams });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Xóa đề thi (Chỉ dành cho Teacher / Admin)
app.delete('/api/exams/:id', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const examRef = db.collection("ExamPapers").doc(req.params.id);
    const docSnap = await examRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Không tìm thấy đề thi cần xóa." });
    }
    await examRef.delete();
    res.status(200).json({ message: "Đã xóa đề thi thành công." });
  } catch (error) {
    console.error("Lỗi khi xóa đề thi:", error);
    res.status(500).json({ error: error.message });
  }
});

// Lấy chi tiết đề thi bằng MÃ ĐỀ (exam_code 6 số) - dành cho sinh viên vào thi nhanh
app.get('/api/exams/code/:code', authenticateToken, async (req, res) => {
  try {
    const rawCode = (req.params.code || '').trim();
    if (!rawCode) {
      return res.status(400).json({ error: "Vui lòng cung cấp mã đề thi." });
    }

    // Tìm kiếm mã đề (hỗ trợ cả kiểu String và kiểu Number nếu cơ sở dữ liệu lưu số)
    let snapshot = await db.collection("ExamPapers").where("exam_code", "==", rawCode).limit(1).get();
    if (snapshot.empty && !isNaN(Number(rawCode))) {
      snapshot = await db.collection("ExamPapers").where("exam_code", "==", Number(rawCode)).limit(1).get();
    }

    if (snapshot.empty) {
      return res.status(404).json({ error: `Không tìm thấy đề thi với mã '${rawCode}'. Vui lòng kiểm tra lại.` });
    }

    const docSnap = snapshot.docs[0];
    const data = docSnap.data();
    let questions = data.questions || [];

    // Nếu là sinh viên, ẩn trường đáp án đúng
    if (req.user.role === 'student') {
      questions = questions.map(q => {
        const { correct_answer, ...safeQ } = q;
        return safeQ;
      });
    }

    res.status(200).json({
      id: docSnap.id,
      ...data,
      questions
    });
  } catch (error) {
    console.error("Lỗi khi tìm đề theo mã:", error);
    res.status(500).json({ error: error.message });
  }
});

// Lấy chi tiết 1 đề thi cụ thể để làm bài
app.get('/api/exams/:id', authenticateToken, async (req, res) => {
  try {
    const docSnap = await db.collection("ExamPapers").doc(req.params.id).get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Không tìm thấy đề thi này." });
    }

    const data = docSnap.data();
    let questions = data.questions || [];

    // Nếu là sinh viên, xóa trường đáp án đúng
    if (req.user.role === 'student') {
      questions = questions.map(q => {
        const { correct_answer, ...safeQ } = q;
        return safeQ;
      });
    }

    res.status(200).json({
      id: docSnap.id,
      ...data,
      questions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sinh viên nộp bài thi -> Backend tự động chấm điểm chính xác
app.post('/api/exams/:id/submit', authenticateToken, async (req, res) => {
  try {
    const examDoc = await db.collection("ExamPapers").doc(req.params.id).get();
    if (!examDoc.exists) {
      return res.status(404).json({ error: "Đề thi không tồn tại." });
    }

    const examData = examDoc.data();
    const originalQuestions = examData.questions || [];
    const studentAnswers = req.body.answers || {}; // { [questionId hoặc index]: selectedAnswer }

    let correctCount = 0;
    const reviewDetails = [];

    originalQuestions.forEach((q, idx) => {
      const studentAns = (studentAnswers[q.id] || studentAnswers[idx] || "").trim();
      const correctAns = (q.correct_answer || "").trim();
      
      const letterIndex = ['A', 'B', 'C', 'D'].indexOf(correctAns.toUpperCase());
      const correctOptionText = (letterIndex >= 0 && q.options && q.options[letterIndex]) 
        ? String(q.options[letterIndex]).trim() 
        : "";

      // Khớp nếu học sinh chọn 'A' hoặc chọn đúng chuỗi văn bản của phương án A
      const isCorrect = 
        (studentAns.toUpperCase() === correctAns.toUpperCase()) ||
        (correctOptionText && studentAns.toLowerCase() === correctOptionText.toLowerCase());
      
      if (isCorrect) correctCount++;

      reviewDetails.push({
        question_text: q.question_text,
        student_answer: studentAns || "Chưa chọn",
        correct_answer: correctAns,
        is_correct: isCorrect
      });
    });

    const totalQuestions = originalQuestions.length;
    const score10 = totalQuestions > 0 ? Number(((correctCount / totalQuestions) * 10).toFixed(2)) : 0;

    const submissionData = {
      exam_id: req.params.id,
      exam_title: examData.title,
      student_id: req.user.uid,
      student_name: req.user.name,
      student_email: req.user.email,
      score: score10,
      correct_count: correctCount,
      total_questions: totalQuestions,
      submitted_at: FieldValue.serverTimestamp()
    };

    const subRef = await db.collection("ExamSubmissions").add(submissionData);

    res.status(200).json({
      submission_id: subRef.id,
      score: score10,
      correct_count: correctCount,
      total_questions: totalQuestions,
      review: reviewDetails
    });
  } catch (error) {
    console.error("Lỗi khi chấm điểm bài thi:", error);
    res.status(500).json({ error: error.message });
  }
});

// Lấy lịch sử làm bài thi của sinh viên hoặc danh sách thí sinh đã nộp bài (Giảng viên)
app.get('/api/submissions', authenticateToken, async (req, res) => {
  try {
    let query = db.collection("ExamSubmissions").orderBy("submitted_at", "desc").limit(50);
    
    // Nếu là sinh viên, chỉ xem bài thi của chính mình
    if (req.user.role === 'student') {
      query = query.where("student_id", "==", req.user.uid);
    }

    const snapshot = await query.get();
    const submissions = [];
    snapshot.forEach(doc => submissions.push({ id: doc.id, ...doc.data() }));

    res.status(200).json({ submissions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// =========================================================================
// FIX B1: BACKEND AI PROXY — Gemini API Key tập trung ở Server
// Giảng viên không cần tự tạo API Key cá nhân. Server dùng GEMINI_API_KEY từ .env
// =========================================================================

/**
 * GET /api/ai/check
 * Kiểm tra xem Backend có cấu hình GEMINI_API_KEY không.
 * Frontend dùng endpoint này để ẩn/hiện nút "Cài đặt API Key".
 */
// Endpoint công khai - không cần đăng nhập để kiểm tra (tránh false-negative khi Render đang ngủ)
app.get('/api/ai/check', (req, res) => {
  const hasKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
  res.json({
    available: hasKey,
    message: hasKey
      ? '✅ Server đã cấu hình Gemini API Key. Giảng viên không cần nhập key cá nhân.'
      : '⚠️ Server chưa có Gemini API Key. Giảng viên cần tự nhập key cá nhân.'
  });
});

/**
 * POST /api/ai/generate-questions
 * Proxy endpoint: Nhận yêu cầu từ frontend, gọi Gemini API bằng key của server.
 * Body: { subject, count, difficulty, sampleQuestions }
 */
app.post('/api/ai/generate-questions', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  const serverKey = process.env.GEMINI_API_KEY;
  if (!serverKey || !serverKey.trim()) {
    return res.status(503).json({
      error: 'Server chưa cấu hình GEMINI_API_KEY. Vui lòng liên hệ quản trị viên hoặc sử dụng API Key cá nhân.'
    });
  }

  const { subject, count = 5, difficulty = 'Medium', sampleQuestions = [] } = req.body;

  if (!subject) {
    return res.status(400).json({ error: 'Thiếu thông tin môn học (subject).' });
  }

  // Tạo Grounding Context từ câu hỏi mẫu trong kho
  const sampleText = (sampleQuestions || []).slice(0, 10).map((q, i) =>
    `${i + 1}. [${q.difficulty || 'Medium'}] ${q.question_text}\nA. ${q.options?.[0] || ''} | B. ${q.options?.[1] || ''} | C. ${q.options?.[2] || ''} | D. ${q.options?.[3] || ''}\nĐáp án: ${q.correct_answer}`
  ).join('\n\n');

  const prompt = `Bạn là một giảng viên đại học kỳ cựu môn "${subject}".
Dưới đây là một số câu hỏi trắc nghiệm mẫu từ ngân hàng dữ liệu (CSV) của môn học:
--- DỮ LIỆU CÂU HỎI MẪU (GROUNDING CONTEXT) ---
${sampleText || 'Kiến thức lý thuyết và thực hành môn ' + subject}
----------------------------------------------

NHIỆM VỤ: Hãy sáng tạo ra đúng ${count} câu hỏi trắc nghiệm HOÀN TOÀN MỚI bám sát phạm vi kiến thức, các khái niệm cốt lõi và nội dung chuyên ngành của môn học trên.
YÊU CẦU:
1. Tuyệt đối KHÔNG chép lại y nguyên câu chữ cũ. Phải là câu hỏi mới 100%.
2. Có đủ 4 phương án lựa chọn (A, B, C, D) với 1 đáp án chính xác duy nhất.
3. Mức độ khó yêu cầu: ${difficulty}.
4. Định dạng trả về: Chỉ trả về một JSON Array các object có cấu trúc sau:
[
  {
    "question_text": "Nội dung câu hỏi...",
    "options": ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D"],
    "correct_answer": "A",
    "difficulty": "${difficulty}",
    "explanation": "Giải thích ngắn gọn vì sao đáp án này đúng"
  }
]
Không thêm bất kỳ markdown phụ hay văn bản ngoài mảng JSON.`;

  const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
  let lastError = null;

  for (const model of models) {
    try {
      console.log(`[AI Proxy] Đang gọi ${model} để sinh ${count} câu hỏi môn "${subject}"...`);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${serverKey.trim()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, responseMimeType: 'application/json' }
          })
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('AI không phản hồi nội dung.');

      let parsed = JSON.parse(text);
      if (!Array.isArray(parsed) && parsed.questions && Array.isArray(parsed.questions)) {
        parsed = parsed.questions;
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        const questions = parsed.map((q, idx) => ({
          id: `ai_${Date.now()}_${idx}`,
          subject,
          chapter: q.chapter || 'Chuyên đề AI',
          difficulty: ['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : difficulty,
          question_text: q.question_text || '',
          options: (q.options || []).map(o => String(o).trim()),
          correct_answer: (q.correct_answer || 'A').toUpperCase().trim(),
          explanation: q.explanation || '',
          is_ai_generated: true
        }));

        console.log(`[AI Proxy] ✅ Sinh thành công ${questions.length} câu hỏi từ ${model} cho môn "${subject}"`);
        return res.json({ questions, model_used: model });
      }
    } catch (err) {
      lastError = err;
      console.warn(`[AI Proxy] Lỗi với model ${model}:`, err.message);
    }
  }

  return res.status(500).json({
    error: `Không thể sinh câu hỏi bằng AI: ${lastError?.message || 'Lỗi không xác định'}. Vui lòng thử lại sau.`
  });
});

// Khởi động Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Quizgen Cloud Server v2.0 đang chạy tại cổng http://localhost:${PORT}`);
});
