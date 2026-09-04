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

          // Gọi API của Backend
          const response = await fetch("http://localhost:5000/api/questions/upload", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ questions: formattedQuestions })
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || "Có lỗi xảy ra từ Server");
          }

          setStatus(`✅ Thành công! ${result.message}`);
          if (onUploadSuccess) onUploadSuccess();
        } catch (error) {
          console.error(error);
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