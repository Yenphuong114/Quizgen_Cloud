import { auth, db } from "./firebase";
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  addDoc, 
  deleteDoc,
  writeBatch, 
  serverTimestamp, 
  query, 
  orderBy, 
  limit,
  where
} from "firebase/firestore";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://quizgen-cloud.onrender.com";

/**
 * Lấy Firebase ID Token của người dùng hiện tại
 */
async function getIdToken() {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  return await currentUser.getIdToken();
}

/**
 * Gửi HTTP Request tới Backend API
 */
async function apiRequest(endpoint, options = {}) {
  const token = await getIdToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Tăng timeout lên 30s để chờ Render khởi động (Free tier thường mất 5-15s để spin up)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    signal: controller.signal
  });
  clearTimeout(timeoutId);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Yêu cầu thất bại với mã ${response.status}`);
  }

  return data;
}

// =========================================================================
// HYBRID API SERVICE:
// Tự động ưu tiên Backend API (nếu có server).
// Nếu đang chạy trên Firebase Hosting (quizgencloud.web.app) mà chưa deploy backend,
// hệ thống tự động Fallback sang Firebase Client SDK để ứng dụng vẫn hoạt động 100%!
// =========================================================================

export const api = {
  // 1. Lấy thông tin người dùng & vai trò
  getProfile: async () => {
    try {
      return await apiRequest("/api/user/profile");
    } catch {
      // Fallback qua Firestore trực tiếp
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Chưa đăng nhập");
      const userRef = doc(db, "Users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        return { user: { uid: currentUser.uid, email: currentUser.email, ...userSnap.data() } };
      } else {
        const defaultData = {
          email: currentUser.email,
          displayName: currentUser.displayName || currentUser.email?.split('@')[0],
          role: "teacher"
        };
        await setDoc(userRef, { ...defaultData, createdAt: serverTimestamp() });
        return { user: { uid: currentUser.uid, ...defaultData } };
      }
    }
  },

  // 2. Chuyển đổi vai trò (Teacher <-> Student)
  setRole: async (role) => {
    try {
      return await apiRequest("/api/user/set-role", {
        method: "POST",
        body: JSON.stringify({ role })
      });
    } catch {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Chưa đăng nhập");
      const userRef = doc(db, "Users", currentUser.uid);
      await setDoc(userRef, { role, updatedAt: serverTimestamp() }, { merge: true });
      return { message: "Đã cập nhật vai trò", user: { uid: currentUser.uid, role } };
    }
  },

  // 3. Lấy thống kê ngân hàng câu hỏi (Dashboard Stats)
  getQuestionStats: async () => {
    try {
      return await apiRequest("/api/questions/stats");
    } catch {
      // Fallback trực tiếp qua Firestore Client SDK
      const snapshot = await getDocs(collection(db, "Questions"));
      const stats = {
        total: snapshot.size,
        bySubject: {},
        byDifficulty: { Easy: 0, Medium: 0, Hard: 0 }
      };
      snapshot.forEach(docSnap => {
        const q = docSnap.data();
        const subj = q.subject || "Chung";
        const diff = q.difficulty || "Medium";
        if (!stats.bySubject[subj]) {
          stats.bySubject[subj] = { total: 0, Easy: 0, Medium: 0, Hard: 0 };
        }
        stats.bySubject[subj].total += 1;
        if (stats.bySubject[subj][diff] !== undefined) {
          stats.bySubject[subj][diff] += 1;
        }
        if (stats.byDifficulty[diff] !== undefined) {
          stats.byDifficulty[diff] += 1;
        }
      });
      return stats;
    }
  },

  // 4. Lấy danh sách câu hỏi trong ngân hàng (Hỗ trợ limit tùy chỉnh hoặc lấy tất cả)
  getQuestionsList: async ({ subject = "all", difficulty = "all", limitCount = 50 } = {}) => {
    try {
      return await apiRequest(`/api/questions?subject=${encodeURIComponent(subject)}&difficulty=${encodeURIComponent(difficulty)}&limit=${limitCount}`);
    } catch {
      const snapshot = await getDocs(collection(db, "Questions"));
      let questions = [];
      snapshot.forEach(docSnap => questions.push({ id: docSnap.id, ...docSnap.data() }));

      if (subject && subject !== "all") {
        questions = questions.filter(q => (q.subject || '').toLowerCase() === subject.toLowerCase());
      }
      if (difficulty && difficulty !== "all") {
        questions = questions.filter(q => (q.difficulty || '').toLowerCase() === difficulty.toLowerCase());
      }

      const count = (limitCount === 'all' || limitCount === '0') ? questions.length : (Number(limitCount) || 50);
      return { total: questions.length, questions: questions.slice(0, count) };
    }
  },

  // 5. Thêm 1 câu hỏi thủ công (Manual Single Question Entry)
  addSingleQuestion: async (questionData) => {
    try {
      return await apiRequest("/api/questions/single", {
        method: "POST",
        body: JSON.stringify(questionData)
      });
    } catch {
      const currentUser = auth.currentUser;
      const validAnswers = ['A', 'B', 'C', 'D'];
      let rawAns = (questionData.correct_answer || '').trim().toUpperCase();
      if (['0', '1', '2', '3'].includes(rawAns)) {
        rawAns = ['A', 'B', 'C', 'D'][Number(rawAns)];
      }

      const validOptions = (questionData.options || []).filter(opt => opt && String(opt).trim() !== "");
      if (!questionData.question_text?.trim() || !validAnswers.includes(rawAns) || validOptions.length < 2) {
        throw new Error("Dữ liệu câu hỏi không hợp lệ (cần ít nhất 2 lựa chọn và đáp án phải là A, B, C hoặc D).");
      }

      const docRef = await addDoc(collection(db, "Questions"), {
        subject: (questionData.subject || "Chung").trim(),
        chapter: (questionData.chapter || "Chương 1").trim(),
        difficulty: ['Easy', 'Medium', 'Hard'].includes(questionData.difficulty) ? questionData.difficulty : "Medium",
        question_text: questionData.question_text.trim(),
        options: validOptions,
        correct_answer: rawAns,
        created_by: currentUser?.uid || "anonymous",
        created_at: serverTimestamp()
      });
      return { message: "Đã thêm câu hỏi thành công.", id: docRef.id };
    }
  },

  // 6. Xóa câu hỏi khỏi ngân hàng
  deleteQuestion: async (id) => {
    try {
      return await apiRequest(`/api/questions/${id}`, { method: "DELETE" });
    } catch {
      await deleteDoc(doc(db, "Questions", id));
      return { message: "Đã xóa câu hỏi thành công." };
    }
  },

  // 7. Upload câu hỏi CSV (có validation nghiêm ngặt & hỗ trợ defaultSubject)
  uploadQuestions: async (questions, defaultSubject) => {
    try {
      return await apiRequest("/api/questions/upload", {
        method: "POST",
        body: JSON.stringify({ questions, defaultSubject })
      });
    } catch {
      const currentUser = auth.currentUser;
      const batch = writeBatch(db);
      const qRef = collection(db, "Questions");
      const validAnswers = ['A', 'B', 'C', 'D'];
      let validCount = 0;

      questions.forEach(q => {
        const qText = (q.question_text || '').trim();
        let rawAns = (q.correct_answer || '').trim().toUpperCase();
        if (rawAns === '0') rawAns = 'A';
        else if (rawAns === '1') rawAns = 'B';
        else if (rawAns === '2') rawAns = 'C';
        else if (rawAns === '3') rawAns = 'D';

        const validOptions = (q.options || []).filter(opt => opt && String(opt).trim() !== "");
        if (!qText || !validAnswers.includes(rawAns) || validOptions.length < 2) return;

        const assignedSubject = (q.subject && q.subject !== 'Điện toán đám mây' ? q.subject : (defaultSubject || q.subject || "Điện toán đám mây")).trim();

        const newDoc = doc(qRef);
        batch.set(newDoc, {
          subject: assignedSubject,
          chapter: (q.chapter || "Chương 1").trim(),
          difficulty: ['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : "Medium",
          question_text: qText,
          options: validOptions,
          correct_answer: rawAns,
          created_by: currentUser?.uid || "anonymous",
          created_at: serverTimestamp()
        });
        validCount++;
      });

      if (validCount > 0) {
        await batch.commit();
      }
      return { message: `Đã nạp thành công ${validCount} câu hỏi chuẩn vào Cloud Firestore.` };
    }
  },

  // 3b. Kiểm tra Backend có Proxy AI Key không (Fix B1)
  checkBackendAiAvailable: async () => {
    try {
      return await apiRequest('/api/ai/check');
    } catch {
      return { available: false };
    }
  },

  // 4. Gọi Google Gemini Cloud AI để sinh câu hỏi mới bám sát kiến thức CSV
  // Fix B1: Ưu tiên gọi Backend Proxy trước, chỉ dùng key cá nhân nếu backend không available
  generateQuestionsWithAI: async ({ subject, count = 5, difficulty = "Medium", sampleQuestions = [], apiKey }) => {
    // --- THỬ BACKEND PROXY TRƯỚC (Fix B1) ---
    if (!apiKey || !apiKey.trim()) {
      // Nếu không có key cá nhân, bắt buộc phải dùng backend
      try {
        const result = await apiRequest('/api/ai/generate-questions', {
          method: 'POST',
          body: JSON.stringify({ subject, count, difficulty, sampleQuestions })
        });
        if (result.questions && result.questions.length > 0) {
          return result.questions;
        }
      } catch (backendErr) {
        throw new Error(`Server AI không khả dụng: ${backendErr.message}. Vui lòng nhập API Key cá nhân.`);
      }
    }

    // Nếu vẫn không có key (trường hợp không có backend và không có key cá nhân)
    if (!apiKey || !apiKey.trim()) {
      throw new Error("Vui lòng nhập Google Gemini API Key để sử dụng tính năng AI.");
    }

    const cleanKey = apiKey.trim();

    // Lọc các câu hỏi mẫu của môn này làm Grounding Context
    const sampleText = (sampleQuestions || []).slice(0, 10).map((q, i) => 
      `${i + 1}. [${q.difficulty || 'Medium'}] ${q.question_text}\nA. ${q.options?.[0] || ''} | B. ${q.options?.[1] || ''} | C. ${q.options?.[2] || ''} | D. ${q.options?.[3] || ''}\nĐáp án: ${q.correct_answer}`
    ).join("\n\n");

    const prompt = `Bạn là một giảng viên đại học kỳ cựu môn "${subject}".
