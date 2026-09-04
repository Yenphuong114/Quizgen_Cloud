import React, { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "./firebase";

export default function Login({ onLoginSuccess }) {
  const [error, setError] = useState("");

  const handleLogin = async () => {
    try {
      setError("");
      const result = await signInWithPopup(auth, googleProvider);
      if (onLoginSuccess) {
        onLoginSuccess(result.user);
      }
    } catch (err) {
      console.error(err);
      setError("Đăng nhập thất bại. Vui lòng kiểm tra lại cấu hình Firebase.");
    }
  };

  return (
    <div className="glass-panel" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "50px 30px" }}>
      <h2 style={{ fontSize: "28px", marginBottom: "15px" }}>Đăng nhập hệ thống</h2>
      <p style={{ color: "#555", marginBottom: "35px", fontSize: "16px" }}>
        Vui lòng đăng nhập để sử dụng tính năng Upload và Sinh đề thi.
      </p>
      
      <button className="btn-primary" onClick={handleLogin}>
        Đăng nhập bằng Google
      </button>

      {error && (
        <p style={{ color: "#d32f2f", marginTop: "25px", fontSize: "14px", fontWeight: "500" }}>
          {error}
        </p>
      )}
    </div>
  );
}
