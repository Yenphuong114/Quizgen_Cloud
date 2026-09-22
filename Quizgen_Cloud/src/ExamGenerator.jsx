import React, { useState, useEffect } from "react";
import { api } from "./api";

export default function ExamGenerator({ onNavigateToManager }) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [numQuestions, setNumQuestions] = useState(10);
  
  // Ma trận phân bổ độ khó
  const [useMatrix, setUseMatrix] = useState(true);
  const [easyCount, setEasyCount] = useState(4);
  const [medCount, setMedCount] = useState(4);
  const [hardCount, setHardCount] = useState(2);

  // Thống kê kho câu hỏi từ Backend
  const [bankStats, setBankStats] = useState({ total: 0, bySubject: {}, byDifficulty: {} });

  // Khung thời gian làm bài
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const toLocalISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [startTime, setStartTime] = useState(toLocalISO(now));
  const [endTime, setEndTime] = useState(toLocalISO(tomorrow));

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  // 3 Chế độ sinh đề: 'bank' (100% CSV), 'ai' (100% AI mới), 'hybrid' (Trộn CSV + AI)
  const [examMode, setExamMode] = useState("bank");

  // Gemini API Key & Modal
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem("gemini_api_key") || "");
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKeyInput, setTempKeyInput] = useState("");

  // Kiểm tra xem Backend có hỗ trợ Proxy AI Key không (Fix B1)
  const [backendAiAvailable, setBackendAiAvailable] = useState(false);

  // Cấu hình Chế độ 2: 100% AI
  const [aiQuestionCount, setAiQuestionCount] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState("Medium");
  const [saveAiToBank, setSaveAiToBank] = useState(true);

  // Cấu hình Chế độ 3: Trộn Hybrid
  const [hybridCsvCount, setHybridCsvCount] = useState(5);
  const [hybridAiCount, setHybridAiCount] = useState(5);
  const [hybridAiDifficulty, setHybridAiDifficulty] = useState("Medium");
  const [hybridSaveAiToBank, setHybridSaveAiToBank] = useState(true);

  // Tải thống kê kho câu hỏi để hiển thị số lượng sẵn có
  useEffect(() => {
    async function loadStats() {
      try {
        const stats = await api.getQuestionStats();
        if (stats && stats.bySubject) {
          setBankStats(stats);
          const subjects = Object.keys(stats.bySubject);
          // Fix C: Tự động chọn môn đầu tiên từ kho thay vì hardcode
          if (subjects.length > 0) {
            setSubject(prev => (!prev || !stats.bySubject[prev]) ? subjects[0] : prev);
          }
        }
      } catch (err) {
        console.error("Lỗi lấy thống kê kho:", err);
      }
    }

    // Fix B1: Kiểm tra backend có proxy AI key không
    async function checkBackendAi() {
      try {
        const result = await api.checkBackendAiAvailable();
        setBackendAiAvailable(result.available === true);
      } catch {
        setBackendAiAvailable(false);
      }
    }

    loadStats();
    checkBackendAi();
  }, []);

  // Preset nhanh số lượng câu hỏi
  const applyPreset = (total, easy, med, hard) => {
    setNumQuestions(total);
    setEasyCount(easy);
    setMedCount(med);
    setHardCount(hard);
    setDurationMinutes(total <= 10 ? 15 : total <= 25 ? 30 : total <= 50 ? 60 : 90);
  };

  // Thông tin kho câu hỏi của môn đang chọn
  const currentSubjInfo = bankStats.bySubject?.[subject] || {
    total: bankStats.total || 0,
    Easy: bankStats.byDifficulty?.Easy || 0,
    Medium: bankStats.byDifficulty?.Medium || 0,
    Hard: bankStats.byDifficulty?.Hard || 0
  };

  const totalMatrixCount = Number(easyCount) + Number(medCount) + Number(hardCount);

  const getComputedTotalQuestions = () => {
    if (examMode === 'bank') return useMatrix ? totalMatrixCount : Number(numQuestions);
    if (examMode === 'ai') return Number(aiQuestionCount) || 0;
    if (examMode === 'hybrid') return (Number(hybridCsvCount) || 0) + (Number(hybridAiCount) || 0);
    return 10;
  };
  const totalTargetQuestions = getComputedTotalQuestions();

  // Cảnh báo nếu số câu yêu cầu vượt kho (Chỉ áp dụng cho Mode Bank & Hybrid)
  const isOverEasy = examMode === 'bank' && useMatrix && Number(easyCount) > (currentSubjInfo.Easy || 0);
  const isOverMed = examMode === 'bank' && useMatrix && Number(medCount) > (currentSubjInfo.Medium || 0);
  const isOverHard = examMode === 'bank' && useMatrix && Number(hardCount) > (currentSubjInfo.Hard || 0);
  const isOverTotal = examMode === 'bank' && totalTargetQuestions > (currentSubjInfo.total || 0);
  const isHybridCsvOver = examMode === 'hybrid' && Number(hybridCsvCount) > (currentSubjInfo.total || 0);

  const handleSaveApiKey = () => {
    const key = tempKeyInput.trim();
    if (!key) {
      alert("Vui lòng nhập API Key.");
      return;
    }
    localStorage.setItem("gemini_api_key", key);
    setGeminiApiKey(key);
    setShowKeyModal(false);
    alert("✅ Đã lưu Google Gemini API Key thành công!");
  };

  const handleClearApiKey = () => {
    localStorage.removeItem("gemini_api_key");
    setGeminiApiKey("");
    setTempKeyInput("");
    setShowKeyModal(false);
    alert("Đã xóa Gemini API Key khỏi trình duyệt.");
  };

  const handleGenerateExam = async () => {
    if (!subject || !subject.trim()) {
      alert("Vui lòng chọn môn học trước khi sinh đề.");
      return;
    }
    if (totalTargetQuestions <= 0) {
      alert("Vui lòng chọn số lượng câu hỏi lớn hơn 0.");
      return;
    }

    setLoading(true);
    setCopyStatus("");
    setLoadingMessage("");

    try {
      // ==========================================
      // CHẾ ĐỘ 1: 100% TỪ KHO CSV SẴN CÓ
      // ==========================================
      if (examMode === "bank") {
        setLoadingMessage("📦 Đang trích xuất câu hỏi từ Kho CSV Cloud...");
        const payload = {
          title: title.trim() || `Đề thi môn ${subject}`,
          subject: subject,
          durationMinutes: Number(durationMinutes) || 15,
          startTime: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
          endTime: endTime ? new Date(endTime).toISOString() : null,
          numQuestions: totalTargetQuestions
        };

        if (useMatrix) {
          payload.difficultyDistribution = {
            Easy: Number(easyCount),
            Medium: Number(medCount),
            Hard: Number(hardCount)
          };
        }

        const generatedExam = await api.generateExam(payload);
        setExam(generatedExam);
      } 
      // ==========================================
      // CHẾ ĐỘ 2: 100% AI SÁNG TẠO MỚI (BÁM KIẾN THỨC CSV)
      // ==========================================
      else if (examMode === "ai") {
        // Kiểm tra lại backend một lần nữa (phòng trường hợp Render đang ngái ngủ và check ngầm chưa xong)
        let isBackendAiReady = backendAiAvailable;
        if (!isBackendAiReady) {
          setLoadingMessage("🔄 Đang kết nối đánh thức máy chủ AI...");
          try {
            const checkRes = await api.checkBackendAiAvailable();
            if (checkRes && checkRes.available) {
              isBackendAiReady = true;
              setBackendAiAvailable(true);
            }
          } catch (e) {
            console.log("Wake up check failed", e);
          }
        }

        // Fix B1: Nếu backend KHÔNG có proxy key thì mới yêu cầu key cá nhân
        if (!isBackendAiReady && (!geminiApiKey || !geminiApiKey.trim())) {
          setLoading(false);
          setShowKeyModal(true);
          alert("Vui lòng nhập Google Gemini API Key (Miễn phí 100% không cần thẻ tín dụng) để sử dụng tính năng AI!");
          return;
        }

        setLoadingMessage(`🔍 Đang lấy dữ liệu mẫu môn "${subject}" từ kho câu hỏi làm ngữ cảnh (Grounding)...`);
        const sampleRes = await api.getQuestionsList({ subject, limitCount: 20 });
        const samples = sampleRes.questions || [];

        setLoadingMessage(`✨ Google Gemini AI đang sáng tạo ${aiQuestionCount} câu hỏi mới bám sát kiến thức môn học...`);
        const aiQuestions = await api.generateQuestionsWithAI({
          subject,
          count: Number(aiQuestionCount),
          difficulty: aiDifficulty,
          sampleQuestions: samples,
          // B1: Nếu backend có proxy key thì truyền rỗng để server tự dùng
          apiKey: isBackendAiReady ? "" : geminiApiKey
        });

        if (!aiQuestions || aiQuestions.length === 0) {
          throw new Error("Không nhận được câu hỏi từ AI. Vui lòng thử lại.");
        }

        // Tự động lưu vào ngân hàng câu hỏi nếu được chọn
        if (saveAiToBank) {
          setLoadingMessage(`💾 Đang lưu ${aiQuestions.length} câu hỏi AI vào Ngân hàng câu hỏi Cloud...`);
          for (const q of aiQuestions) {
            await api.addSingleQuestion(q).catch(err => console.warn("Lỗi lưu câu hỏi AI vào kho:", err));
          }
        }

        setLoadingMessage("🚀 Đang xuất bản đề thi 100% AI lên hệ thống...");
        const generatedExam = await api.generateExam({
          title: title.trim() || `Đề thi AI môn ${subject}`,
          subject: subject,
          durationMinutes: Number(durationMinutes) || 15,
          startTime: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
          endTime: endTime ? new Date(endTime).toISOString() : null,
          numQuestions: aiQuestions.length,
          preselectedQuestions: aiQuestions
        });

        setExam(generatedExam);
      }
      // ==========================================
      // CHẾ ĐỘ 3: TRỘN CẢ HAI (HYBRID MIX)
      // ==========================================
      else if (examMode === "hybrid") {
        // Kiểm tra lại backend một lần nữa (phòng trường hợp Render đang ngái ngủ và check ngầm chưa xong)
        let isBackendAiReady = backendAiAvailable;
        if (!isBackendAiReady) {
          setLoadingMessage("🔄 Đang kết nối đánh thức máy chủ AI...");
          try {
            const checkRes = await api.checkBackendAiAvailable();
            if (checkRes && checkRes.available) {
              isBackendAiReady = true;
              setBackendAiAvailable(true);
            }
          } catch (e) {
            console.log("Wake up check failed", e);
          }
        }

        // Fix B1: Nếu backend không có proxy key thì mới yêu cầu key cá nhân
        if (!isBackendAiReady && (!geminiApiKey || !geminiApiKey.trim())) {
          setLoading(false);
          setShowKeyModal(true);
          alert("Vui lòng nhập Google Gemini API Key để sinh phần câu hỏi AI kết hợp!");
          return;
        }

        setLoadingMessage(`📦 Đang trích xuất ${hybridCsvCount} câu hỏi từ kho CSV môn "${subject}"...`);
        const bankRes = await api.getQuestionsList({ subject, limitCount: 150 });
        const allBankQuestions = bankRes.questions || [];

        if (allBankQuestions.length === 0) {
          throw new Error(`Kho câu hỏi của môn "${subject}" chưa có dữ liệu CSV nào để trích xuất!`);
        }

        // Shuffle và lấy hybridCsvCount câu từ CSV
        const shuffledBank = [...allBankQuestions].sort(() => 0.5 - Math.random());
        const selectedCsv = shuffledBank.slice(0, Number(hybridCsvCount));

        setLoadingMessage(`✨ Google Gemini AI đang sáng tạo ${hybridAiCount} câu hỏi mới...`);
        const aiQuestions = await api.generateQuestionsWithAI({
          subject,
          count: Number(hybridAiCount),
          difficulty: hybridAiDifficulty,
          sampleQuestions: allBankQuestions.slice(0, 15),
          // B1: Nếu backend có proxy key thì truyền rỗng để server tự dùng
          apiKey: isBackendAiReady ? "" : geminiApiKey
        });

        if (hybridSaveAiToBank && aiQuestions && aiQuestions.length > 0) {
          setLoadingMessage(`💾 Đang nạp các câu hỏi AI vào ngân hàng dữ liệu...`);
          for (const q of aiQuestions) {
            await api.addSingleQuestion(q).catch(err => console.warn("Lỗi nạp câu AI vào kho:", err));
          }
        }

        // Trộn ngẫu nhiên câu từ CSV và câu từ AI
        const combined = [...selectedCsv, ...aiQuestions].sort(() => 0.5 - Math.random());

        setLoadingMessage(`🚀 Đang xuất bản đề thi kết hợp Hybrid (${combined.length} câu)...`);
        const generatedExam = await api.generateExam({
          title: title.trim() || `Đề thi kết hợp (CSV + AI) - ${subject}`,
          subject: subject,
          durationMinutes: Number(durationMinutes) || 15,
          startTime: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
          endTime: endTime ? new Date(endTime).toISOString() : null,
          numQuestions: combined.length,
          preselectedQuestions: combined
        });

        setExam(generatedExam);
      }
    } catch (error) {
      console.error("Lỗi khi tạo đề:", error);
      alert("Lỗi khi sinh đề thi: " + error.message);
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  // Copy mã đề để gửi cho sinh viên
  const handleCopyCode = () => {
    if (!exam?.exam_code) return;
    navigator.clipboard.writeText(exam.exam_code);
    setCopyStatus("✅ Đã copy mã đề vào Clipboard!");
    setTimeout(() => setCopyStatus(""), 3000);
  };

  // In đề thi
  const handlePrint = () => {
    window.print();
  };

  const subjectList = Object.keys(bankStats.bySubject || {});

  return (
    <div className="glass-panel" style={{ marginBottom: "30px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "15px" }}>
        <div>
          <h2 style={{ margin: "0 0 5px 0", color: "#2c3e50" }}>
            ⚙️ 2. Sinh Đề Thi Thông Minh (Smart Exam Matrix)
          </h2>
          <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>
            Rút trích câu hỏi từ Ngân hàng đề, cấu hình ma trận độ khó linh hoạt (10 đến 100 câu)
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            onClick={() => {
              setTempKeyInput(geminiApiKey);
              setShowKeyModal(true);
            }}
            style={{
              background: geminiApiKey ? "rgba(46, 204, 113, 0.15)" : "rgba(230, 126, 34, 0.15)",
              color: geminiApiKey ? "#27ae60" : "#d35400",
              border: geminiApiKey ? "1px solid #2ecc71" : "1px solid #e67e22",
              padding: "4px 12px",
              borderRadius: "15px",
              fontSize: "12px",
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px"
            }}
            title="Cài đặt Google Gemini API Key để sinh đề bằng AI"
          >
            {geminiApiKey ? "🟢 Gemini AI: Sẵn sàng" : "🔑 Cài đặt Gemini AI Key"}
          </button>
          <span style={{ 
            background: "rgba(255, 143, 171, 0.2)", 
            color: "#d81b60", 
            padding: "4px 12px", 
            borderRadius: "15px", 
            fontSize: "12px", 
            fontWeight: "bold" 
          }}>
            🎓 Teacher Only
          </span>
        </div>
      </div>

      {/* Form Cấu hình Đề Thi */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px" }}>
        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#444", marginBottom: "4px" }}>
            Tiêu đề đề thi:
          </label>
          <input 
            type="text"
            className="input-field"
            placeholder="VD: Kiểm tra giữa kỳ - Đề 101"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#444", marginBottom: "4px" }}>
            Môn học:
          </label>
          {subjectList.length > 0 ? (
            <select
              className="input-field"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{ width: "100%", fontSize: "14px" }}
            >
              {subjectList.map(subj => (
                <option key={subj} value={subj}>
                  {subj} ({bankStats.bySubject[subj]?.total || 0} câu)
                </option>
              ))}
            </select>
          ) : (
            // Fix C: Warning banner thay vì input rỗng
            <div style={{
              background: "rgba(230, 126, 34, 0.1)",
              border: "1px solid #e67e22",
              borderRadius: "8px",
              padding: "12px 14px",
              fontSize: "13px",
              color: "#d35400"
            }}>
              ⚠️ Kho câu hỏi hiện chưa có môn học nào.
              <br />
              <span style={{ fontWeight: "600" }}>Hãy vào Tab «📚 1. Ngân Hàng Câu Hỏi» để upload file CSV trước!</span>
            </div>
          )}

          {/* Badge hiển thị tài nguyên sẵn có trong kho */}
          {subjectList.length > 0 && (
            <div style={{ 
              marginTop: "6px", 
              fontSize: "12px", 
              color: "#555",
              background: "rgba(255,255,255,0.7)",
              padding: "4px 8px",
              borderRadius: "6px"
            }}>
              📦 Kho môn này hiện có: <strong>{currentSubjInfo.total || 0}</strong> câu 
              (🟢 {currentSubjInfo.Easy || 0} Dễ • 🟡 {currentSubjInfo.Medium || 0} TB • 🔴 {currentSubjInfo.Hard || 0} Khó)
            </div>
          )}
        </div>

        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#444", marginBottom: "4px" }}>
            Thời gian làm bài (Phút):
          </label>
          <input 
            type="number"
            className="input-field"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#444", marginBottom: "4px" }}>
            🕒 Thời gian mở đề (Bắt đầu):
          </label>
          <input 
            type="datetime-local"
            className="input-field"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ gridColumn: "span 2" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#444", marginBottom: "4px" }}>
            ⏳ Thời gian đóng đề (Hạn nộp bài):
          </label>
          <input 
            type="datetime-local"
            className="input-field"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

      </div>

      {/* CHỌN PHƯƠNG THỨC SINH ĐỀ (3 CHẾ ĐỘ RÕ RÀNG) */}
      <div style={{ marginBottom: "22px" }}>
        <label style={{ display: "block", fontSize: "14px", fontWeight: "bold", color: "#2c3e50", marginBottom: "10px" }}>
          🎯 Chọn Phương Thức Sinh Đề Thi:
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
          {/* Chế độ 1: 100% Kho CSV */}
          <div 
            onClick={() => setExamMode("bank")}
            style={{
              border: examMode === "bank" ? "2px solid #ff5c8a" : "1px solid #e0e0e0",
              background: examMode === "bank" ? "rgba(255, 92, 138, 0.08)" : "#fff",
              borderRadius: "10px",
              padding: "14px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: examMode === "bank" ? "0 4px 12px rgba(255,92,138,0.15)" : "none"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontSize: "18px" }}>📦</span>
              <strong style={{ fontSize: "14px", color: examMode === "bank" ? "#d81b60" : "#2c3e50" }}>
                1. 100% Từ Kho CSV
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "#666", lineHeight: "1.4" }}>
              Lấy các câu hỏi đã nạp sẵn từ file CSV, phân chia theo ma trận độ khó (Dễ / TB / Khó).
            </p>
          </div>

          {/* Chế độ 2: 100% AI Sáng Tạo Mới */}
          <div 
            onClick={() => setExamMode("ai")}
            style={{
              border: examMode === "ai" ? "2px solid #8e44ad" : "1px solid #e0e0e0",
              background: examMode === "ai" ? "rgba(142, 68, 173, 0.08)" : "#fff",
              borderRadius: "10px",
              padding: "14px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: examMode === "ai" ? "0 4px 12px rgba(142,68,173,0.15)" : "none"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontSize: "18px" }}>✨</span>
              <strong style={{ fontSize: "14px", color: examMode === "ai" ? "#8e44ad" : "#2c3e50" }}>
                2. 100% AI Sáng Tạo Mới
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "#666", lineHeight: "1.4" }}>
              Google Gemini AI đọc kiến thức CSV và tự động sinh đề thi mới hoàn toàn (Không trùng lặp).
            </p>
          </div>

          {/* Chế độ 3: Trộn Cả Hai (Hybrid) */}
          <div 
            onClick={() => setExamMode("hybrid")}
            style={{
              border: examMode === "hybrid" ? "2px solid #2980b9" : "1px solid #e0e0e0",
              background: examMode === "hybrid" ? "rgba(41, 128, 185, 0.08)" : "#fff",
              borderRadius: "10px",
              padding: "14px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: examMode === "hybrid" ? "0 4px 12px rgba(41,128,185,0.15)" : "none"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontSize: "18px" }}>🔀</span>
              <strong style={{ fontSize: "14px", color: examMode === "hybrid" ? "#2980b9" : "#2c3e50" }}>
                3. Trộn Cả Hai (Hybrid Mix)
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "#666", lineHeight: "1.4" }}>
              Kết hợp linh hoạt: Rút một số câu có sẵn trong CSV + AI sinh thêm số câu còn lại.
            </p>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* GIAO DIỆN CẤU HÌNH CHO CHẾ ĐỘ 1: 100% TỪ KHO CSV         */}
      {/* ======================================================== */}
      {examMode === "bank" && (
        <div style={{ background: "rgba(255,255,255,0.85)", padding: "18px", borderRadius: "10px", marginBottom: "20px", border: "1px solid rgba(255,92,138,0.2)" }}>
          <div style={{ marginBottom: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <span style={{ fontWeight: "600", fontSize: "14px", color: "#d81b60" }}>
                📦 Cấu hình rút trích từ kho CSV:
              </span>
            </div>
            <div style={{ display: "flex", gap: "15px" }}>
              <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                <input 
                  type="radio" 
                  name="bank_mode" 
                  checked={useMatrix} 
                  onChange={() => setUseMatrix(true)} 
                />
                <strong>🎯 Theo ma trận độ khó</strong>
              </label>
              <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                <input 
                  type="radio" 
                  name="bank_mode" 
                  checked={!useMatrix} 
                  onChange={() => setUseMatrix(false)} 
                />
                <strong>🎲 Ngẫu nhiên toàn bộ</strong>
              </label>
            </div>
          </div>

          {/* Preset nhanh */}
          <div style={{ 
            background: "#fff", 
            padding: "8px 12px", 
            borderRadius: "8px", 
            marginBottom: "14px",
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
            border: "1px solid #eee"
          }}>
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#555" }}>⚡ Preset nhanh:</span>
            <button 
              onClick={() => applyPreset(10, 4, 4, 2)}
              style={{
                background: totalTargetQuestions === 10 ? "#ff5c8a" : "#f8f9fa",
                color: totalTargetQuestions === 10 ? "#fff" : "#333",
                border: "1px solid #ddd",
                padding: "4px 10px",
                borderRadius: "14px",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: "600"
              }}
            >
              10 câu (4 Dễ - 4 TB - 2 Khó)
            </button>
            <button 
              onClick={() => applyPreset(20, 8, 8, 4)}
              style={{
                background: totalTargetQuestions === 20 ? "#ff5c8a" : "#f8f9fa",
                color: totalTargetQuestions === 20 ? "#fff" : "#333",
                border: "1px solid #ddd",
                padding: "4px 10px",
                borderRadius: "14px",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: "600"
              }}
            >
              20 câu (8 Dễ - 8 TB - 4 Khó)
            </button>
            <button 
              onClick={() => applyPreset(50, 25, 15, 10)}
              style={{
                background: totalTargetQuestions === 50 ? "#ff5c8a" : "#f8f9fa",
                color: totalTargetQuestions === 50 ? "#fff" : "#333",
                border: "1px solid #ddd",
                padding: "4px 10px",
                borderRadius: "14px",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: "600"
              }}
            >
              50 câu (25 Dễ - 15 TB - 10 Khó)
            </button>
          </div>

          {useMatrix ? (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "13px", color: "#27ae60", fontWeight: "600" }}>🟢 Số câu Dễ (Easy):</label>
                  <input 
                    type="number" 
                    min="0"
                    className="input-field" 
                    value={easyCount} 
                    onChange={(e) => setEasyCount(e.target.value)}
                    style={{ width: "100%", marginTop: "4px" }} 
                  />
                  <span style={{ fontSize: "11px", color: isOverEasy ? "#c0392b" : "#888" }}>
                    Kho: {currentSubjInfo.Easy || 0} {isOverEasy && "⚠️ Vượt kho"}
                  </span>
                </div>

                <div>
                  <label style={{ fontSize: "13px", color: "#d35400", fontWeight: "600" }}>🟡 Số câu TB (Medium):</label>
                  <input 
                    type="number" 
                    min="0"
                    className="input-field" 
                    value={medCount} 
                    onChange={(e) => setMedCount(e.target.value)}
                    style={{ width: "100%", marginTop: "4px" }} 
                  />
                  <span style={{ fontSize: "11px", color: isOverMed ? "#c0392b" : "#888" }}>
                    Kho: {currentSubjInfo.Medium || 0} {isOverMed && "⚠️ Vượt kho"}
                  </span>
                </div>

                <div>
                  <label style={{ fontSize: "13px", color: "#c0392b", fontWeight: "600" }}>🔴 Số câu Khó (Hard):</label>
                  <input 
                    type="number" 
                    min="0"
                    className="input-field" 
                    value={hardCount} 
                    onChange={(e) => setHardCount(e.target.value)}
                    style={{ width: "100%", marginTop: "4px" }} 
                  />
                  <span style={{ fontSize: "11px", color: isOverHard ? "#c0392b" : "#888" }}>
                    Kho: {currentSubjInfo.Hard || 0} {isOverHard && "⚠️ Vượt kho"}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: "12px", fontSize: "13px", color: "#444" }}>
                Tổng số câu sẽ trích xuất: <strong>{totalMatrixCount} câu</strong>
                {isOverTotal && (
                  <span style={{ color: "#c0392b", marginLeft: "10px", fontWeight: "bold" }}>
                    ⚠️ Vượt số câu trong kho ({currentSubjInfo.total}). Hệ thống sẽ lấy tối đa hiện có.
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <label style={{ fontWeight: "600", fontSize: "13px", color: "#444" }}>Số lượng câu ngẫu nhiên: </label>
              <input 
                type="number" 
                min="1"
                value={numQuestions} 
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                className="input-field"
                style={{ width: "100px" }}
              />
              <span style={{ fontSize: "12px", color: isOverTotal ? "#c0392b" : "#777" }}>
                (Kho có: {currentSubjInfo.total || 0} câu) {isOverTotal && "⚠️ Vượt số câu trong kho"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* GIAO DIỆN CẤU HÌNH CHO CHẾ ĐỘ 2: 100% AI SÁNG TẠO MỚI    */}
      {/* ======================================================== */}
      {examMode === "ai" && (
        <div style={{ background: "rgba(255,255,255,0.85)", padding: "18px", borderRadius: "10px", marginBottom: "20px", border: "1px solid rgba(142,68,173,0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <span style={{ fontSize: "18px" }}>✨</span>
            <span style={{ fontWeight: "bold", fontSize: "14px", color: "#8e44ad" }}>
              Cấu hình Google Gemini AI tạo đề thi mới:
            </span>
          </div>

          <div style={{ 
            background: "rgba(142, 68, 173, 0.08)", 
            padding: "10px 14px", 
            borderRadius: "8px", 
            fontSize: "13px", 
            color: "#5e2777", 
            marginBottom: "14px",
            lineHeight: "1.5"
          }}>
            💡 <strong>Cơ chế Grounding:</strong> Gemini AI sẽ tự động đọc các câu hỏi mẫu từ môn <strong>"{subject}"</strong> trong kho dữ liệu của bạn để hiểu phạm vi kiến thức, sau đó sáng tạo ra bộ câu hỏi mới 100% mà không bị trùng lặp câu chữ.
          </div>

          {!geminiApiKey && (
            <div style={{ 
              background: "rgba(230, 126, 34, 0.12)", 
              border: "1px solid #e67e22", 
              padding: "10px 14px", 
              borderRadius: "8px", 
              fontSize: "13px", 
              color: "#d35400", 
              marginBottom: "14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span>⚠️ Bạn chưa nhập Google Gemini API Key (Miễn phí 100%).</span>
              <button 
                onClick={() => { setTempKeyInput(geminiApiKey); setShowKeyModal(true); }}
                style={{
                  background: "#e67e22",
                  color: "#fff",
                  border: "none",
                  padding: "4px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                🔑 Cài đặt ngay (0đ)
              </button>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#444", marginBottom: "4px" }}>
                Số lượng câu hỏi AI tạo mới:
              </label>
              <input 
                type="number" 
                min="1" 
                max="25" 
                className="input-field" 
                value={aiQuestionCount} 
                onChange={(e) => setAiQuestionCount(Math.min(25, Math.max(1, Number(e.target.value))))}
                style={{ width: "100%" }} 
              />
              <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                {[5, 10, 15, 20].map(cnt => (
                  <button 
                    key={cnt} 
                    type="button" 
                    onClick={() => setAiQuestionCount(cnt)}
                    style={{
                      background: aiQuestionCount === cnt ? "#8e44ad" : "#f1f2f6",
                      color: aiQuestionCount === cnt ? "#fff" : "#333",
                      border: "none",
                      padding: "2px 8px",
                      borderRadius: "10px",
                      fontSize: "11px",
                      cursor: "pointer",
                      fontWeight: "600"
                    }}
                  >
                    {cnt} câu
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#444", marginBottom: "4px" }}>
                Độ khó mục tiêu của câu hỏi AI:
              </label>
              <select 
                className="input-field" 
                value={aiDifficulty} 
                onChange={(e) => setAiDifficulty(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="Easy">🟢 Easy (Cơ bản / Nhận biết)</option>
                <option value="Medium">🟡 Medium (Thông hiểu & Vận dụng)</option>
                <option value="Hard">🔴 Hard (Nâng cao / Vận dụng cao)</option>
              </select>
            </div>
          </div>

          <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "#333" }}>
            <input 
              type="checkbox" 
              checked={saveAiToBank} 
              onChange={(e) => setSaveAiToBank(e.target.checked)} 
            />
            <span>💾 <strong>Lưu các câu hỏi AI này vào Ngân hàng câu hỏi</strong> môn "{subject}" để dùng lại cho các đề sau.</span>
          </label>
        </div>
      )}

      {/* ======================================================== */}
      {/* GIAO DIỆN CẤU HÌNH CHO CHẾ ĐỘ 3: TRỘN CẢ HAI (HYBRID)    */}
      {/* ======================================================== */}
      {examMode === "hybrid" && (
        <div style={{ background: "rgba(255,255,255,0.85)", padding: "18px", borderRadius: "10px", marginBottom: "20px", border: "1px solid rgba(41,128,185,0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <span style={{ fontSize: "18px" }}>🔀</span>
            <span style={{ fontWeight: "bold", fontSize: "14px", color: "#2980b9" }}>
              Cấu hình đề thi kết hợp (Trộn Kho CSV + AI Sinh Mới):
            </span>
          </div>

          <div style={{ 
            background: "rgba(41, 128, 185, 0.08)", 
            padding: "10px 14px", 
            borderRadius: "8px", 
            fontSize: "13px", 
            color: "#1f5f8b", 
            marginBottom: "14px",
            lineHeight: "1.5"
          }}>
            🔀 <strong>Quy trình:</strong> Hệ thống sẽ rút ngẫu nhiên số lượng câu hỏi từ CSV có sẵn trong kho, đồng thời gọi Gemini AI sáng tạo thêm số lượng câu mới, sau đó xáo trộn ngẫu nhiên toàn bộ thành đề thi chuẩn.
          </div>

          {!geminiApiKey && (
            <div style={{ 
              background: "rgba(230, 126, 34, 0.12)", 
              border: "1px solid #e67e22", 
              padding: "10px 14px", 
              borderRadius: "8px", 
              fontSize: "13px", 
              color: "#d35400", 
              marginBottom: "14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span>⚠️ Cần có Gemini API Key để sinh phần câu hỏi AI kết hợp.</span>
              <button 
                onClick={() => { setTempKeyInput(geminiApiKey); setShowKeyModal(true); }}
                style={{
                  background: "#e67e22",
                  color: "#fff",
                  border: "none",
                  padding: "4px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                🔑 Cài đặt ngay (0đ)
              </button>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "14px" }}>
            {/* Cột 1: Rút từ CSV */}
            <div style={{ background: "#fff", padding: "12px", borderRadius: "8px", border: "1px solid #eee" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", color: "#2c3e50", marginBottom: "6px" }}>
                📦 1. Rút từ kho CSV ({subject}):
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input 
                  type="number" 
                  min="1" 
                  max={currentSubjInfo.total || 100}
                  className="input-field" 
                  value={hybridCsvCount} 
                  onChange={(e) => setHybridCsvCount(Math.max(1, Number(e.target.value)))}
                  style={{ width: "90px" }} 
                />
                <span style={{ fontSize: "12px", color: isHybridCsvOver ? "#c0392b" : "#666" }}>
                  câu (Kho có: {currentSubjInfo.total || 0})
                </span>
              </div>
              {isHybridCsvOver && (
                <div style={{ fontSize: "11px", color: "#c0392b", marginTop: "4px" }}>
                  ⚠️ Vượt số câu trong kho!
                </div>
              )}
            </div>

            {/* Cột 2: Sinh từ AI */}
            <div style={{ background: "#fff", padding: "12px", borderRadius: "8px", border: "1px solid #eee" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", color: "#8e44ad", marginBottom: "6px" }}>
                ✨ 2. Google Gemini AI tạo mới:
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <input 
                  type="number" 
                  min="1" 
                  max="20"
                  className="input-field" 
                  value={hybridAiCount} 
                  onChange={(e) => setHybridAiCount(Math.min(20, Math.max(1, Number(e.target.value))))}
                  style={{ width: "90px" }} 
                />
                <span style={{ fontSize: "12px", color: "#666" }}>câu mới</span>
              </div>
              <select 
                className="input-field" 
                value={hybridAiDifficulty} 
                onChange={(e) => setHybridAiDifficulty(e.target.value)}
                style={{ width: "100%", fontSize: "12px" }}
              >
                <option value="Easy">Độ khó AI: Dễ (Easy)</option>
                <option value="Medium">Độ khó AI: Trung bình (Medium)</option>
                <option value="Hard">Độ khó AI: Khó (Hard)</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "13px", color: "#2c3e50" }}>
              Tổng đề thi kết hợp: <strong>{(Number(hybridCsvCount) || 0) + (Number(hybridAiCount) || 0)} câu</strong> 
              {" "}({hybridCsvCount} CSV + {hybridAiCount} AI)
            </span>
          </div>

          <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "#333" }}>
            <input 
              type="checkbox" 
              checked={hybridSaveAiToBank} 
              onChange={(e) => setHybridSaveAiToBank(e.target.checked)} 
            />
            <span>💾 Tự động lưu các câu hỏi AI sinh mới vào Ngân hàng câu hỏi của môn.</span>
          </label>
        </div>
      )}

      {/* NÚT SINH ĐỀ THI ĐA NĂNG */}
      <button 
        onClick={handleGenerateExam} 
        disabled={loading}
        className="btn-primary"
        style={{ 
          padding: "13px 30px", 
          fontSize: "15px", 
          fontWeight: "bold",
          background: 
            examMode === "ai" 
              ? "linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%)" 
              : examMode === "hybrid" 
                ? "linear-gradient(135deg, #2980b9 0%, #3498db 100%)" 
                : undefined,
          boxShadow: 
            examMode === "ai" 
              ? "0 4px 15px rgba(142,68,173,0.3)" 
              : examMode === "hybrid" 
                ? "0 4px 15px rgba(41,128,185,0.3)" 
                : undefined
        }}
      >
        {loading 
          ? (loadingMessage || "⏳ Đang xử lý trên Cloud...") 
          : examMode === "bank" 
            ? `🚀 Sinh Đề Từ Kho CSV (${totalTargetQuestions} câu)`
            : examMode === "ai"
              ? `✨ Yêu Cầu Gemini AI Sinh Đề Mới (${aiQuestionCount} câu)`
              : `🔀 Sinh Đề Kết Hợp Hybrid (${(Number(hybridCsvCount)||0) + (Number(hybridAiCount)||0)} câu)`
        }
      </button>

      {/* Hiển thị kết quả Đề Thi vừa tạo */}
      {exam && (
        <div style={{ marginTop: "30px", background: "#fff", padding: "25px", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #ff8fab", paddingBottom: "15px", marginBottom: "20px" }}>
            <div>
              <h3 style={{ margin: "0 0 5px 0", color: "#d81b60" }}>
                🎉 Đã Sinh Đề Thi Thành Công!
              </h3>
              <div style={{ fontSize: "14px", color: "#555" }}>
                Môn: <strong>{exam.subject}</strong> | Thời lượng: <strong>{exam.duration_minutes} phút</strong> | Số lượng: <strong>{exam.total_questions} câu</strong>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "11px", color: "#888", display: "block" }}>MÃ VÀO THI CỦA SINH VIÊN:</span>
                <span style={{ fontSize: "22px", fontWeight: "bold", color: "#2c3e50", letterSpacing: "2px" }}>
                  {exam.exam_code}
                </span>
              </div>
              <button 
                onClick={handleCopyCode}
                className="btn-primary"
                style={{ padding: "8px 14px", fontSize: "13px" }}
              >
                📋 Copy Mã
              </button>
              <button 
                onClick={handlePrint}
                style={{
                  background: "#4b6584",
                  color: "#fff",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  cursor: "pointer",
                  fontWeight: "600"
                }}
              >
                🖨️ In Đề Thi
              </button>
            </div>
          </div>

          {copyStatus && (
            <div style={{ color: "#2e7d32", fontSize: "13px", fontWeight: "600", marginBottom: "15px" }}>
              {copyStatus}
            </div>
          )}

          {/* Fix A: Hướng dẫn chia sẻ mã + 2 nút hành động */}
          <div style={{
            background: "linear-gradient(135deg, rgba(255,92,138,0.08) 0%, rgba(255,143,171,0.05) 100%)",
            border: "1px solid rgba(255,92,138,0.3)",
            borderRadius: "10px",
            padding: "14px 18px",
            marginBottom: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px"
          }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#d81b60", marginBottom: "4px" }}>
                📢 Gửi mã thi cho sinh viên:
              </div>
              <div style={{ fontSize: "13px", color: "#555" }}>
                Sinh viên truy cập trang web → nhập mã{" "}
                <strong style={{ fontSize: "16px", letterSpacing: "2px", color: "#2c3e50" }}>{exam.exam_code}</strong>{" "}
                để vào phòng thi.
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
              {/* Fix A: Nút Sinh Đề Mới */}
              <button
                onClick={() => setExam(null)}
                style={{
                  background: "rgba(255,255,255,0.9)",
                  color: "#d81b60",
                  border: "2px solid #ff8fab",
                  padding: "9px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                🔄 Sinh Đề Mới
              </button>
              {/* Fix A: Nút chuyển sang Tab Giám Sát */}
              {onNavigateToManager && (
                <button
                  onClick={onNavigateToManager}
                  className="btn-primary"
                  style={{ padding: "9px 16px", fontSize: "13px", fontWeight: "700" }}
                >
                  📊 Xem Danh Sách Đề
                </button>
              )}
            </div>
          </div>

          {/* Danh sách câu hỏi trong đề */}
          <h4 style={{ margin: "0 0 15px 0", color: "#444" }}>
            📋 Chi tiết {exam.questions?.length} câu hỏi trong đề thi:
          </h4>
          {exam.questions?.map((q, index) => {
            const diffColor = 
              q.difficulty === 'Easy' ? '#27ae60' : 
              q.difficulty === 'Medium' ? '#d35400' : '#c0392b';
            const diffBg = 
              q.difficulty === 'Easy' ? 'rgba(39, 174, 96, 0.1)' : 
              q.difficulty === 'Medium' ? 'rgba(211, 84, 0, 0.1)' : 'rgba(192, 57, 43, 0.1)';

            return (
              <div key={q.id || index} className="question-item" style={{ marginBottom: "18px", paddingBottom: "14px", borderBottom: "1px dashed #eee" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <strong style={{ color: "#ff5c8a", fontSize: "15px" }}>Câu {index + 1}:</strong>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    {q.is_ai_generated && (
                      <span style={{ fontSize: "11px", background: "rgba(142, 68, 173, 0.15)", color: "#8e44ad", border: "1px solid #8e44ad", padding: "2px 8px", borderRadius: "10px", fontWeight: "bold" }}>
                        ✨ AI Sáng Tạo Mới
                      </span>
                    )}
                    <span style={{ fontSize: "11px", background: diffBg, color: diffColor, padding: "2px 8px", borderRadius: "10px", fontWeight: "bold" }}>
                      [{q.difficulty || "Medium"}] {q.chapter || ""}
                    </span>
                  </div>
                </div>
                <p style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "500", color: "#2c3e50", whiteSpace: "pre-line" }}>
                  {q.question_text}
                </p>
                
                {/* 4 Lựa chọn A, B, C, D rõ ràng */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", margin: "0 0 10px 0" }}>
                  {q.options?.map((opt, i) => {
                    const label = String.fromCharCode(65 + i); // A, B, C, D
                    const isCorrect = q.correct_answer === label;
                    return (
                      <div 
                        key={i} 
                        style={{ 
                          padding: "6px 10px", 
                          fontSize: "13px", 
                          borderRadius: "6px",
                          background: isCorrect ? "rgba(46, 204, 113, 0.15)" : "#f8f9fa",
                          border: isCorrect ? "1px solid #2ecc71" : "1px solid #eee",
                          color: isCorrect ? "#27ae60" : "#444",
                          fontWeight: isCorrect ? "600" : "normal"
                        }}
                      >
                        <strong>{label}.</strong> {opt}
                      </div>
                    );
                  })}
                </div>

                <div className="correct-ans" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#27ae60" }}>
                  <span>Đáp án chuẩn:</span>
                  <span style={{ 
                    background: "#2ecc71", 
                    color: "#fff", 
                    padding: "2px 8px", 
                    borderRadius: "12px", 
                    fontSize: "12px", 
                    fontWeight: "bold" 
                  }}>
                    {q.correct_answer}
                  </span>
                  {q.explanation && (
                    <span style={{ fontSize: "12px", color: "#666", fontStyle: "italic", marginLeft: "10px" }}>
                      💡 {q.explanation}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL CÀI ĐẶT GOOGLE GEMINI API KEY (100% MIỄN PHÍ)     */}
      {/* ======================================================== */}
      {showKeyModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "20px"
        }}>
          <div style={{
            background: "#fff",
            borderRadius: "14px",
            maxWidth: "540px",
            width: "100%",
            padding: "26px",
            boxShadow: "0 12px 40px rgba(0,0,0,0.25)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h3 style={{ margin: 0, color: "#8e44ad", display: "flex", alignItems: "center", gap: "8px" }}>
                🔑 Cài Đặt Google Gemini API Key
              </h3>
              <button 
                onClick={() => setShowKeyModal(false)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#888" }}
              >
                ✕
              </button>
            </div>

            <div style={{ 
              background: "rgba(46, 204, 113, 0.12)", 
              border: "1px solid #2ecc71", 
              borderRadius: "8px", 
              padding: "12px 14px", 
              marginBottom: "16px",
              fontSize: "13px",
              color: "#227b40",
              lineHeight: "1.5"
            }}>
              🎉 <strong>Hoàn toàn MIỄN PHÍ 100% (Spark Free Tier)</strong><br />
              Google AI Studio cho phép tạo API Key sử dụng ngay <strong>không cần thẻ tín dụng / Visa</strong> (0 VNĐ). Định mức: 15 yêu cầu/phút và 1.500 yêu cầu/ngày.
            </div>

            <p style={{ fontSize: "13px", color: "#444", margin: "0 0 12px 0" }}>
              👉 Lấy API Key miễn phí của bạn tại:{" "}
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noreferrer"
                style={{ color: "#3498db", fontWeight: "bold", textDecoration: "underline" }}
              >
                Google AI Studio (aistudio.google.com/app/apikey) ↗
              </a>
            </p>

            <div style={{ marginBottom: "18px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#333", marginBottom: "6px" }}>
                Dán Gemini API Key của bạn vào đây:
              </label>
              <input 
                type="password"
                className="input-field"
                placeholder="AIzaSy..."
                value={tempKeyInput}
                onChange={(e) => setTempKeyInput(e.target.value)}
                style={{ width: "100%", fontSize: "14px", fontFamily: "monospace" }}
              />
              <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
                🔒 Key được lưu an toàn trong trình duyệt (localStorage) của bạn, không bị chuyển giao ra bên ngoài.
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {geminiApiKey ? (
                <button 
                  onClick={handleClearApiKey}
                  style={{
                    background: "#e74c3c",
                    color: "#fff",
                    border: "none",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    cursor: "pointer",
                    fontWeight: "600"
                  }}
                >
                  🗑️ Xóa Key
                </button>
              ) : <div />}

              <div style={{ display: "flex", gap: "10px" }}>
                <button 
                  onClick={() => setShowKeyModal(false)}
                  style={{
                    background: "#f1f2f6",
                    color: "#333",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    cursor: "pointer"
                  }}
                >
                  Đóng
                </button>
                <button 
                  onClick={handleSaveApiKey}
                  className="btn-primary"
                  style={{
                    padding: "8px 18px",
                    fontSize: "13px",
                    fontWeight: "bold",
                    background: "linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%)"
                  }}
                >
                  💾 Lưu API Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