Dưới đây là một số câu hỏi trắc nghiệm mẫu từ ngân hàng dữ liệu (CSV) của môn học:
--- DỮ LIỆU CÂU HỎI MẪU (GROUNDING CONTEXT) ---
${sampleText || "Kiến thức lý thuyết và thực hành môn " + subject}
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

    const models = ["gemini-2.5-flash", "gemini-1.5-flash"];
    let lastError = null;

    for (const model of models) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              responseMimeType: "application/json"
            }
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("AI không phản hồi nội dung.");

        let parsed = JSON.parse(text);
        if (!Array.isArray(parsed) && parsed.questions && Array.isArray(parsed.questions)) {
          parsed = parsed.questions;
        }

        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((q, idx) => ({
            id: `ai_${Date.now()}_${idx}`,
            subject: subject,
            chapter: q.chapter || "Chuyên đề AI",
            difficulty: ['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : difficulty,
            question_text: q.question_text || "",
            options: (q.options || []).map(o => String(o).trim()),
            correct_answer: (q.correct_answer || 'A').toUpperCase().trim(),
            explanation: q.explanation || "",
            is_ai_generated: true
          }));
        }
      } catch (err) {
        lastError = err;
        console.warn(`Lỗi Gemini model ${model}:`, err.message);
      }
    }

    throw new Error(`Không thể sinh câu hỏi bằng AI: ${lastError?.message || "Lỗi không xác định"}. Vui lòng kiểm tra lại Google Gemini API Key.`);
  },

  // 5. Sinh đề thi (Hỗ trợ cả 3 chế độ: Kho CSV, AI hoàn toàn, hoặc Trộn Hybrid)
  generateExam: async (examData) => {
    try {
      return await apiRequest("/api/exams/generate", {
        method: "POST",
        body: JSON.stringify(examData)
      });
    } catch {
      const currentUser = auth.currentUser;
      const { 
        numQuestions = 5, 
        difficultyDistribution, 
        subject, 
        title, 
        durationMinutes = 15,
        startTime = null,
        endTime = null,
        preselectedQuestions = null
      } = examData;

      let selectedQuestions = [];

      if (preselectedQuestions && Array.isArray(preselectedQuestions) && preselectedQuestions.length > 0) {
        selectedQuestions = preselectedQuestions;
      } else {
        const snapshot = await getDocs(collection(db, "Questions"));
        if (snapshot.empty) throw new Error("Chưa có câu hỏi nào trong hệ thống.");

        let allQuestions = [];
        snapshot.forEach(d => allQuestions.push({ id: d.id, ...d.data() }));

        if (subject && subject !== 'all') {
          const filtered = allQuestions.filter(q => (q.subject || '').toLowerCase() === subject.toLowerCase());
          if (filtered.length > 0) allQuestions = filtered;
        }

        if (difficultyDistribution) {
          const easyPool = allQuestions.filter(q => (q.difficulty || '').toLowerCase() === 'easy').sort(() => 0.5 - Math.random());
          const medPool = allQuestions.filter(q => (q.difficulty || '').toLowerCase() === 'medium').sort(() => 0.5 - Math.random());
          const hardPool = allQuestions.filter(q => (q.difficulty || '').toLowerCase() === 'hard').sort(() => 0.5 - Math.random());

          selectedQuestions = [
            ...easyPool.slice(0, Number(difficultyDistribution.Easy) || 0),
            ...medPool.slice(0, Number(difficultyDistribution.Medium) || 0),
            ...hardPool.slice(0, Number(difficultyDistribution.Hard) || 0)
          ];

          if (selectedQuestions.length < numQuestions) {
            const remaining = allQuestions.filter(q => !selectedQuestions.some(sq => sq.id === q.id));
            selectedQuestions.push(...remaining.sort(() => 0.5 - Math.random()).slice(0, numQuestions - selectedQuestions.length));
          }
        } else {
          selectedQuestions = allQuestions.sort(() => 0.5 - Math.random()).slice(0, Math.min(numQuestions, allQuestions.length));
        }
      }

      // Xáo trộn ngẫu nhiên thứ tự câu hỏi trong đề
      selectedQuestions = selectedQuestions.sort(() => 0.5 - Math.random());

      const examCode = Math.floor(100000 + Math.random() * 900000).toString();
      const examDoc = {
        title: title || `Đề thi trắc nghiệm #${examCode}`,
        exam_code: examCode,
        subject: subject || "Tổng hợp",
        duration_minutes: durationMinutes,
        start_time: startTime || new Date().toISOString(),
        end_time: endTime || null,
        total_questions: selectedQuestions.length,
        questions: selectedQuestions,
        created_by: currentUser?.uid || "teacher",
        creator_name: currentUser?.displayName || currentUser?.email || "Giảng viên",
        created_at: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "ExamPapers"), examDoc);
      return { id: docRef.id, ...examDoc };
    }
  },

  // 5. Xóa đề thi (Delete Exam)
  deleteExam: async (id) => {
    try {
      return await apiRequest(`/api/exams/${id}`, {
        method: "DELETE"
      });
    } catch {
      await deleteDoc(doc(db, "ExamPapers", id));
      return { message: "Đã xóa đề thi thành công." };
    }
  },

  // 5. Lấy danh sách đề thi
  getExams: async () => {
    try {
      return await apiRequest("/api/exams");
    } catch {
      const q = query(collection(db, "ExamPapers"), limit(50));
      const snapshot = await getDocs(q);
      const exams = [];
      snapshot.forEach(d => exams.push({ id: d.id, ...d.data() }));
      return { exams };
    }
  },

  // 6. Tìm đề thi bằng MÃ ĐỀ (exam_code 6 số) - dành cho sinh viên nhập mã
  getExamByCode: async (code) => {
    const cleanCode = String(code || '').trim();
    if (!cleanCode) throw new Error("Vui lòng nhập mã đề thi.");
    try {
      return await apiRequest(`/api/exams/code/${encodeURIComponent(cleanCode)}`);
    } catch {
      // Fallback qua Firestore Client SDK
      let q = query(collection(db, "ExamPapers"), where("exam_code", "==", cleanCode), limit(1));
      let snapshot = await getDocs(q);
      if (snapshot.empty && !isNaN(Number(cleanCode))) {
        q = query(collection(db, "ExamPapers"), where("exam_code", "==", Number(cleanCode)), limit(1));
        snapshot = await getDocs(q);
      }
      if (snapshot.empty) {
        throw new Error(`Không tìm thấy đề thi với mã '${cleanCode}'. Vui lòng kiểm tra lại.`);
      }
      const docSnap = snapshot.docs[0];
      const data = docSnap.data();
      const currentUser = auth.currentUser;
      
      // Nếu là sinh viên, ẩn trường đáp án đúng
      let questions = data.questions || [];
      try {
        if (currentUser) {
          const userDoc = await getDoc(doc(db, "Users", currentUser.uid));
          if (userDoc.exists() && userDoc.data().role === 'student') {
            questions = questions.map(q => {
              const { correct_answer, ...safeQ } = q;
              return safeQ;
            });
          }
        }
      } catch (e) {
        console.warn("Could not check role, masking correct answers for safety", e);
        questions = questions.map(q => {
          const { correct_answer, ...safeQ } = q;
          return safeQ;
        });
      }

      return { id: docSnap.id, ...data, questions };
    }
  },

  // 6. Lấy chi tiết đề thi
  getExamById: async (id) => {
    try {
      return await apiRequest(`/api/exams/${id}`);
    } catch {
      const docSnap = await getDoc(doc(db, "ExamPapers", id));
      if (!docSnap.exists()) throw new Error("Không tìm thấy đề thi.");
      return { id: docSnap.id, ...docSnap.data() };
    }
  },

  // 7. Nộp bài thi
  submitExam: async (id, answers) => {
    try {
      return await apiRequest(`/api/exams/${id}/submit`, {
        method: "POST",
        body: JSON.stringify({ answers })
      });
    } catch {
      const currentUser = auth.currentUser;
      const examSnap = await getDoc(doc(db, "ExamPapers", id));
      if (!examSnap.exists()) throw new Error("Đề thi không tồn tại.");
      const examData = examSnap.data();
      const originalQuestions = examData.questions || [];

      let correctCount = 0;
      const review = [];

      originalQuestions.forEach((q, idx) => {
        const studentAns = (answers[q.id] || answers[idx] || "").trim();
        const correctAns = (q.correct_answer || "").trim();
        const letterIndex = ['A', 'B', 'C', 'D'].indexOf(correctAns.toUpperCase());
        const correctOptionText = (letterIndex >= 0 && q.options && q.options[letterIndex]) 
          ? String(q.options[letterIndex]).trim() 
          : "";

        const isCorrect = 
          (studentAns.toUpperCase() === correctAns.toUpperCase()) ||
          (correctOptionText && studentAns.toLowerCase() === correctOptionText.toLowerCase());

        if (isCorrect) correctCount++;
        review.push({
          question_text: q.question_text,
          student_answer: studentAns || "Chưa chọn",
          correct_answer: correctAns,
          is_correct: isCorrect
        });
      });

      const totalQuestions = originalQuestions.length;
      const score = totalQuestions > 0 ? Number(((correctCount / totalQuestions) * 10).toFixed(2)) : 0;

      const subData = {
        exam_id: id,
        exam_title: examData.title,
        student_id: currentUser?.uid || "anonymous",
        student_email: currentUser?.email || "student@example.com",
        student_name: currentUser?.displayName || currentUser?.email || "Sinh viên",
        score,
        correct_count: correctCount,
        total_questions: totalQuestions,
        review, // Lưu luôn review detail (Fix B2)
        submitted_at: serverTimestamp()
      };

      const subRef = await addDoc(collection(db, "ExamSubmissions"), subData);
      return { submission_id: subRef.id, score, correct_count: correctCount, total_questions: totalQuestions, review };
    }
  },

  // 8. Lấy danh sách kết quả bài nộp
  getSubmissions: async () => {
    try {
      return await apiRequest("/api/submissions");
    } catch {
      const q = query(collection(db, "ExamSubmissions"), limit(50));
      const snapshot = await getDocs(q);
      const submissions = [];
      snapshot.forEach(d => submissions.push({ id: d.id, ...d.data() }));
      return { submissions };
    }
  }
};
