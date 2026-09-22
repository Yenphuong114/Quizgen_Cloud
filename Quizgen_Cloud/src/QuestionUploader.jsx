import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import { api } from "./api";

export default function QuestionUploader({ onUploadSuccess }) {
  const [stats, setStats] = useState({ total: 0, bySubject: {}, byDifficulty: { Easy: 0, Medium: 0, Hard: 0 } });
  const [questions, setQuestions] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  
  // Bộ lọc
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Tùy chỉnh số lượng hiển thị (thay vì cố định 50)
  const [limitCount, setLimitCount] = useState(50);
  const [isAllLimit, setIsAllLimit] = useState(false);

  // Trạng thái upload CSV
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState([]);
  const [showUploadBox, setShowUploadBox] = useState(false);

  // Cấu hình môn học khi upload CSV
  const [uploadSubjectMode, setUploadSubjectMode] = useState("custom"); // 'custom' | 'file'
  const [uploadTargetSubject, setUploadTargetSubject] = useState("");
  const [newSubjectInput, setNewSubjectInput] = useState("");

  // Trạng thái tự nhập liệu thủ công (Manual Question Form)
  const [showManualBox, setShowManualBox] = useState(false);
  const [manualSubjectMode, setManualSubjectMode] = useState("select"); // 'select' | 'new'
  const [manualForm, setManualForm] = useState({
    subject: "",
    newSubject: "",
    chapter: "Chương 1",
    difficulty: "Medium",
    question_text: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correct_answer: "A"
  });
  const [savingManual, setSavingManual] = useState(false);
  const [manualStatus, setManualStatus] = useState("");

  // Danh sách môn học hiện có trong kho
  const subjectsList = Object.keys(stats.bySubject || {});

  // Tải thống kê kho câu hỏi
  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const data = await api.getQuestionStats();
      setStats(data || { total: 0, bySubject: {}, byDifficulty: {} });
    } catch (err) {
      console.error("Lỗi lấy thống kê câu hỏi:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Tải danh sách câu hỏi theo bộ lọc và số lượng yêu cầu
  const fetchQuestions = async () => {
    setLoadingQuestions(true);
    try {
      const res = await api.getQuestionsList({
        subject: selectedSubject,
        difficulty: selectedDifficulty,
        limitCount: isAllLimit ? 'all' : limitCount
      });
      setQuestions(res.questions || []);
    } catch (err) {
      console.error("Lỗi lấy danh sách câu hỏi:", err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [selectedSubject, selectedDifficulty, limitCount, isAllLimit]);

  // Thiết lập mặc định môn học cho form nhập liệu và upload
  useEffect(() => {
    if (subjectsList.length > 0) {
      if (!uploadTargetSubject) setUploadTargetSubject(subjectsList[0]);
      if (!manualForm.subject) setManualForm(prev => ({ ...prev, subject: subjectsList[0] }));
    }
  }, [subjectsList]);

  // Xóa 1 câu hỏi
  const handleDeleteQuestion = async (id, questionText) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa câu hỏi này?\n\n"${questionText.slice(0, 60)}..."`)) {
      return;
    }
    try {
      await api.deleteQuestion(id);
      setQuestions(prev => prev.filter(q => q.id !== id));
      fetchStats();
    } catch (err) {
      alert("Lỗi khi xóa câu hỏi: " + err.message);
    }
  };

  // Lưu câu hỏi tự nhập thủ công
  const handleCreateManualQuestion = async (e) => {
    e.preventDefault();
    const qText = manualForm.question_text.trim();
    if (!qText) {
      alert("Vui lòng nhập nội dung câu hỏi.");
      return;
    }

    const opts = [
      manualForm.optionA.trim(), 
      manualForm.optionB.trim(), 
      manualForm.optionC.trim(), 
      manualForm.optionD.trim()
    ].filter(Boolean);

    if (opts.length < 2) {
      alert("Vui lòng điền ít nhất 2 phương án lựa chọn.");
      return;
    }

    const finalSubject = manualSubjectMode === 'new' 
      ? (manualForm.newSubject.trim() || "Chung")
      : (manualForm.subject || subjectsList[0] || "Chung");

    setSavingManual(true);
    setManualStatus("⏳ Đang lưu câu hỏi vào Cloud Firestore...");
    try {
      await api.addSingleQuestion({
        subject: finalSubject,
        chapter: manualForm.chapter.trim() || "Chương 1",
        difficulty: manualForm.difficulty,
        question_text: qText,
        options: opts,
        correct_answer: manualForm.correct_answer
      });
      setManualStatus("✅ Đã thêm câu hỏi thành công vào kho!");
      setManualForm(prev => ({
        ...prev,
        question_text: "",
        optionA: "",
        optionB: "",
        optionC: "",
        optionD: "",
        correct_answer: "A"
      }));
      fetchStats();
      fetchQuestions();
      if (onUploadSuccess) onUploadSuccess();
      setTimeout(() => setManualStatus(""), 3500);
    } catch (err) {
      setManualStatus("❌ Lỗi: " + err.message);
    } finally {
      setSavingManual(false);
    }
  };

  // Upload file CSV
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const targetSubjectName = uploadSubjectMode === 'custom' 
      ? (newSubjectInput.trim() || uploadTargetSubject || subjectsList[0] || "Chung")
      : null;

    setUploading(true);
    setStatus("⏳ Đang đọc và kiểm tra cấu trúc file CSV...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data;
        if (!data || data.length === 0) {
          setStatus("❌ File CSV không chứa dữ liệu câu hỏi.");
          setUploading(false);
          return;
        }

        try {
          const validAnswers = ['A', 'B', 'C', 'D'];
          let skipped = 0;

          // Chuẩn hóa và lọc dữ liệu hợp lệ
          const formattedQuestions = [];
          data.forEach(row => {
            const qText = (row.question_text || row.question || "").trim();
            let ans = (row.correct_answer || row.answer || "").trim().toUpperCase();
            
            // Map 0, 1, 2, 3 -> A, B, C, D
            if (ans === '0') ans = 'A';
            else if (ans === '1') ans = 'B';
            else if (ans === '2') ans = 'C';
            else if (ans === '3') ans = 'D';

            const opts = [row.optionA, row.optionB, row.optionC, row.optionD].filter(Boolean);

            if (qText && validAnswers.includes(ans) && opts.length >= 2) {
              const assignedSubject = uploadSubjectMode === 'custom'
                ? targetSubjectName
                : (row.subject || targetSubjectName || "Điện toán đám mây");

              formattedQuestions.push({
                subject: assignedSubject,
                chapter: row.chapter || "Chương 1",
                difficulty: ['Easy', 'Medium', 'Hard'].includes(row.difficulty) ? row.difficulty : "Medium",
                question_text: qText,
                options: opts,
                correct_answer: ans
              });
            } else {
              skipped++;
            }
          });

          if (formattedQuestions.length === 0) {
            setStatus("❌ Không có câu hỏi nào hợp lệ. Đảm bảo đáp án là A, B, C hoặc D và có tối thiểu 2 lựa chọn.");
            setUploading(false);
            return;
          }

          setStatus(`⏳ Đang lưu ${formattedQuestions.length} câu hỏi hợp lệ vào Cloud Firestore...`);
          const res = await api.uploadQuestions(formattedQuestions, targetSubjectName);

          setStatus(`✅ ${res.message || `Đã nạp ${formattedQuestions.length} câu hỏi thành công!`}${skipped > 0 ? ` (Bỏ qua ${skipped} câu lỗi)` : ''}`);
          setPreviewQuestions(formattedQuestions.slice(0, 5));

          // Cập nhật lại stats & list
          fetchStats();
          fetchQuestions();
          if (onUploadSuccess) onUploadSuccess();
        } catch (error) {
          console.error("Lỗi khi upload:", error);
          setStatus("❌ Lỗi tải lên: " + error.message);
        } finally {
          setUploading(false);
        }
      }
    });
  };

  // Lọc câu hỏi theo từ khóa tìm kiếm
  const displayedQuestions = questions.filter(q => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (q.question_text || '').toLowerCase().includes(term) ||
      (q.subject || '').toLowerCase().includes(term) ||
      (q.chapter || '').toLowerCase().includes(term)
    );
  });

  // Tính toán số liệu thống kê hiển thị: Theo môn đang chọn hay Toàn bộ hệ thống
  const activeSubjectStats = selectedSubject === "all"
    ? {
        title: "TOÀN BỘ HỆ THỐNG (TẤT CẢ CÁC MÔN)",
        isFiltered: false,
        total: stats.total || 0,
        Easy: stats.byDifficulty?.Easy || 0,
        Medium: stats.byDifficulty?.Medium || 0,
        Hard: stats.byDifficulty?.Hard || 0
      }
    : {
        title: `MÔN HỌC: "${selectedSubject.toUpperCase()}"`,
        isFiltered: true,
        total: stats.bySubject?.[selectedSubject]?.total || 0,
        Easy: stats.bySubject?.[selectedSubject]?.Easy || 0,
        Medium: stats.bySubject?.[selectedSubject]?.Medium || 0,
        Hard: stats.bySubject?.[selectedSubject]?.Hard || 0
      };

  return (
    <div className="glass-panel" style={{ marginBottom: "30px" }}>
      {/* Tiêu đề Tab Số 1 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ margin: "0 0 5px 0", color: "#2c3e50" }}>
            📚 1. Quản lý Ngân hàng Câu hỏi (Question Bank Hub)
          </h2>
          <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>
            Kho lưu trữ, thống kê phân bổ độ khó theo từng môn và quản lý câu hỏi trắc nghiệm toàn trường
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {/* Nút Tự Nhập Liệu Thủ Công */}
          <button 
            onClick={() => setShowManualBox(!showManualBox)}
            style={{
              background: showManualBox ? "#6c757d" : "#2ecc71",
              color: "#fff",
              border: "none",
              padding: "7px 15px",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              display: "flex",
              alignItems: "center",
              gap: "5px"
            }}
          >
            {showManualBox ? "✕ Đóng Nhập Liệu" : "✍️ + Tự Nhập Câu Hỏi Mới"}
          </button>

          {/* Nút Nạp File CSV */}
          <button 
            onClick={() => setShowUploadBox(!showUploadBox)}
            style={{
              background: showUploadBox ? "#6c757d" : "#ff5c8a",
              color: "#fff",
              border: "none",
              padding: "7px 15px",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              display: "flex",
              alignItems: "center",
              gap: "5px"
            }}
          >
            {showUploadBox ? "✕ Đóng Nạp File" : "📤 + Nạp File CSV"}
          </button>
        </div>
      </div>

      {/* DASHBOARD THỐNG KÊ KHO CÂU HỎI (TỰ ĐỘNG THÍCH ỨNG THEO MÔN ĐƯỢC CHỌN) */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginBottom: "10px", 
        background: "rgba(255,255,255,0.7)", 
        padding: "8px 14px", 
        borderRadius: "8px" 
      }}>
        <div style={{ fontSize: "13px", color: "#444" }}>
          📊 Phạm vi thống kê: <strong style={{ color: activeSubjectStats.isFiltered ? "#d81b60" : "#2980b9" }}>{activeSubjectStats.title}</strong>
        </div>
        {activeSubjectStats.isFiltered && (
          <button 
            onClick={() => setSelectedSubject("all")}
            style={{ background: "none", border: "none", color: "#3498db", cursor: "pointer", fontSize: "12px", textDecoration: "underline", fontWeight: "600" }}
          >
            🌐 Xem toàn bộ hệ thống
          </button>
        )}
      </div>

      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", 
        gap: "12px", 
        marginBottom: "25px" 
      }}>
        {/* Card Tổng */}
        <div style={{ background: "rgba(255,255,255,0.85)", padding: "14px", borderRadius: "12px", borderLeft: "4px solid #3498db" }}>
          <div style={{ fontSize: "11px", color: "#666", fontWeight: "bold" }}>
            {activeSubjectStats.isFiltered ? `TỔNG CÂU MÔN [${selectedSubject}]` : "TỔNG CÂU TOÀN BỘ KHO"}
          </div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#2c3e50", marginTop: "4px" }}>
            {loadingStats ? "..." : activeSubjectStats.total} <span style={{ fontSize: "13px", fontWeight: "normal", color: "#888" }}>câu</span>
          </div>
        </div>

        {/* Card Dễ */}
        <div style={{ background: "rgba(255,255,255,0.85)", padding: "14px", borderRadius: "12px", borderLeft: "4px solid #2ecc71" }}>
          <div style={{ fontSize: "11px", color: "#27ae60", fontWeight: "bold" }}>🟢 DỄ (EASY)</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#27ae60", marginTop: "4px" }}>
            {loadingStats ? "..." : activeSubjectStats.Easy} <span style={{ fontSize: "13px", fontWeight: "normal", color: "#888" }}>câu</span>
          </div>
        </div>

        {/* Card Trung bình */}
        <div style={{ background: "rgba(255,255,255,0.85)", padding: "14px", borderRadius: "12px", borderLeft: "4px solid #f39c12" }}>
          <div style={{ fontSize: "11px", color: "#d35400", fontWeight: "bold" }}>🟡 TRUNG BÌNH (MEDIUM)</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#d35400", marginTop: "4px" }}>
            {loadingStats ? "..." : activeSubjectStats.Medium} <span style={{ fontSize: "13px", fontWeight: "normal", color: "#888" }}>câu</span>
          </div>
        </div>

        {/* Card Khó */}
        <div style={{ background: "rgba(255,255,255,0.85)", padding: "14px", borderRadius: "12px", borderLeft: "4px solid #e74c3c" }}>
          <div style={{ fontSize: "11px", color: "#c0392b", fontWeight: "bold" }}>🔴 KHÓ (HARD)</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#c0392b", marginTop: "4px" }}>
            {loadingStats ? "..." : activeSubjectStats.Hard} <span style={{ fontSize: "13px", fontWeight: "normal", color: "#888" }}>câu</span>
          </div>
        </div>
      </div>

      {/* Danh sách các môn học hiện có */}
      {subjectsList.length > 0 && (
        <div style={{ 
          background: "rgba(255,255,255,0.6)", 
          padding: "12px 16px", 
          borderRadius: "10px", 
          marginBottom: "25px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "10px"
        }}>
          <span style={{ fontSize: "13px", fontWeight: "600", color: "#555" }}>📖 Các môn trong kho ({subjectsList.length} môn):</span>
          {subjectsList.map(subj => {
            const s = stats.bySubject[subj];
            const isSelected = selectedSubject === subj;
            return (
              <span 
                key={subj}
                onClick={() => setSelectedSubject(isSelected ? "all" : subj)}
                style={{
                  background: isSelected ? "#ff5c8a" : "#fff",
                  color: isSelected ? "#fff" : "#444",
                  padding: "4px 12px",
                  borderRadius: "16px",
                  fontSize: "12px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  border: isSelected ? "1px solid #ff5c8a" : "1px solid rgba(0,0,0,0.08)",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                title="Nhấn để lọc câu hỏi của môn này"
              >
                <strong>{subj}</strong>: {s.total} câu
              </span>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* FORM TỰ NHẬP LIỆU CÂU HỎI THỦ CÔNG (MANUAL QUESTION CREATOR) */}
      {/* ========================================================================= */}
      {showManualBox && (
        <form 
          onSubmit={handleCreateManualQuestion}
          style={{ 
            background: "rgba(255,255,255,0.95)", 
            padding: "22px", 
            borderRadius: "12px", 
            marginBottom: "25px",
            border: "2px solid #2ecc71",
            boxShadow: "0 4px 15px rgba(0,0,0,0.05)"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", borderBottom: "1px solid #eee", paddingBottom: "10px" }}>
            <h4 style={{ margin: 0, color: "#27ae60", fontSize: "16px" }}>
              ✍️ Tự Nhập Câu Hỏi Mới Vào Ngân Hàng Đề
            </h4>
            <span style={{ fontSize: "12px", color: "#666" }}>
              Dành cho Giảng viên tự soạn câu hỏi trực tiếp không cần Excel/CSV
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px", marginBottom: "15px" }}>
            {/* Chọn môn học hoặc tạo môn mới */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#444", marginBottom: "4px" }}>
                Môn học:
              </label>
              <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                  <input 
                    type="radio" 
                    name="manualSubjMode" 
                    checked={manualSubjectMode === "select"} 
                    onChange={() => setManualSubjectMode("select")} 
                  />
                  Chọn môn có sẵn
                </label>
                <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                  <input 
                    type="radio" 
                    name="manualSubjMode" 
                    checked={manualSubjectMode === "new"} 
                    onChange={() => setManualSubjectMode("new")} 
                  />
                  + Môn mới
                </label>
              </div>

              {manualSubjectMode === "select" ? (
                <select 
                  className="input-field"
                  value={manualForm.subject}
                  onChange={(e) => setManualForm({ ...manualForm, subject: e.target.value })}
                  style={{ width: "100%", fontSize: "13px" }}
                >
                  {subjectsList.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  {subjectsList.length === 0 && <option value="Chung">Môn chung</option>}
                </select>
              ) : (
                <input 
                  type="text"
                  placeholder="VD: Cấu trúc dữ liệu & Giải thuật"
                  className="input-field"
                  value={manualForm.newSubject}
                  onChange={(e) => setManualForm({ ...manualForm, newSubject: e.target.value })}
                  style={{ width: "100%", fontSize: "13px" }}
                />
              )}
            </div>

            {/* Chương / Chủ đề */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#444", marginBottom: "4px" }}>
                Chương / Bài học:
              </label>
              <input 
                type="text"
                placeholder="VD: Chương 2: Đồ thị"
                className="input-field"
                value={manualForm.chapter}
                onChange={(e) => setManualForm({ ...manualForm, chapter: e.target.value })}
                style={{ width: "100%", fontSize: "13px" }}
              />
            </div>

            {/* Mức độ khó */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#444", marginBottom: "4px" }}>
                Mức độ khó:
              </label>
              <select 
                className="input-field"
                value={manualForm.difficulty}
                onChange={(e) => setManualForm({ ...manualForm, difficulty: e.target.value })}
                style={{ width: "100%", fontSize: "13px" }}
              >
                <option value="Easy">🟢 Dễ (Easy)</option>
                <option value="Medium">🟡 Trung bình (Medium)</option>
                <option value="Hard">🔴 Khó (Hard)</option>
              </select>
            </div>
          </div>

          {/* Nội dung câu hỏi */}
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#444", marginBottom: "4px" }}>
              Nội dung câu hỏi:
            </label>
            <textarea 
              rows="3"
              placeholder="Nhập nội dung câu hỏi trắc nghiệm tại đây..."
              className="input-field"
              value={manualForm.question_text}
              onChange={(e) => setManualForm({ ...manualForm, question_text: e.target.value })}
              style={{ width: "100%", fontSize: "14px", resize: "vertical" }}
            />
          </div>

          {/* 4 Phương án lựa chọn */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "15px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "#ff5c8a" }}>Phương án A:</label>
              <input 
                type="text"
                placeholder="Nội dung đáp án A..."
                className="input-field"
                value={manualForm.optionA}
                onChange={(e) => setManualForm({ ...manualForm, optionA: e.target.value })}
                style={{ width: "100%", fontSize: "13px", marginTop: "2px" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "#ff5c8a" }}>Phương án B:</label>
              <input 
                type="text"
                placeholder="Nội dung đáp án B..."
                className="input-field"
                value={manualForm.optionB}
                onChange={(e) => setManualForm({ ...manualForm, optionB: e.target.value })}
                style={{ width: "100%", fontSize: "13px", marginTop: "2px" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "#ff5c8a" }}>Phương án C:</label>
              <input 
                type="text"
                placeholder="Nội dung đáp án C..."
                className="input-field"
                value={manualForm.optionC}
                onChange={(e) => setManualForm({ ...manualForm, optionC: e.target.value })}
                style={{ width: "100%", fontSize: "13px", marginTop: "2px" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "#ff5c8a" }}>Phương án D:</label>
              <input 
                type="text"
                placeholder="Nội dung đáp án D..."
                className="input-field"
                value={manualForm.optionD}
                onChange={(e) => setManualForm({ ...manualForm, optionD: e.target.value })}
                style={{ width: "100%", fontSize: "13px", marginTop: "2px" }}
              />
            </div>
          </div>

          {/* Chọn đáp án đúng */}
          <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "18px" }}>
            <label style={{ fontSize: "13px", fontWeight: "bold", color: "#27ae60" }}>
              🎯 Đáp án đúng:
            </label>
            {['A', 'B', 'C', 'D'].map(letter => (
              <label key={letter} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "14px", fontWeight: "bold", cursor: "pointer" }}>
                <input 
                  type="radio" 
                  name="correct_answer" 
                  value={letter} 
                  checked={manualForm.correct_answer === letter} 
                  onChange={(e) => setManualForm({ ...manualForm, correct_answer: e.target.value })} 
                />
                {letter}
              </label>
            ))}
          </div>

          {manualStatus && (
            <div style={{
              marginBottom: "15px",
              padding: "8px 12px",
              borderRadius: "6px",
              background: manualStatus.startsWith("✅") ? "rgba(46, 125, 50, 0.12)" : "rgba(214, 48, 49, 0.12)",
              color: manualStatus.startsWith("✅") ? "#2e7d32" : "#d63031",
              fontSize: "13px",
              fontWeight: "600"
            }}>
              {manualStatus}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px" }}>
            <button 
              type="submit" 
              disabled={savingManual}
              className="btn-primary"
              style={{ background: "#2ecc71", padding: "8px 22px" }}
            >
              {savingManual ? "⏳ Đang lưu..." : "💾 Lưu Câu Hỏi Vào Kho"}
            </button>
            <button 
              type="button" 
              onClick={() => setShowManualBox(false)}
              style={{ background: "#eee", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}
            >
              Đóng lại
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* KHU VỰC NẠP FILE CSV (CÓ CHỌN MÔN ĐÍCH HOẶC TỰ NHẬN DIỆN TỪ FILE) */}
      {/* ========================================================================= */}
      {showUploadBox && (
        <div style={{ 
          background: "rgba(255,255,255,0.92)", 
          padding: "20px", 
          borderRadius: "12px", 
          marginBottom: "25px",
          border: "2px dashed #ff5c8a" 
        }}>
          <h4 style={{ margin: "0 0 8px 0", color: "#d81b60" }}>
            📤 Nạp câu hỏi hàng loạt từ file CSV
          </h4>
          <p style={{ margin: "0 0 15px 0", fontSize: "13px", color: "#666" }}>
            Hỗ trợ cấu trúc tiêu chuẩn: <code>subject, chapter, difficulty, question_text, optionA, optionB, optionC, optionD, correct_answer</code>
          </p>

          {/* Cấu hình gán môn học khi nạp CSV */}
          <div style={{ background: "rgba(255, 143, 171, 0.1)", padding: "12px 16px", borderRadius: "8px", marginBottom: "15px" }}>
            <div style={{ fontSize: "13px", fontWeight: "bold", color: "#d81b60", marginBottom: "8px" }}>
              🎯 Quy tắc gán môn học cho file CSV này:
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                <input 
                  type="radio" 
                  name="uploadMode" 
                  checked={uploadSubjectMode === "custom"} 
                  onChange={() => setUploadSubjectMode("custom")} 
                />
                <strong>Chỉ định một môn học cụ thể cho toàn bộ câu hỏi trong file:</strong>
              </label>

              {uploadSubjectMode === "custom" && (
                <div style={{ display: "flex", gap: "10px", alignItems: "center", marginLeft: "22px", flexWrap: "wrap" }}>
                  <select 
                    className="input-field"
                    value={uploadTargetSubject}
                    onChange={(e) => {
                      setUploadTargetSubject(e.target.value);
                      if (e.target.value !== "__NEW__") setNewSubjectInput("");
                    }}
                    style={{ fontSize: "13px", padding: "6px 12px" }}
                  >
                    {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
                    <option value="__NEW__">➕ Nhập môn học mới...</option>
                  </select>

                  {uploadTargetSubject === "__NEW__" && (
                    <input 
                      type="text"
                      placeholder="Gõ tên môn học mới (VD: Lập trình Python)"
                      value={newSubjectInput}
                      onChange={(e) => setNewSubjectInput(e.target.value)}
                      className="input-field"
                      style={{ fontSize: "13px", padding: "6px 12px", width: "260px" }}
                    />
                  )}
                </div>
              )}

              <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                <input 
                  type="radio" 
                  name="uploadMode" 
                  checked={uploadSubjectMode === "file"} 
                  onChange={() => setUploadSubjectMode("file")} 
                />
                Tự động lấy môn học từ cột <code>subject</code> trong từng dòng của file CSV
              </label>
            </div>
          </div>

          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileUpload} 
            disabled={uploading}
            className="input-file"
          />

          {status && (
            <div style={{
              marginTop: "12px",
              padding: "10px 14px",
              borderRadius: "8px",
              background: status.startsWith("✅") ? "rgba(46, 125, 50, 0.12)" : status.startsWith("⏳") ? "rgba(25, 118, 210, 0.12)" : "rgba(214, 48, 49, 0.12)",
              color: status.startsWith("✅") ? "#2e7d32" : status.startsWith("⏳") ? "#1565c0" : "#d63031",
              fontSize: "13px",
              fontWeight: "600"
            }}>
              {status}
            </div>
          )}

          {previewQuestions.length > 0 && (
            <div style={{ marginTop: "15px", background: "#fafafa", padding: "12px", borderRadius: "8px" }}>
              <div style={{ fontWeight: "600", fontSize: "13px", marginBottom: "6px" }}>📋 Xem trước 5 câu vừa nạp:</div>
              <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#555" }}>
                {previewQuestions.map((q, idx) => (
                  <li key={idx} style={{ marginBottom: "4px" }}>
                    [Môn: <strong>{q.subject}</strong> | {q.difficulty}] {q.question_text.slice(0, 80)}... — <strong>Đáp án: {q.correct_answer}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* BỘ LỌC & TÙY CHỈNH SỐ LƯỢNG HIỂN THỊ CÂU HỎI TRONG KHO */}
      {/* ========================================================================= */}
      <div style={{ 
        display: "flex", 
        flexWrap: "wrap", 
        gap: "12px", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "15px",
        background: "rgba(255,255,255,0.75)",
        padding: "12px 16px",
        borderRadius: "10px"
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
          {/* Lọc theo môn */}
          <div>
            <select 
              value={selectedSubject} 
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="input-field"
              style={{ fontSize: "13px", padding: "6px 12px", fontWeight: "500" }}
            >
              <option value="all">🌐 Tất cả môn học ({stats.total || 0} câu)</option>
              {subjectsList.map(subj => (
                <option key={subj} value={subj}>
                  📖 {subj} ({stats.bySubject[subj]?.total || 0} câu)
                </option>
              ))}
            </select>
          </div>

          {/* Lọc theo độ khó */}
          <div>
            <select 
              value={selectedDifficulty} 
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="input-field"
              style={{ fontSize: "13px", padding: "6px 12px" }}
            >
              <option value="all">🎯 Tất cả mức độ</option>
              <option value="Easy">🟢 Dễ (Easy)</option>
              <option value="Medium">🟡 Trung bình (Medium)</option>
              <option value="Hard">🔴 Khó (Hard)</option>
            </select>
          </div>

          {/* Tìm kiếm */}
          <div>
            <input 
              type="text"
              placeholder="🔍 Tìm từ khóa câu hỏi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
              style={{ fontSize: "13px", padding: "6px 12px", width: "180px" }}
            />
          </div>
        </div>

        {/* TÙY CHỈNH SỐ LƯỢNG CÂU HIỂN THỊ (THEO YÊU CẦU CỦA GIẢNG VIÊN) */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#555" }}>
              Số câu xem:
            </span>
            <input 
              type="number" 
              min="1" 
              max="1000" 
              value={isAllLimit ? "" : limitCount} 
              placeholder={isAllLimit ? "Tất cả" : "50"}
              onChange={(e) => {
                setIsAllLimit(false);
                setLimitCount(Number(e.target.value) || 1);
              }}
              className="input-field" 
              style={{ width: "65px", padding: "5px 8px", fontSize: "13px", textAlign: "center", fontWeight: "bold" }}
              title="Nhập số lượng câu hỏi bạn muốn hiển thị"
            />
            {/* Các nút chọn nhanh số lượng */}
            <div style={{ display: "flex", gap: "4px" }}>
              {[20, 50, 100].map(cnt => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => {
                    setIsAllLimit(false);
                    setLimitCount(cnt);
                  }}
                  style={{
                    background: (!isAllLimit && Number(limitCount) === cnt) ? "#ff5c8a" : "rgba(255,255,255,0.9)",
                    color: (!isAllLimit && Number(limitCount) === cnt) ? "#fff" : "#444",
                    border: "1px solid #ddd",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontWeight: "600"
                  }}
                >
                  {cnt}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsAllLimit(true)}
                style={{
                  background: isAllLimit ? "#ff5c8a" : "rgba(255,255,255,0.9)",
                  color: isAllLimit ? "#fff" : "#444",
                  border: "1px solid #ddd",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: "600"
                }}
                title="Hiển thị tất cả câu hỏi của bộ lọc"
              >
                Tất cả
              </button>
            </div>
          </div>

          <div style={{ borderLeft: "1px solid #ddd", paddingLeft: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", color: "#666" }}>
              Đang tải: <strong>{displayedQuestions.length}</strong> câu
            </span>
            <button 
              onClick={() => { fetchStats(); fetchQuestions(); }}
              title="Tải lại dữ liệu"
              style={{
                background: "rgba(255,255,255,0.9)",
                border: "1px solid #ddd",
                padding: "5px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                cursor: "pointer"
              }}
            >
              🔄
            </button>
          </div>
        </div>
      </div>

      {/* DANH SÁCH CÂU HỎI TRONG KHO */}
      {loadingQuestions ? (
        <div style={{ textAlign: "center", padding: "30px", color: "#888" }}>
          ⏳ Đang tải dữ liệu câu hỏi...
        </div>
      ) : displayedQuestions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px", background: "rgba(255,255,255,0.5)", borderRadius: "10px", color: "#777" }}>
          Không có câu hỏi nào khớp với bộ lọc hiện tại.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {displayedQuestions.map((q, idx) => {
            const diffColor = 
              q.difficulty === 'Easy' ? '#27ae60' : 
              q.difficulty === 'Medium' ? '#d35400' : '#c0392b';
            const diffBg = 
              q.difficulty === 'Easy' ? 'rgba(39, 174, 96, 0.1)' : 
              q.difficulty === 'Medium' ? 'rgba(211, 84, 0, 0.1)' : 'rgba(192, 57, 43, 0.1)';

            return (
              <div 
                key={q.id || idx} 
                style={{ 
                  background: "rgba(255,255,255,0.85)", 
                  padding: "14px 18px", 
                  borderRadius: "10px",
                  border: "1px solid rgba(0,0,0,0.06)",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontWeight: "bold", color: "#ff5c8a", fontSize: "14px" }}>
                      #{idx + 1}
                    </span>
                    <span style={{ 
                      background: diffBg, 
                      color: diffColor, 
                      padding: "2px 8px", 
                      borderRadius: "10px", 
                      fontSize: "11px", 
                      fontWeight: "bold" 
                    }}>
                      [{q.difficulty || "Medium"}]
                    </span>
                    <span style={{ fontSize: "12px", color: "#777" }}>
                      Môn: <strong>{q.subject}</strong> • {q.chapter || "Chương 1"}
                    </span>
                  </div>

                  <button 
                    onClick={() => handleDeleteQuestion(q.id, q.question_text)}
                    title="Xóa câu hỏi này"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#e74c3c",
                      fontSize: "12px",
                      cursor: "pointer",
                      padding: "2px 6px"
                    }}
                  >
                    🗑️ Xóa
                  </button>
                </div>

                <div style={{ fontSize: "14px", fontWeight: "500", color: "#2c3e50", marginBottom: "10px", whiteSpace: "pre-line" }}>
                  {q.question_text}
                </div>

                {/* Các phương án A, B, C, D */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "10px" }}>
                  {q.options?.map((opt, oIdx) => {
                    const label = String.fromCharCode(65 + oIdx); // A, B, C, D
                    const isCorrect = q.correct_answer === label;
                    return (
                      <div 
                        key={oIdx}
                        style={{
                          fontSize: "13px",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          background: isCorrect ? "rgba(46, 204, 113, 0.15)" : "#f8f9fa",
                          border: isCorrect ? "1px solid #2ecc71" : "1px solid #eee",
                          color: isCorrect ? "#27ae60" : "#555",
                          fontWeight: isCorrect ? "600" : "normal"
                        }}
                      >
                        <strong>{label}.</strong> {opt}
                      </div>
                    );
                  })}
                </div>

                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "6px", 
                  fontSize: "12px", 
                  color: "#27ae60",
                  fontWeight: "600" 
                }}>
                  <span>Đáp án chuẩn:</span>
                  <span style={{ 
                    background: "#2ecc71", 
                    color: "#fff", 
                    padding: "2px 8px", 
                    borderRadius: "12px", 
                    fontSize: "11px" 
                  }}>
                    {q.correct_answer}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}