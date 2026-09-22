import React, { useState, useEffect } from "react";
import { api } from "./api";
import { db } from "./firebase";
import { collection, onSnapshot, query, limit } from "firebase/firestore";

export default function StudentExamHall({ user }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [examCodeInput, setExamCodeInput] = useState("");
  const [findingCode, setFindingCode] = useState(false);
  
  // Trạng thái đang làm bài thi
  const [activeExam, setActiveExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Lịch sử làm bài
  const [mySubmissions, setMySubmissions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null); // Lưu trữ bài nộp đang xem chi tiết

  // Tải danh sách đề thi & Thiết lập Realtime Listener để nhận đề mới ngay lập tức
  useEffect(() => {
    fetchHistory();

    let unsubscribe = () => {};
    try {
      const q = query(collection(db, "ExamPapers"), limit(50));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const liveExams = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          let questions = data.questions || [];
          // Ẩn đáp án đúng cho sinh viên
          questions = questions.map(q => {
            const { correct_answer, ...safeQ } = q;
            return safeQ;
          });
          liveExams.push({ id: docSnap.id, ...data, questions });
        });

        // Sắp xếp đề mới nhất lên đầu
        liveExams.sort((a, b) => {
          const timeA = a.created_at?.seconds || (a.start_time ? new Date(a.start_time).getTime() : 0);
          const timeB = b.created_at?.seconds || (b.start_time ? new Date(b.start_time).getTime() : 0);
          return timeB - timeA;
        });

        setExams(liveExams);
        setLoading(false);
      }, (err) => {
        console.warn("Realtime onSnapshot fallback to API:", err);
        fetchExams();
      });
    } catch (e) {
      console.warn("Firestore listener error, fetching via API:", e);
      fetchExams();
    }

    return () => unsubscribe();
  }, []);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const res = await api.getExams();
      setExams(res.exams || []);
    } catch (err) {
      console.error("Lỗi khi tải đề thi:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.getSubmissions();
      setMySubmissions(res.submissions || []);
    } catch (err) {
      console.error("Lỗi khi tải lịch sử:", err);
    }
  };

  // Bắt đầu làm bài thi (Có dung sai đồng hồ chống lệch giây/phút)
  const startExam = async (exam) => {
    const now = new Date();
    // Thêm dung sai 2 phút (120,000 ms) tránh việc đồng hồ giữa các máy lệch nhau
    const gracePeriodMs = 2 * 60 * 1000;
    if (exam.start_time && (new Date(exam.start_time).getTime() - gracePeriodMs) > now.getTime()) {
      alert(`⏳ Đề thi chưa đến giờ mở!\nThời gian bắt đầu: ${new Date(exam.start_time).toLocaleString('vi-VN')}`);
      return;
    }
    if (exam.end_time && new Date(exam.end_time) < now) {
      alert(`🔒 Đề thi đã hết hạn nộp bài vào lúc:\n${new Date(exam.end_time).toLocaleString('vi-VN')}`);
      return;
    }

    try {
      setLoading(true);
      // Lấy chi tiết đề thi nếu chưa có đầy đủ câu hỏi
      let fullExam = exam;
      if (!fullExam.questions || fullExam.questions.length === 0) {
        fullExam = await api.getExamById(exam.id);
      }
      setActiveExam(fullExam);
      setAnswers({});
      setResult(null);
      setTimeLeft((fullExam.duration_minutes || 15) * 60);
    } catch (err) {
      alert("Không thể tải nội dung đề thi: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Đếm ngược thời gian làm bài
  useEffect(() => {
    if (!activeExam || result) return;

    if (timeLeft <= 0) {
      handleAutoSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [activeExam, timeLeft, result]);

  // Xử lý chọn đáp án
  const handleSelectOption = (questionId, option) => {
    if (result) return;
    setAnswers(prev => ({
      ...prev,
      [questionId]: option
    }));
  };

  // Nộp bài thi
  const handleSubmitExam = async () => {
    if (submitting || !activeExam) return;

    const answeredCount = Object.keys(answers).length;
    const totalCount = activeExam.questions.length;
    
    if (answeredCount < totalCount) {
      const confirmSubmit = window.confirm(`Bạn mới làm ${answeredCount}/${totalCount} câu. Bạn có chắc chắn muốn nộp bài sớm không?`);
      if (!confirmSubmit) return;
    }

    setSubmitting(true);
    try {
      const res = await api.submitExam(activeExam.id, answers);
      setResult(res);
      fetchHistory(); // Cập nhật lại lịch sử
    } catch (err) {
      alert("Lỗi khi nộp bài: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Tự động thu bài khi hết giờ
  const handleAutoSubmit = async () => {
    if (submitting || result || !activeExam) return;
    alert("⏰ Hết thời gian làm bài! Hệ thống đang tự động thu bài và chấm điểm...");
    setSubmitting(true);
    try {
      const res = await api.submitExam(activeExam.id, answers);
      setResult(res);
      fetchHistory();
    } catch (err) {
      alert("Lỗi thu bài tự động: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Format giây thành phút:giây
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Tìm đề theo mã code trực tiếp trên Cloud Database
  const handleFindByCode = async () => {
    const cleanCode = examCodeInput.trim();
    if (!cleanCode) {
      alert("Vui lòng nhập mã đề thi (6 chữ số).");
      return;
    }

    setFindingCode(true);
    try {
      // 1. Kiểm tra nhanh trong mảng đề thi hiện tại
      const foundInList = exams.find(e => String(e.exam_code).trim() === cleanCode);
      if (foundInList) {
        startExam(foundInList);
        return;
      }

      // 2. Truy vấn trực tiếp từ Cloud Database bằng API getExamByCode
      const examFromDb = await api.getExamByCode(cleanCode);
      if (examFromDb) {
        startExam(examFromDb);
      } else {
        alert(`Không tìm thấy đề thi với mã #${cleanCode}! Vui lòng kiểm tra lại.`);
      }
    } catch (err) {
      alert(err.message || `Không tìm thấy đề thi với mã #${cleanCode}!`);
    } finally {
      setFindingCode(false);
    }
  };

  // =========================================================================
  // GIAO DIỆN LÀM BÀI THI
  // =========================================================================
  if (activeExam) {
    return (
      <div className="glass-panel" style={{ padding: "30px", maxWidth: "850px", margin: "0 auto" }}>
        {/* Thanh trạng thái bài thi: Tiêu đề + Đồng hồ đếm ngược */}
        <div style={{
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          paddingBottom: "15px", 
          borderBottom: "1px solid rgba(0,0,0,0.1)",
          marginBottom: "25px"
        }}>
          <div>
            <h2 style={{ margin: "0 0 5px 0", color: "#ff5c8a", fontSize: "22px" }}>
              📝 {activeExam.title}
            </h2>
            <span style={{ fontSize: "13px", color: "#666" }}>
              Môn: <strong>{activeExam.subject}</strong> | Số lượng: <strong>{activeExam.questions?.length} câu</strong> | Mã đề: <strong>#{activeExam.exam_code}</strong>
            </span>
          </div>

          {!result && (
            <div style={{
              background: timeLeft < 120 ? "rgba(235, 77, 75, 0.2)" : "rgba(255, 143, 171, 0.2)",
              color: timeLeft < 120 ? "#d63031" : "#d81b60",
              padding: "10px 18px",
              borderRadius: "50px",
              fontWeight: "bold",
              fontSize: "18px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
            }}>
              ⏱️ {formatTime(timeLeft)}
            </div>
          )}
        </div>

        {/* KẾT QUẢ SAU KHI NỘP BÀI */}
        {result && (
          <div style={{
            background: "rgba(46, 125, 50, 0.1)",
            border: "1px solid rgba(46, 125, 50, 0.3)",
            borderRadius: "16px",
            padding: "25px",
            marginBottom: "30px",
            textAlign: "center"
          }}>
            <h3 style={{ color: "#2e7d32", margin: "0 0 10px 0", fontSize: "24px" }}>
              🎉 Chúc mừng bạn đã hoàn thành bài thi!
            </h3>
            <div style={{ display: "flex", justifyContent: "center", gap: "30px", margin: "20px 0" }}>
              <div>
                <div style={{ fontSize: "36px", fontWeight: "bold", color: "#d81b60" }}>{result.score}</div>
                <div style={{ fontSize: "13px", color: "#555" }}>Điểm số (Thang 10)</div>
              </div>
              <div style={{ width: "1px", background: "rgba(0,0,0,0.1)" }}></div>
              <div>
                <div style={{ fontSize: "36px", fontWeight: "bold", color: "#2e7d32" }}>
                  {result.correct_count} / {result.total_questions}
                </div>
                <div style={{ fontSize: "13px", color: "#555" }}>Số câu đúng</div>
              </div>
              <div style={{ width: "1px", background: "rgba(0,0,0,0.1)" }}></div>
              <div>
                <div style={{ fontSize: "36px", fontWeight: "bold", color: "#1976d2" }}>
                  {Math.round((result.correct_count / result.total_questions) * 100)}%
                </div>
                <div style={{ fontSize: "13px", color: "#555" }}>Độ chính xác</div>
              </div>
            </div>

            <button 
              onClick={() => { setActiveExam(null); setResult(null); }}
              style={{ 
                marginTop: "15px",
                padding: "16px 40px", 
                fontSize: "18px", 
                fontWeight: "bold",
                background: "linear-gradient(135deg, #ff8fab 0%, #d81b60 100%)",
                color: "white",
                border: "none",
                borderRadius: "50px",
                cursor: "pointer",
                boxShadow: "0 6px 15px rgba(216, 27, 96, 0.3)",
                transition: "all 0.2s"
              }}
            >
              🔙 Hoàn Tất & Trở Về Màn Hình Chính
            </button>
          </div>
        )}

        {/* DANH SÁCH CÂU HỎI */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {activeExam.questions?.map((q, idx) => {
            const selectedOpt = answers[q.id] || answers[idx];
            const reviewItem = result?.review?.[idx];

            return (
              <div 
                key={q.id || idx} 
                className="question-item"
                style={{
                  background: reviewItem 
                    ? (reviewItem.is_correct ? "rgba(46, 125, 50, 0.08)" : "rgba(214, 48, 49, 0.08)")
                    : "rgba(255,255,255,0.7)",
                  border: reviewItem 
                    ? (reviewItem.is_correct ? "1px solid #2e7d32" : "1px solid #d63031")
                    : "1px solid rgba(255,255,255,0.6)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                  <span style={{ fontWeight: "bold", color: "#ff5c8a", fontSize: "15px" }}>
                    Câu {idx + 1}:
                  </span>
                  <span style={{ fontSize: "12px", background: "rgba(0,0,0,0.06)", padding: "2px 8px", borderRadius: "12px" }}>
                    {q.difficulty || "Medium"}
                  </span>
                </div>

                <p style={{ margin: "0 0 15px 0", fontSize: "16px", fontWeight: "500", color: "#2c3e50", lineHeight: "1.5" }}>
                  {q.question_text}
                </p>

                {/* Các lựa chọn A, B, C, D */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {q.options?.map((opt, optIdx) => {
                    const letter = String.fromCharCode(65 + optIdx); // 'A', 'B', 'C', 'D'
                    const isSelected = selectedOpt === letter || selectedOpt === opt;
                    return (
                      <label 
                        key={optIdx}
                        onClick={() => handleSelectOption(q.id || idx, letter)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "10px 14px",
                          borderRadius: "8px",
                          background: isSelected ? "rgba(255, 143, 171, 0.25)" : "rgba(255,255,255,0.6)",
                          border: isSelected ? "1px solid #ff5c8a" : "1px solid rgba(0,0,0,0.08)",
                          cursor: result ? "default" : "pointer",
                          transition: "all 0.2s"
                        }}
                      >
                        <input 
                          type="radio" 
                          name={`q_${idx}`}
                          checked={isSelected}
                          onChange={() => {}}
                          disabled={!!result}
                        />
                        <span style={{ fontWeight: "bold", color: "#ff5c8a", minWidth: "20px" }}>{letter}.</span>
                        <span style={{ fontSize: "14px", color: "#333" }}>{opt}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Giải thích sau khi nộp bài */}
                {reviewItem && (
                  <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px dashed rgba(0,0,0,0.1)", fontSize: "13px" }}>
                    {reviewItem.is_correct ? (
                      <span style={{ color: "#2e7d32", fontWeight: "600" }}>✅ Chính xác!</span>
                    ) : (
                      <div style={{ color: "#d63031" }}>
                        <span style={{ fontWeight: "600" }}>❌ Sai rồi!</span> Đáp án đúng: <strong>{reviewItem.correct_answer}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Nút Nộp Bài */}
        {!result && (
          <div style={{ marginTop: "30px", textAlign: "center" }}>
            <button 
              className="btn-primary" 
              onClick={handleSubmitExam}
              disabled={submitting}
              style={{ padding: "14px 40px", fontSize: "16px", fontWeight: "bold" }}
            >
              {submitting ? "⏳ Đang chấm điểm..." : "🚀 Nộp Bài Thi Ngay"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // GIAO DIỆN DANH SÁCH ĐỀ THI & VÀO PHÒNG THI
  // =========================================================================
  return (
    <div>
      {/* Box nhập mã đề thi nhanh */}
      <div className="glass-panel" style={{ marginBottom: "25px", padding: "25px" }}>
        <h3 style={{ margin: "0 0 15px 0", color: "#ff5c8a", fontSize: "20px" }}>
          🔑 Vào Phòng Thi Bằng Mã Đề
        </h3>
        <p style={{ color: "#666", fontSize: "14px", marginBottom: "15px" }}>
          Nếu Giảng viên cung cấp Mã đề 6 số, bạn hãy nhập vào đây để vào thẳng phòng thi:
        </p>
        <div style={{ display: "flex", gap: "12px", maxWidth: "450px" }}>
          <input 
            type="text" 
            placeholder="VD: 827419" 
            className="input-field"
            value={examCodeInput}
            onChange={(e) => setExamCodeInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleFindByCode(); }}
            disabled={findingCode}
            style={{ flex: 1, letterSpacing: "2px", fontWeight: "bold", fontSize: "16px" }}
          />
          <button 
            className="btn-primary" 
            onClick={handleFindByCode}
            disabled={findingCode}
          >
            {findingCode ? "⏳ Đang tìm..." : "Vào Thi"}
          </button>
        </div>
      </div>

      {/* Tabs Đề thi mở & Lịch sử */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "10px" }}>
          <button 
            onClick={() => setShowHistory(false)}
            style={{
              padding: "8px 18px",
              borderRadius: "50px",
              border: "none",
              background: !showHistory ? "#ff8fab" : "rgba(255,255,255,0.7)",
              color: !showHistory ? "#fff" : "#444",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            📚 Đề Thi Đang Mở ({exams.length})
          </button>
          <button 
            onClick={() => setShowHistory(true)}
            style={{
              padding: "8px 18px",
              borderRadius: "50px",
              border: "none",
              background: showHistory ? "#ff8fab" : "rgba(255,255,255,0.7)",
              color: showHistory ? "#fff" : "#444",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            📊 Lịch Sử Làm Bài ({mySubmissions.length})
          </button>
        </div>

        <button 
          onClick={fetchExams}
          style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "13px" }}
        >
          🔄 Làm mới
        </button>
      </div>

      {/* DANH SÁCH ĐỀ THI ĐANG MỞ */}
      {!showHistory ? (
        loading ? (
          <div className="glass-panel" style={{ textAlign: "center", padding: "40px" }}>
            ⏳ Đang tải danh sách đề thi từ Cloud Firestore...
          </div>
        ) : exams.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: "center", padding: "40px" }}>
            <div style={{ fontSize: "40px", marginBottom: "10px" }}>📭</div>
            <h4 style={{ margin: "0 0 8px 0" }}>Chưa có đề thi nào được mở</h4>
            <p style={{ color: "#777", fontSize: "14px", margin: 0 }}>
              Vui lòng nhờ Giảng viên tạo đề thi mới hoặc nhập mã đề để tham gia.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
            {exams.map(exam => (
              <div 
                key={exam.id} 
                className="glass-panel" 
                style={{ 
                  margin: 0, 
                  padding: "22px", 
                  display: "flex", 
                  flexDirection: "column", 
                  justifyContent: "space-between" 
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                    <span style={{ 
                      background: "rgba(255, 143, 171, 0.2)", 
                      color: "#d81b60", 
                      padding: "3px 10px", 
                      borderRadius: "12px", 
                      fontSize: "12px", 
                      fontWeight: "bold" 
                    }}>
                      #{exam.exam_code}
                    </span>
                    <span style={{ fontSize: "12px", color: "#666" }}>
                      ⏱️ {exam.duration_minutes || 15} phút
                    </span>
                  </div>

                  <h4 style={{ margin: "0 0 8px 0", color: "#2c3e50", fontSize: "17px", lineHeight: "1.4" }}>
                    {exam.title}
                  </h4>

                  <div style={{ fontSize: "13px", color: "#666", marginBottom: "12px" }}>
                    <div>📖 Môn: <strong>{exam.subject}</strong></div>
                    <div>❓ Quy mô: <strong>{exam.total_questions} câu trắc nghiệm</strong></div>
                    <div>👤 Người ra đề: <strong>{exam.creator_name || "Giảng viên"}</strong></div>
                  </div>

                  <div style={{ fontSize: "12px", color: "#555", marginBottom: "16px", background: "rgba(255,255,255,0.6)", padding: "8px 10px", borderRadius: "8px" }}>
                    <div>🕒 Mở đề: <strong>{exam.start_time ? new Date(exam.start_time).toLocaleString('vi-VN') : 'Mở tự do'}</strong></div>
                    <div>⏳ Đóng đề: <strong>{exam.end_time ? new Date(exam.end_time).toLocaleString('vi-VN') : 'Không giới hạn'}</strong></div>
                  </div>
                </div>

                {(() => {
                  const now = new Date();
                  const isNotStarted = exam.start_time && new Date(exam.start_time) > now;
                  const isExpired = exam.end_time && new Date(exam.end_time) < now;

                  if (isNotStarted) {
                    return (
                      <button 
                        className="btn-primary" 
                        disabled
                        style={{ width: "100%", textAlign: "center", background: "#aaa", cursor: "not-allowed", boxShadow: "none" }}
                      >
                        ⏳ Chưa Tới Giờ Mở Đề
                      </button>
                    );
                  }
                  if (isExpired) {
                    return (
                      <button 
                        className="btn-primary" 
                        disabled
                        style={{ width: "100%", textAlign: "center", background: "#e57373", cursor: "not-allowed", boxShadow: "none" }}
                      >
                        🔒 Đã Hết Hạn Nộp Bài
                      </button>
                    );
                  }
                  return (
                    <button 
                      className="btn-primary" 
                      onClick={() => startExam(exam)}
                      style={{ width: "100%", textAlign: "center" }}
                    >
                      🚀 Bắt Đầu Làm Bài
                    </button>
                  );
                })()}
              </div>
            ))}
          </div>
        )
      ) : (
        /* BẢNG LỊCH SỬ LÀM BÀI */
        <div className="glass-panel" style={{ padding: "20px" }}>
          <h4 style={{ margin: "0 0 15px 0", color: "#ff5c8a" }}>Kết quả bài thi đã làm</h4>
          {mySubmissions.length === 0 ? (
            <p style={{ color: "#777", margin: 0 }}>Bạn chưa làm bài thi nào.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid rgba(0,0,0,0.1)", color: "#555" }}>
                    <th style={{ padding: "10px" }}>Tên đề thi</th>
                    <th style={{ padding: "10px" }}>Điểm số</th>
                    <th style={{ padding: "10px" }}>Số câu đúng</th>
                    <th style={{ padding: "10px" }}>Thời gian nộp</th>
                    <th style={{ padding: "10px", textAlign: "center" }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {mySubmissions.map(sub => (
                    <tr key={sub.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                      <td style={{ padding: "12px 10px", fontWeight: "500" }}>{sub.exam_title}</td>
                      <td style={{ padding: "12px 10px", fontWeight: "bold", color: "#d81b60" }}>
                        {sub.score} / 10
                      </td>
                      <td style={{ padding: "12px 10px" }}>
                        {sub.correct_count} / {sub.total_questions}
                      </td>
                      <td style={{ padding: "12px 10px", color: "#888", fontSize: "12px" }}>
                        {sub.submitted_at?.seconds 
                          ? new Date(sub.submitted_at.seconds * 1000).toLocaleString('vi-VN') 
                          : "Vừa xong"}
                      </td>
                      <td style={{ padding: "12px 10px", textAlign: "center" }}>
                        <button 
                          className="btn-primary" 
                          onClick={() => setSelectedReview(sub)}
                          style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "20px" }}
                        >
                          👁️ Xem Chi Tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CHI TIẾT LỊCH SỬ BÀI LÀM (MODAL) */}
      {selectedReview && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
          padding: "20px"
        }}>
          <div className="glass-panel" style={{
            width: "100%", maxWidth: "800px", maxHeight: "90vh", overflowY: "auto",
            padding: "30px", position: "relative"
          }}>
            <button 
              onClick={() => setSelectedReview(null)}
              style={{
                position: "absolute", top: "15px", right: "15px",
                background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: "#666"
              }}
            >
              ×
            </button>
            <h2 style={{ margin: "0 0 10px 0", color: "#ff5c8a" }}>
              📝 Bài làm: {selectedReview.exam_title}
            </h2>
            <div style={{ display: "flex", gap: "20px", marginBottom: "20px", fontSize: "14px", color: "#555" }}>
              <div>Điểm: <strong style={{ color: "#d81b60", fontSize: "18px" }}>{selectedReview.score}/10</strong></div>
              <div>Đúng: <strong>{selectedReview.correct_count}/{selectedReview.total_questions}</strong></div>
              <div>Thời gian nộp: <strong>{selectedReview.submitted_at?.seconds ? new Date(selectedReview.submitted_at.seconds * 1000).toLocaleString('vi-VN') : "Vừa xong"}</strong></div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              {selectedReview.review && selectedReview.review.length > 0 ? (
                selectedReview.review.map((item, idx) => (
                  <div key={idx} style={{
                    padding: "15px",
                    borderRadius: "10px",
                    background: item.is_correct ? "rgba(46, 125, 50, 0.1)" : "rgba(214, 48, 49, 0.1)",
                    border: item.is_correct ? "1px solid #2e7d32" : "1px solid #d63031"
                  }}>
                    <div style={{ fontWeight: "bold", marginBottom: "8px" }}>Câu {idx + 1}: {item.question_text}</div>
                    <div style={{ fontSize: "14px" }}>
                      <div style={{ color: item.is_correct ? "#2e7d32" : "#d63031" }}>
                        👉 Bạn chọn: <strong>{item.student_answer}</strong>
                      </div>
                      {!item.is_correct && (
                        <div style={{ color: "#2e7d32", marginTop: "4px" }}>
                          ✅ Đáp án đúng: <strong>{item.correct_answer}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ color: "#888", fontStyle: "italic" }}>
                  Bài làm này chưa được lưu chi tiết câu hỏi (phiên bản cũ).
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
