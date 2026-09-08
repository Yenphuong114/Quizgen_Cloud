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

## 🎯 Kiến trúc công nghệ (Cloud Architecture)
- **Frontend:** React 19 + Vite, thiết kế giao diện Glassmorphism hiện đại, xử lý streaming CSV với `PapaParse`.
- **Backend API:** Node.js Express v5, xử lý logic xáo trộn ngẫu nhiên Fisher-Yates, kết nối qua Firebase Admin SDK.
- **Cloud Database:** Google Cloud Firestore (NoSQL) lưu trữ dữ liệu tập trung, hỗ trợ Batch Writes hiệu năng cao.
- **Authentication:** Firebase Authentication (Google OAuth 2.0).

---

## 🔄 Luồng dữ liệu (Data & User Flow)
```
[Google Sign-in] ➔ [Upload mmlu_dataset.csv] ➔ [Batch Ingestion Firestore] ➔ [Cloud Randomize] ➔ [Render Đề thi]
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
   node server.js
   ```
   *(Backend chạy tại `http://localhost:5000`)*

3. **Khởi động Frontend:**
   ```bash
   cd ../Quizgen_Cloud
   npm install
   npm run dev
   ```
   *(Truy cập `http://localhost:5173` để trải nghiệm ứng dụng)*

---

## 👩‍💻 Tác giả & Bản quyền
- **Phát triển bởi:** Yến Phương (@Yenphuong114)
- **Bản quyền © 2026.** Dự án học tập và nghiên cứu kiến trúc Cloud Computing.
