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
      const response = await fetch("http://localhost:5000/api/exams/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ numQuestions })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Có lỗi xảy ra khi tạo đề từ Server");
      }

      // Backend đã trả về đối tượng đề thi hoàn chỉnh
      setExam(result);

    } catch (error) {
      console.error(error);
      alert("Lỗi khi tạo đề: " + error.message);
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