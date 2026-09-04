import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./Login";
import QuestionUploader from "./QuestionUploader";
import ExamGenerator from "./ExamGenerator";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
    }
  };

  if (loading) {
    return <div style={{ textAlign: "center", marginTop: "50px", fontSize: "18px", color: "#fff", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>🌸 Đang tải hệ thống...</div>;
  }

  return (
    <div className="app-container">
      <header className="glass-header">
        <div style={{ textAlign: "left" }}>
          <h1 style={{ margin: "0 0 5px 0", color: "#ff5c8a", fontSize: "32px", textShadow: "0 2px 5px rgba(255, 92, 138, 0.2)" }}>
            🌸 QUIZGEN CLOUD
          </h1>
          <p style={{ margin: 0, color: "#666", fontWeight: "500" }}>Hệ thống tạo đề thi trắc nghiệm tự động (MVP Version)</p>
        </div>
        
        {user && (
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "bold", color: "#444" }}>
              Xin chào, {user.displayName || user.email}
            </p>
            <button className="btn-danger" onClick={handleLogout}>
              Đăng xuất
            </button>
          </div>
        )}
      </header>

      <main>
        {!user ? (
          <Login onLoginSuccess={setUser} />
        ) : (
          <>
            <QuestionUploader />
            <ExamGenerator />
          </>
        )}
      </main>
    </div>
  );
}

export default App;