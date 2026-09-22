import React, { useState, useEffect } from "react";
import { api } from "./api";
import { db } from "./firebase";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";

export default function ExamManager() {
  const [exams, setExams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [activeTab, setActiveTab] = useState("exams"); // 'exams' | 'submissions'
  const [loading, setLoading] = useState(true);
  const [selectedExamFilter, setSelectedExamFilter] = useState("all");
  const [examSortBy, setExamSortBy] = useState("time_desc"); // 'time_desc' | 'time_asc' | 'subject_asc'
  const [sortBy, setSortBy] = useState("time_desc"); // 'time_desc' | 'time_asc' | 'score_desc'
  const [deletingId, setDeletingId] = useState(null);
  const [selectedReview, setSelectedReview] = useState(null); // Lưu trữ bài nộp đang xem chi tiết

  // 1. Tải danh sách đề thi
  const fetchExams = async () => {
    try {
      const res = await api.getExams();
      setExams(res.exams || []);
    } catch (err) {
      console.error("Lỗi khi tải đề thi:", err);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchExams().finally(() => setLoading(false));

    // 2. LẮNG NGHE KẾT QUẢ NỘP BÀI THỜI GIAN THỰC (REALTIME LIVE SCOREBOARD)
    // Khi bất kỳ sinh viên nào nộp bài trên Cloud, bảng điểm lập tức nhảy số!
    let unsubscribe = () => {};
    try {
      const q = query(collection(db, "ExamSubmissions"), orderBy("submitted_at", "desc"), limit(100));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const liveSubs = [];
        snapshot.forEach(doc => {
          liveSubs.push({ id: doc.id, ...doc.data() });
        });
        setSubmissions(liveSubs);
      }, (error) => {
        console.warn("Realtime onSnapshot fallback to API:", error);
        api.getSubmissions().then(res => setSubmissions(res.submissions || []));
      });
    } catch (e) {
      console.warn("Firestore listener setup error:", e);
      api.getSubmissions().then(res => setSubmissions(res.submissions || []));
    }

    return () => unsubscribe();
  }, []);

  // Xóa đề thi (Dọn dẹp đề thi rác / đề thử nghiệm)
  const handleDeleteExam = async (examId, examTitle) => {
    const confirm = window.confirm(`Bạn có chắc chắn muốn xóa đề thi: "${examTitle}" không?\nHành động này không thể hoàn tác.`);
    if (!confirm) return;

    setDeletingId(examId);
    try {
      await api.deleteExam(examId);
      setExams(prev => prev.filter(e => e.id !== examId));
    } catch (err) {
      alert("Lỗi khi xóa đề thi: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Lọc và sắp xếp danh sách Đề Thi
  const sortedExams = [...exams].sort((a, b) => {
    if (examSortBy === "subject_asc") {
      return (a.subject || "").localeCompare(b.subject || "");
    }
    const timeA = a.created_at?.seconds || (a.start_time ? new Date(a.start_time).getTime() : 0);
    const timeB = b.created_at?.seconds || (b.start_time ? new Date(b.start_time).getTime() : 0);
    if (examSortBy === "time_asc") return timeA - timeB;
    return timeB - timeA; // time_desc default
  });

  // Lọc và sắp xếp bảng điểm
  const filteredSubmissions = submissions
    .filter(s => {
      if (selectedExamFilter === "all") return true;
      return s.exam_id === selectedExamFilter || s.exam_title?.includes(selectedExamFilter);
    })
    .sort((a, b) => {
      if (sortBy === "score_desc") {
        return (b.score || 0) - (a.score || 0);
      }
      const timeA = a.submitted_at?.seconds || 0;
      const timeB = b.submitted_at?.seconds || 0;
      if (sortBy === "time_asc") return timeA - timeB;
      return timeB - timeA; // time_desc default
    });

  // Thống kê nhanh cho lớp học
  const totalSubmissions = filteredSubmissions.length;
  const avgScore = totalSubmissions > 0 
    ? (filteredSubmissions.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0) / totalSubmissions).toFixed(1)
    : 0;
  const passRate = totalSubmissions > 0
    ? Math.round((filteredSubmissions.filter(s => s.score >= 5).length / totalSubmissions) * 100)
    : 0;
  const maxScore = totalSubmissions > 0
    ? Math.max(...filteredSubmissions.map(s => Number(s.score) || 0))
    : 0;

  return (
    <div className="glass-panel" style={{ marginBottom: "30px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
        <div>
          <h2 style={{ margin: "0 0 5px 0" }}>3. Giám Sát Kỳ Thi & Phổ Điểm (Live Monitor)</h2>
          <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>
            Quản lý đề thi, dọn dẹp đề cũ và theo dõi kết quả nộp bài Realtime của sinh viên
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ 
            background: "rgba(46, 125, 50, 0.12)", 
            color: "#2e7d32", 
            padding: "4px 10px", 
            borderRadius: "15px", 
            fontSize: "12px", 
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            gap: "5px"
          }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#2e7d32", display: "inline-block" }}></span>
            Realtime Live
          </span>
          <button 
            onClick={() => { fetchExams(); }} 
            style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "13px" }}
          >
            🔄 Tải lại
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveTab("exams")}
          style={{
            padding: "8px 18px",
            borderRadius: "50px",
            border: "none",
            background: activeTab === "exams" ? "#ff8fab" : "rgba(255,255,255,0.7)",
            color: activeTab === "exams" ? "#fff" : "#444",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          📑 Quản Lý Đề Thi ({exams.length})
        </button>
        <button
          onClick={() => setActiveTab("submissions")}
          style={{
            padding: "8px 18px",
            borderRadius: "50px",
            border: "none",
            background: activeTab === "submissions" ? "#ff8fab" : "rgba(255,255,255,0.7)",
            color: activeTab === "submissions" ? "#fff" : "#444",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          🎓 Bảng Điểm Trực Tiếp ({submissions.length})
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "30px", color: "#777" }}>
          ⏳ Đang đồng bộ dữ liệu từ Cloud Firestore...
        </div>
      ) : activeTab === "exams" ? (
        /* ================= TAB 1: QUẢN LÝ & XÓA ĐỀ THI ================= */
        exams.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px", color: "#777" }}>
            <div style={{ fontSize: "36px", marginBottom: "10px" }}>📭</div>
            <p style={{ margin: 0 }}>Chưa có đề thi nào trong hệ thống. Hãy sang Tab <strong>1. Sinh Đề Thông Minh</strong> để tạo đề mới.</p>
          </div>
        ) : (
          <div>
            {/* Thanh công cụ sắp xếp danh sách đề */}
            <div style={{ 
              display: "flex", 
              justifyContent: "flex-end", 
              marginBottom: "15px", 
              background: "rgba(255,255,255,0.7)", 
              padding: "10px 16px", 
              borderRadius: "10px" 
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "#555" }}>
                  🔃 Sắp xếp theo:
                </label>
                <select 
                  className="input-field" 
                  value={examSortBy} 
                  onChange={(e) => setExamSortBy(e.target.value)}
                  style={{ padding: "6px 12px", fontSize: "13px" }}
                >
                  <option value="time_desc">Thời gian tạo (Mới nhất trước)</option>
                  <option value="time_asc">Thời gian tạo (Cũ nhất trước)</option>
                  <option value="subject_asc">Môn học (A-Z)</option>
                </select>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid rgba(0,0,0,0.1)", color: "#555" }}>
                  <th style={{ padding: "10px" }}>Mã Đề</th>
                  <th style={{ padding: "10px" }}>Tiêu đề</th>
                  <th style={{ padding: "10px" }}>Môn học</th>
                  <th style={{ padding: "10px" }}>Quy mô</th>
                  <th style={{ padding: "10px" }}>Thời lượng</th>
                  <th style={{ padding: "10px" }}>Hạn nộp</th>
                  <th style={{ padding: "10px", textAlign: "center" }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {sortedExams.map(e => (
                  <tr key={e.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                    <td style={{ padding: "12px 10px", fontWeight: "bold", color: "#d81b60" }}>
                      #{e.exam_code}
                    </td>
                    <td style={{ padding: "12px 10px", fontWeight: "500" }}>{e.title}</td>
                    <td style={{ padding: "12px 10px" }}>{e.subject}</td>
                    <td style={{ padding: "12px 10px" }}>{e.total_questions} câu</td>
                    <td style={{ padding: "12px 10px" }}>{e.duration_minutes || 15}p</td>
                    <td style={{ padding: "12px 10px", fontSize: "12px", color: "#666" }}>
                      {e.end_time ? new Date(e.end_time).toLocaleDateString('vi-VN') : "Tự do"}
                    </td>
                    <td style={{ padding: "12px 10px", textAlign: "center" }}>
                      <button 
                        onClick={() => handleDeleteExam(e.id, e.title)}
                        disabled={deletingId === e.id}
                        className="btn-danger"
                        style={{ padding: "4px 10px", fontSize: "11px", borderRadius: "6px" }}
                        title="Xóa đề thi rác / đề thử nghiệm khỏi database"
                      >
                        {deletingId === e.id ? "Đang xóa..." : "🗑️ Xóa"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )
      ) : (
        /* ================= TAB 2: BẢNG ĐIỂM REALTIME CHO NHIỀU SINH VIÊN ================= */
        <div>
          {/* Thanh công cụ lọc và sắp xếp */}
          <div style={{ 
            display: "flex", 
            flexWrap: "wrap", 
            justifyContent: "space-between", 
            alignItems: "center", 
            gap: "15px", 
            marginBottom: "20px", 
            background: "rgba(255,255,255,0.7)", 
            padding: "12px 16px", 
            borderRadius: "10px" 
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", color: "#555" }}>
                🔍 Lọc theo đề thi:
              </label>
              <select 
                className="input-field" 
                value={selectedExamFilter} 
                onChange={(e) => setSelectedExamFilter(e.target.value)}
                style={{ padding: "6px 12px", fontSize: "13px" }}
              >
                <option value="all">-- Tất cả đề thi ({submissions.length} bài) --</option>
                {exams.map(e => (
                  <option key={e.id} value={e.id}>
                    #{e.exam_code} - {e.title}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", color: "#555" }}>
                📊 Sắp xếp:
              </label>
              <select 
                className="input-field" 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                style={{ padding: "6px 12px", fontSize: "13px" }}
              >
                <option value="time_desc">Thời gian nộp (Mới nhất)</option>
                <option value="time_asc">Thời gian nộp (Cũ nhất)</option>
                <option value="score_desc">Điểm số (Cao nhất ➔ Thấp nhất)</option>
              </select>
            </div>
          </div>

          {/* Hộp Thống kê Phổ điểm */}
          {totalSubmissions > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "20px" }}>
              <div style={{ background: "rgba(255,255,255,0.8)", padding: "12px", borderRadius: "10px", textAlign: "center" }}>
                <div style={{ fontSize: "22px", fontWeight: "bold", color: "#333" }}>{totalSubmissions}</div>
                <div style={{ fontSize: "12px", color: "#666" }}>Tổng bài nộp</div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.8)", padding: "12px", borderRadius: "10px", textAlign: "center" }}>
                <div style={{ fontSize: "22px", fontWeight: "bold", color: "#ff5c8a" }}>{avgScore} / 10</div>
                <div style={{ fontSize: "12px", color: "#666" }}>Điểm trung bình</div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.8)", padding: "12px", borderRadius: "10px", textAlign: "center" }}>
                <div style={{ fontSize: "22px", fontWeight: "bold", color: "#2e7d32" }}>{maxScore} / 10</div>
                <div style={{ fontSize: "12px", color: "#666" }}>Điểm cao nhất</div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.8)", padding: "12px", borderRadius: "10px", textAlign: "center" }}>
                <div style={{ fontSize: "22px", fontWeight: "bold", color: "#1976d2" }}>{passRate}%</div>
                <div style={{ fontSize: "12px", color: "#666" }}>Tỷ lệ Đạt (≥ 5.0)</div>
              </div>
            </div>
          )}

          {/* Bảng kết quả bài nộp */}
          {filteredSubmissions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px", color: "#777" }}>
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>📝</div>
              <p style={{ margin: 0 }}>Chưa có sinh viên nào nộp bài cho đề thi này.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid rgba(0,0,0,0.1)", color: "#555" }}>
                    <th style={{ padding: "10px" }}>Hạng</th>
                    <th style={{ padding: "10px" }}>Sinh viên</th>
                    <th style={{ padding: "10px" }}>Đề thi</th>
                    <th style={{ padding: "10px" }}>Điểm số</th>
                    <th style={{ padding: "10px" }}>Số câu đúng</th>
                    <th style={{ padding: "10px" }}>Thời gian nộp</th>
                    <th style={{ padding: "10px", textAlign: "center" }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.map((s, idx) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                      <td style={{ padding: "12px 10px", fontWeight: "bold", color: idx === 0 ? "#f39c12" : idx === 1 ? "#7f8c8d" : idx === 2 ? "#d35400" : "#888" }}>
                        {idx === 0 ? "🥇 #1" : idx === 1 ? "🥈 #2" : idx === 2 ? "🥉 #3" : `#${idx + 1}`}
                      </td>
                      <td style={{ padding: "12px 10px", fontWeight: "600" }}>
                        {s.student_name || s.student_email}
                        <div style={{ fontSize: "11px", color: "#888", fontWeight: "normal" }}>{s.student_email}</div>
                      </td>
                      <td style={{ padding: "12px 10px", maxWidth: "200px" }}>{s.exam_title}</td>
                      <td style={{ padding: "12px 10px", fontWeight: "bold", fontSize: "16px", color: s.score >= 8 ? "#2e7d32" : s.score >= 5 ? "#e67e22" : "#d63031" }}>
                        {s.score} / 10
                      </td>
                      <td style={{ padding: "12px 10px" }}>
                        {s.correct_count} / {s.total_questions}
                      </td>
                      <td style={{ padding: "12px 10px", color: "#888", fontSize: "12px" }}>
                        {s.submitted_at?.seconds 
                          ? new Date(s.submitted_at.seconds * 1000).toLocaleTimeString('vi-VN') + " " + new Date(s.submitted_at.seconds * 1000).toLocaleDateString('vi-VN')
                          : "Vừa xong"}
                      </td>
                      <td style={{ padding: "12px 10px", textAlign: "center" }}>
                        <button 
                          className="btn-primary" 
                          onClick={() => setSelectedReview(s)}
                          style={{ padding: "6px 12px", fontSize: "11px", borderRadius: "20px", whiteSpace: "nowrap" }}
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

      {/* CHI TIẾT BÀI LÀM SINH VIÊN (MODAL CHO GIẢNG VIÊN) */}
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
            <h2 style={{ margin: "0 0 5px 0", color: "#ff5c8a" }}>
              📝 Bài làm: {selectedReview.exam_title}
            </h2>
            <div style={{ marginBottom: "15px", color: "#333", fontWeight: "600" }}>
              Sinh viên: {selectedReview.student_name || selectedReview.student_email}
            </div>
            
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
                        👉 SV chọn: <strong>{item.student_answer}</strong>
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
