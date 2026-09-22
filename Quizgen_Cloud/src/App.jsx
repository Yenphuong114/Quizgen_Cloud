import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import { api } from "./api";
import Login from "./Login";
import QuestionUploader from "./QuestionUploader";
import ExamGenerator from "./ExamGenerator";
import ExamManager from "./ExamManager";
import StudentExamHall from "./StudentExamHall";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-panel" style={{ textAlign: "center", padding: "30px", margin: "20px 0" }}>
          <h3 style={{ color: "#e74c3c" }}>⚠️ Đã xảy ra lỗi hiển thị giao diện</h3>
          <p style={{ color: "#666", fontSize: "14px" }}>
            {this.state.error?.message || "Lỗi không xác định"}
          </p>
          <button 
            className="btn-primary" 
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{ marginTop: "10px" }}
          >
            🔄 Tải Lại Trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("teacher"); // 'teacher' | 'student' | 'admin'
  const [loading, setLoading] = useState(true);
  const [activeTeacherTab, setActiveTeacherTab] = useState("bank"); // 'bank' | 'generator' | 'manager'
  const [switchingRole, setSwitchingRole] = useState(false);

  // Lắng nghe trạng thái Auth từ Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const profile = await api.getProfile();
          setRole(profile.user?.role || "teacher");
        } catch {
          setRole("teacher");
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
    }
  };

  // Tính năng chuyển đổi Role nhanh (Demo Testing Switcher)
  const handleToggleRole = async () => {
    const newRole = role === "teacher" ? "student" : "teacher";
    setSwitchingRole(true);
    try {
      await api.setRole(newRole);
      setRole(newRole);
    } catch (err) {
      console.error("Lỗi chuyển vai trò:", err);
      // Fallback cục bộ
      setRole(newRole);
    } finally {
      setSwitchingRole(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "100px", fontSize: "18px", color: "#fff", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
        🌸 Đang khởi tạo môi trường Cloud & Bảo mật RBAC...
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header Glassmorphic với Phân quyền RBAC */}
      <header className="glass-header">
        <div style={{ textAlign: "left" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ margin: "0", color: "#ff5c8a", fontSize: "28px", textShadow: "0 2px 5px rgba(255, 92, 138, 0.2)" }}>
              🌸 QUIZGEN CLOUD
            </h1>
            <span style={{
              background: "rgba(255, 92, 138, 0.15)",
              color: "#d81b60",
              fontSize: "11px",
              padding: "3px 8px",
              borderRadius: "20px",
              fontWeight: "bold",
              border: "1px solid rgba(255, 92, 138, 0.3)"
            }}>
              v2.0 RBAC
            </span>
          </div>
          <p style={{ margin: "4px 0 0 0", color: "#666", fontSize: "13px", fontWeight: "500" }}>
            Hệ thống Quản lý & Tạo đề thi trắc nghiệm trên Google Cloud
          </p>
        </div>
        
        {user && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#444" }}>
                {user.displayName || user.email}
              </span>
              
              {/* Badge hiển thị Vai trò hiện tại */}
              <span style={{
                background: role === "teacher" ? "#ff8fab" : "#4dabf7",
                color: "#fff",
                padding: "4px 10px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: "bold",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
              }}>
                {role === "teacher" ? "🎓 Giảng Viên" : "🎒 Sinh Viên"}
              </span>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              {/* Nút Demo Switcher phục vụ Hội đồng nghiệm thu kiểm thử */}
              <button 
                onClick={handleToggleRole}
                disabled={switchingRole}
                title="Tính năng phục vụ Hội đồng / Thầy cô chấm đồ án: Chuyển đổi giữa chế độ Giảng viên và Sinh viên trên cùng một tài khoản để kiểm thử"
                style={{
                  background: "rgba(255,255,255,0.9)",
                  border: "1px dashed #ff5c8a",
                  color: "#d81b60",
                  fontSize: "12px",
                  padding: "5px 12px",
                  borderRadius: "50px",
                  cursor: "pointer",
                  fontWeight: "600",
                  transition: "all 0.2s"
                }}
              >
                {switchingRole ? "Đang đổi..." : `🧪 Demo Mode: Đổi sang ${role === "teacher" ? "Sinh Viên" : "Giảng Viên"}`}
              </button>

              <button className="btn-danger" onClick={handleLogout} style={{ padding: "5px 14px", fontSize: "12px" }}>
                Đăng xuất
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main>
        {!user ? (
          <Login onLoginSuccess={(u, r) => { setUser(u); if (r) setRole(r); }} />
        ) : role === "student" ? (
          /* ================= GIAO DIỆN DÀNH CHO SINH VIÊN ================= */
          <StudentExamHall user={user} />
        ) : (
          /* ================= GIAO DIỆN DÀNH CHO GIẢNG VIÊN ================= */
          <>
            {/* Menu chuyển Tab Giảng viên (Đã chuẩn hóa thứ tự quy trình đào tạo) */}
            <div style={{ 
              display: "flex", 
              gap: "10px", 
              marginBottom: "25px", 
              background: "rgba(255,255,255,0.7)", 
              padding: "6px", 
              borderRadius: "14px", 
              backdropFilter: "blur(10px)"
            }}>
              <button
                onClick={() => setActiveTeacherTab("bank")}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  border: "none",
                  borderRadius: "10px",
                  background: activeTeacherTab === "bank" ? "#ff8fab" : "transparent",
                  color: activeTeacherTab === "bank" ? "#fff" : "#555",
                  fontWeight: "bold",
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                📚 1. Ngân Hàng Câu Hỏi
              </button>

              <button
                onClick={() => setActiveTeacherTab("generator")}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  border: "none",
                  borderRadius: "10px",
                  background: activeTeacherTab === "generator" ? "#ff8fab" : "transparent",
                  color: activeTeacherTab === "generator" ? "#fff" : "#555",
                  fontWeight: "bold",
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                ⚙️ 2. Sinh Đề Thông Minh
              </button>

              <button
                onClick={() => setActiveTeacherTab("manager")}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  border: "none",
                  borderRadius: "10px",
                  background: activeTeacherTab === "manager" ? "#ff8fab" : "transparent",
                  color: activeTeacherTab === "manager" ? "#fff" : "#555",
                  fontWeight: "bold",
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                📊 3. Giám Sát & Kết Quả
              </button>
            </div>

            {/* Nội dung Tab Giảng viên theo quy trình chuẩn có ErrorBoundary bảo vệ */}
            <ErrorBoundary>
              {activeTeacherTab === "bank" && <QuestionUploader />}
              {activeTeacherTab === "generator" && (
                <ExamGenerator
                  onNavigateToManager={() => setActiveTeacherTab("manager")}
                />
              )}
              {activeTeacherTab === "manager" && <ExamManager />}
            </ErrorBoundary>
          </>
        )}
      </main>
    </div>
  );
}

export default App;