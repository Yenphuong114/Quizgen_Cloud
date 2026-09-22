import React, { useState } from "react";
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { api } from "./api";

export default function Login({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState("teacher"); // teacher | student
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Đăng nhập bằng Google
  const handleGoogleLogin = async () => {
    try {
      setError("");
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      
      // Gọi API cập nhật hoặc đồng bộ profile
      try {
        const profileRes = await api.getProfile();
        if (onLoginSuccess) {
          onLoginSuccess(result.user, profileRes.user.role);
        }
      } catch {
        if (onLoginSuccess) onLoginSuccess(result.user, "teacher");
      }
    } catch (err) {
      console.error(err);
      setError("Đăng nhập Google thất bại: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Đăng nhập / Đăng ký bằng Email & Mật khẩu
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Vui lòng điền đầy đủ Email và Mật khẩu.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (isRegister) {
        // Đăng ký tài khoản mới
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (name.trim()) {
          await updateProfile(userCredential.user, { displayName: name.trim() });
        }

        // Đồng bộ vai trò người dùng vào Backend
        try {
          await api.setRole(selectedRole);
        } catch (roleErr) {
          console.warn("Set role notice:", roleErr);
        }

        if (onLoginSuccess) {
          onLoginSuccess(userCredential.user, selectedRole);
        }
      } else {
        // Đăng nhập tài khoản hiện có
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        let userRole = "teacher";
        try {
          const profileRes = await api.getProfile();
          userRole = profileRes.user.role;
        } catch (e) {
          console.warn(e);
        }

        if (onLoginSuccess) {
          onLoginSuccess(userCredential.user, userRole);
        }
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError("Email hoặc Mật khẩu không chính xác.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("Email này đã được đăng ký. Vui lòng chuyển sang Đăng nhập.");
      } else if (err.code === 'auth/weak-password') {
        setError("Mật khẩu quá ngắn (Cần tối thiểu 6 ký tự).");
      } else {
        setError("Lỗi xác thực: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ maxWidth: "480px", margin: "30px auto", padding: "36px 32px" }}>
      <div style={{ textAlign: "center", marginBottom: "25px" }}>
        <div style={{ fontSize: "42px", marginBottom: "10px" }}>🌸</div>
        <h2 style={{ fontSize: "26px", margin: "0 0 8px 0", color: "#ff5c8a" }}>
          {isRegister ? "Đăng Ký Tài Khoản" : "Đăng Nhập Quizgen"}
        </h2>
        <p style={{ color: "#666", fontSize: "14px", margin: 0 }}>
          Hệ thống trắc nghiệm đám mây phân quyền RBAC
        </p>
      </div>

      {/* Tabs chuyển đổi Đăng nhập / Đăng ký */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "22px", background: "rgba(255,255,255,0.6)", padding: "4px", borderRadius: "10px" }}>
        <button
          type="button"
          onClick={() => { setIsRegister(false); setError(""); }}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "none",
            borderRadius: "8px",
            background: !isRegister ? "#ff8fab" : "transparent",
            color: !isRegister ? "#fff" : "#555",
            fontWeight: "bold",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          Đăng Nhập
        </button>
        <button
          type="button"
          onClick={() => { setIsRegister(true); setError(""); }}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "none",
            borderRadius: "8px",
            background: isRegister ? "#ff8fab" : "transparent",
            color: isRegister ? "#fff" : "#555",
            fontWeight: "bold",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          Đăng Ký Mới
        </button>
      </div>

      {/* Chọn vai trò (Role Selection) nếu là đăng ký */}
      {isRegister && (
        <div style={{ marginBottom: "18px" }}>
          <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#444", marginBottom: "8px" }}>
            Chọn vai trò của bạn:
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div
              onClick={() => setSelectedRole("teacher")}
              style={{
                border: selectedRole === "teacher" ? "2px solid #ff5c8a" : "1px solid rgba(0,0,0,0.15)",
                background: selectedRole === "teacher" ? "rgba(255, 143, 171, 0.15)" : "rgba(255,255,255,0.7)",
                borderRadius: "10px",
                padding: "12px 10px",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              <div style={{ fontSize: "22px" }}>🎓</div>
              <div style={{ fontWeight: "bold", fontSize: "14px", color: "#333" }}>Giảng Viên</div>
              <div style={{ fontSize: "11px", color: "#666" }}>Tạo đề & Quản lý câu hỏi</div>
            </div>

            <div
              onClick={() => setSelectedRole("student")}
              style={{
                border: selectedRole === "student" ? "2px solid #ff5c8a" : "1px solid rgba(0,0,0,0.15)",
                background: selectedRole === "student" ? "rgba(255, 143, 171, 0.15)" : "rgba(255,255,255,0.7)",
                borderRadius: "10px",
                padding: "12px 10px",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              <div style={{ fontSize: "22px" }}>🎒</div>
              <div style={{ fontWeight: "bold", fontSize: "14px", color: "#333" }}>Sinh Viên</div>
              <div style={{ fontSize: "11px", color: "#666" }}>Vào phòng thi & Làm bài</div>
            </div>
          </div>
        </div>
      )}

      {/* Form Email / Password */}
      <form onSubmit={handleEmailAuth} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {isRegister && (
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#555", marginBottom: "4px" }}>
              Họ và tên
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="VD: Nguyễn Văn A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
        )}

        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#555", marginBottom: "4px" }}>
            Địa chỉ Email
          </label>
          <input
            type="email"
            className="input-field"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#555", marginBottom: "4px" }}>
            Mật khẩu
          </label>
          <input
            type="password"
            className="input-field"
            placeholder="Tối thiểu 6 ký tự"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%" }}
          />
        </div>

        <button 
          type="submit" 
          className="btn-primary" 
          disabled={loading}
          style={{ width: "100%", marginTop: "8px", padding: "12px", fontSize: "15px" }}
        >
          {loading ? "Đang xử lý..." : (isRegister ? "Đăng Ký Ngay" : "Đăng Nhập")}
        </button>
      </form>

      <div style={{ display: "flex", alignItems: "center", margin: "20px 0", color: "#999", fontSize: "12px" }}>
        <div style={{ flex: 1, height: "1px", background: "rgba(0,0,0,0.1)" }}></div>
        <span style={{ padding: "0 10px" }}>HOẶC</span>
        <div style={{ flex: 1, height: "1px", background: "rgba(0,0,0,0.1)" }}></div>
      </div>

      {/* Nút đăng nhập Google */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.15)",
          padding: "10px 16px",
          borderRadius: "50px",
          cursor: "pointer",
          fontWeight: "600",
          color: "#333",
          boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
          transition: "all 0.2s"
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        Tiếp tục với Google
      </button>

      {error && (
        <div style={{
          marginTop: "18px",
          padding: "10px 14px",
          background: "rgba(235, 77, 75, 0.12)",
          color: "#d63031",
          borderRadius: "8px",
          fontSize: "13px",
          textAlign: "center",
          fontWeight: "500"
        }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
