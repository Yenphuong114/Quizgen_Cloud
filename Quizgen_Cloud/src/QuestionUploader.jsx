import React, { useState } from "react";
import Papa from "papaparse";
import { collection, writeBatch, doc } from "firebase/firestore";
import { db } from "./firebase";

export default function QuestionUploader({ onUploadSuccess }) {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setStatus("⏳ Đang đọc file CSV...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data;
        try {
          setStatus(`⏳ Đang đẩy ${data.length} câu hỏi lên Backend API...`);
          
          // Chuẩn bị dữ liệu theo chuẩn mảng object
          const formattedQuestions = data.map(row => ({
            subject: row.subject || "Điện toán đám mây",
            chapter: row.chapter || "Chương 1",
            difficulty: row.difficulty || "Medium",
            question_text: row.question_text,
            options: [row.optionA, row.optionB, row.optionC, row.optionD].filter(Boolean),
            correct_answer: row.correct_answer
          }));

          // Ghi trực tiếp lên Google Cloud Firestore qua Batch Write (Serverless Architecture)
          const batch = writeBatch(db);
          const questionsRef = collection(db, "Questions");

          formattedQuestions.forEach((q) => {
            const newDocRef = doc(questionsRef);
            batch.set(newDocRef, {
              ...q,
              created_at: new Date()
            });
          });

          await batch.commit();
          setStatus(`✅ Thành công! Đã nạp thành công ${formattedQuestions.length} câu hỏi vào Cloud Firestore.`);
          if (onUploadSuccess) onUploadSuccess();
        } catch (error) {
          console.error("Lỗi khi upload:", error);
          setStatus("❌ Lỗi: " + error.message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  return (
    <div className="glass-panel">
      <h2 style={{ marginBottom: "20px" }}>1. Import Ngân hàng câu hỏi (CSV)</h2>
      <input 
        type="file" 
        accept=".csv" 
        onChange={handleFileUpload} 
        disabled={loading} 
        className="input-file"
      />
      {status && <p style={{ marginTop: "15px", fontWeight: "bold", color: "#333" }}>{status}</p>}
    </div>
  );
}