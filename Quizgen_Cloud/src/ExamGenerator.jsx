import React, { useState } from "react";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { db } from "./firebase";

export default function ExamGenerator() {
  const [numQuestions, setNumQuestions] = useState(5);
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGenerateExam = async () => {
    setLoading(true);
    try {
      // 1. Truy vấn lấy toàn bộ câu hỏi từ Cloud Firestore
      const querySnapshot = await getDocs(collection(db, "Questions"));
      if (querySnapshot.empty) {
        alert("Chưa có câu hỏi nào trong hệ thống! Vui lòng nạp file CSV trước.");
        return;
      }

      let allQuestions = [];
      querySnapshot.forEach((docSnap) => {
        allQuestions.push({ id: docSnap.id, ...docSnap.data() });
      });

      // 2. Thuật toán Random xáo trộn ngẫu nhiên
      const shuffled = allQuestions.sort(() => 0.5 - Math.random());
      const selectedQuestions = shuffled.slice(0, Math.min(numQuestions, allQuestions.length));

      // 3. Lưu đề thi vào collection ExamPapers trên Firestore
      const examData = {
        title: `Đề thi ngẫu nhiên ${new Date().toLocaleTimeString()}`,
        total_questions: selectedQuestions.length,
        questions: selectedQuestions,
        created_at: new Date()
      };

      const docRef = await addDoc(collection(db, "ExamPapers"), examData);

      // Hiển thị đề thi ra giao diện
      setExam({
        id: docRef.id,
        ...examData
      });

    } catch (error) {
      console.error("Lỗi khi tạo đề:", error);
      alert("Lỗi khi tạo đề từ Cloud Firestore: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel">
      <h2 style={{ marginBottom: "20px" }}>2. Sinh đề thi tự động (Cloud Processing)</h2>
      <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "15px" }}>
        <label style={{ fontWeight: "500" }}>Số lượng câu hỏi cần tạo: </label>
        <input 
          type="number" 
          value={numQuestions} 
          onChange={(e) => setNumQuestions(Number(e.target.value))}
          className="input-field"
          style={{ width: "80px" }}
        />
        <button 
          onClick={handleGenerateExam} 
          disabled={loading}
          className="btn-primary"
        >
          {loading ? "Đang xử lý..." : "Tạo Đề Thi Mới"}
        </button>
      </div>

      {exam && (
        <div style={{ marginTop: "30px", borderTop: "2px dashed var(--glass-border)", paddingTop: "25px" }}>
          <h3 style={{ color: "var(--primary-color)", fontSize: "24px" }}>🎉 {exam.title}</h3>
          <p style={{ color: "#666", marginBottom: "20px" }}><strong>Mã đề:</strong> {exam.id} | <strong>Tổng số câu hỏi:</strong> {exam.total_questions}</p>

          <div style={{ textAlign: "left" }}>
            {exam.questions.map((q, index) => (
              <div key={q.id} className="question-item">
                <p style={{ fontSize: "16px", fontWeight: "500", color: "#333", marginBottom: "15px" }}>
                  <strong>Câu {index + 1}:</strong> {q.question_text}
                </p>
                <ul style={{ listStyleType: "none", paddingLeft: "5px", margin: "0 0 15px 0" }}>
                  {q.options && q.options.map((opt, i) => (
                    <li key={i} style={{ marginBottom: "8px", color: "#555" }}>
                      <strong style={{ color: "var(--primary-hover)" }}>{String.fromCharCode(65 + i)}.</strong> {opt}
                    </li>
                  ))}
                </ul>
                <div className="correct-ans">➡️ Đáp án đúng: {q.correct_answer}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}