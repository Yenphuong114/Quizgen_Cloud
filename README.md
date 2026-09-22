# ☁️ Quizgen Cloud - Hệ Thống Tạo Đề Thi Tự Động Trên Nền Tảng Cloud

**Quizgen Cloud** là một giải pháp ứng dụng công nghệ Điện toán đám mây (Cloud Computing) toàn diện nhằm hỗ trợ quản lý ngân hàng câu hỏi và tự động tạo đề thi trắc nghiệm ngẫu nhiên, an toàn và tức thì.

Dự án hoàn thiện theo yêu cầu nghiệm thu của **Buổi 4 - Nghiệm thu MVP & Đánh giá toàn diện sản phẩm**.

---

## 📑 BẢNG DANH MỤC SẢN PHẨM ĐẦU RA BUỔI 4 (OUTPUT CHECKLIST)

| STT | Đầu mục sản phẩm | Trạng thái | Tài liệu chi tiết |
| :---: | :--- | :---: | :--- |
| 🌐 | **Cloud URL** | Sẵn sàng | [Hướng dẫn Deploy lấy Cloud URL](docs/DEPLOYMENT_GUIDE_CLOUD_URL.md) |
| 🚀 | **MVP hoàn chỉnh** | Hoàn thành | React 19 Frontend + Express 5 Backend + Firebase Firestore |
| 🧪 | **Test Case** | Hoàn thành | [Ma trận 11 kịch bản kiểm thử](docs/TEST_PLAN_AND_RESULTS.md) |
| 📊 | **Test Result** | Hoàn thành | 100% Pass (11/11 Test cases) tại [Báo cáo kết quả Test](docs/TEST_PLAN_AND_RESULTS.md) |
| ⚡ | **Performance Result** | Hoàn thành | [Báo cáo Benchmark Hiệu năng thực nghiệm](docs/PERFORMANCE_REPORT.md) |
| 💰 | **Cost Estimation** | Hoàn thành | [Mô hình dự toán chi phí 3 mức quy mô](docs/COST_ESTIMATION.md) |
| 🔒 | **Security Consideration**| Hoàn thành | [Phân tích bảo mật & Lộ trình RBAC](docs/SECURITY_CONSIDERATION.md) |
| 📸 | **Screenshot** | Hoàn thành | Minh chứng quy trình vận hành trong [Draft Report](DRAFT_REPORT.md#chương-3-tính-năng-mvp-và-minh-chứng-vận-hành-screenshots--features) |
| 📁 | **Dataset** | Hoàn thành | [Hồ sơ tập dữ liệu MMLU](docs/DATASET_DOCUMENTATION.md) & file `mmlu_dataset.csv` |
| 🐙 | **GitHub** | Hoàn thành | Repo sạch, bảo mật khóa API, cấu hình `.gitignore` chuẩn |
| 📄 | **Draft Report** | Hoàn thành | **[Bản Báo Cáo Hoàn Chỉnh (DRAFT_REPORT.md)](DRAFT_REPORT.md)** |

---

## 🏗️ Kiến trúc Cloud (Cloud Architecture)

```
┌───────────────────────────────────────────────────────────────────┐
│                 QUIZGEN CLOUD — CLOUD ARCHITECTURE                 │
├─────────────────┬──────────────────────────────┬──────────────────┤
│   CLIENT LAYER  │       CLOUD SERVICES          │  BACKEND LAYER   │
│                 │                               │                  │
│ 🎓 GIẢNG VIÊN  │  ┌─── Firebase Auth ───┐      │ Node.js Express  │
│  Browser        │  │  Google OAuth 2.0    │      │ server.js        │
│  - Upload CSV   │  └──────────────────────┘      │ REST API         │
│  - Sinh đề thi  │                               │ :5000            │
│  - Xem KQ       │  ┌─── Firestore DB ────┐      │                  │
│                 │  │  Questions (kho)     │◄────►│ - Auth Middleware │
│ 🎒 SINH VIÊN   │  │  ExamPapers (đề)    │      │ - RBAC           │
│  Browser        │  │  ExamSubmissions    │      │ - AI Proxy       │
│  - Nhập mã thi  │  │  Users              │      │   (GEMINI KEY)   │
│  - Làm bài      │  └──────────────────────┘      │                  │
│  - Xem điểm     │                               │                  │
│                 │  ┌─── Firebase Host ───┐      │                  │
│                 │  │  quizgencloud        │      │                  │
│                 │  │  .web.app (CDN)      │      │                  │
│                 │  └──────────────────────┘      │                  │
│                 │                               │                  │
│                 │  ┌─── Gemini AI API ───┐      │                  │
│                 │  │  gemini-2.5-flash    │◄────┤ /api/ai/generate  │
│                 │  │  (Cloud AI Service)  │      │ (Backend Proxy)  │
│                 │  └──────────────────────┘      │                  │
└─────────────────┴──────────────────────────────┴──────────────────┘
```

**Cloud Services sử dụng:**
| Thành phần | Dịch vụ Cloud | Vai trò |
|---|---|---|
| Frontend | Firebase Hosting (CDN) | Phân phối giao diện web toàn cầu |
| Database | Google Cloud Firestore | Lưu trữ câu hỏi, đề thi, kết quả |
| Auth | Firebase Authentication | Đăng nhập Google OAuth 2.0 |
| AI | Google Gemini API | Sinh câu hỏi AI (Backend Proxy) |
| Backend | Node.js (Cloud Server) | REST API, RBAC, AI Proxy |

---

## 🔄 Luồng dữ liệu (Data & User Flow)

**Quy trình Giảng viên:**
```
[Đăng nhập Google] → [Upload CSV] → [Chọn Phương thức Sinh Đề]
     ↓ Phương thức 1: 100% Kho CSV (Không cần API Key)
     ↓ Phương thức 2: 100% AI (Dùng Backend Proxy Key / Key cá nhân)
     ↓ Phương thức 3: Kết hợp CSV + AI (Hybrid)
[Đề thi tạo thành công] → [Nhận Mã Thi 6 số] → [Gửi cho Sinh viên]
```

**Quy trình Sinh viên:**
```
[Đăng nhập Google] → [Nhập Mã Thi 6 số] → [Làm bài tự động đếm giờ]
     → [Nộp bài] → [Xem điểm & đáp án ngay lập tức]
     → [Kết quả tự động lưu vào Firestore]
```

---


## 🛠 Hướng dẫn chạy thử nghiệm tại Local

1. **Clone repository:**
   ```bash
   git clone https://github.com/Yenphuong114/Quizgen_Cloud.git
   ```

2. **Khởi động Backend:**
   ```bash
   cd backend
   npm install
   ```
   
   Tạo file `.env` trong thư mục `backend/` (hoặc sao chép từ `.env.example`):
   ```env
   PORT=5000
   # Lấy key miễn phí tại: https://aistudio.google.com/app/apikey
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   
   ```bash
   node server.js
   ```
   *(Backend chạy tại `http://localhost:5000`)*
   
   > 💡 **Lưu ý:** Khi có `GEMINI_API_KEY` trong `.env`, tất cả giảng viên đều dùng được tính năng AI Sinh Đề mà không cần tự nhập key cá nhân.

3. **Khởi động Frontend:**
   ```bash
   cd ../Quizgen_Cloud
   npm install
   npm run dev
   ```
   *(Truy cập `(https://quizgencloud.web.app/)` để trải nghiệm ứng dụng)*

---

## 👩‍💻 Tác giả & Bản quyền
- **Phát triển bởi:** Yến Phương (@Yenphuong114)
- **Bản quyền © 2026.** Dự án học tập và nghiên cứu kiến trúc Cloud Computing.
