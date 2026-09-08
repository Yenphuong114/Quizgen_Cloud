# HƯỚNG DẪN TRIỂN KHAI LÊN CLOUD ĐỂ LẤY CLOUD URL
**Dự án:** Quizgen Cloud - Hệ Thống Tạo Đề Thi Tự Động  
**Thời gian hoàn thành dự kiến:** ~5 phút  
**Chi phí:** 0đ (100% Miễn phí vĩnh viễn)  

---

## 🚀 TỔNG QUAN KIẾN TRÚC TRIỂN KHAI

Hệ thống Quizgen Cloud được thiết kế theo mô hình Decoupled Cloud Architecture:
- **Frontend (Giao diện React + Vite):** Triển khai trên **Vercel** (CDN toàn cầu, HTTPS tự động).
- **Backend (Node.js Express API):** Triển khai trên **Render.com** (Web Service chạy Cloud Container có HTTPS).
- **Cơ sở dữ liệu & Xác thực:** Đã sẵn sàng trên **Google Cloud Firebase (Auth & Firestore)**.

---

## 🛠 BƯỚC 1: TRIỂN KHAI BACKEND LÊN RENDER.COM (LẤY BACKEND CLOUD URL)

1. Truy cập [Render.com](https://render.com) và đăng nhập bằng tài khoản **GitHub**.
2. Tại màn hình Dashboard, bấm nút **New +** ở góc phải trên ➔ Chọn **Web Service**.
3. Chọn kho mã nguồn (Repository) của bạn: `Quizgen_Cloud`.
4. Điền các thông số cấu hình:
   - **Name:** `quizgen-cloud-backend` (hoặc tên tùy chọn)
   - **Region:** `Singapore (Southeast Asia)` *(để gần Firestore nhất)*
   - **Branch:** `main` (hoặc `master`)
   - **Root Directory:** `backend` *(Rất quan trọng: nhập đúng `backend`)*
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Chọn gói **Free** ($0/month)
5. **Cấu hình biến môi trường (Environment Variables):**
   - Cuộn xuống mục **Environment Variables**, bấm **Add Environment Variable**:
     - **Key:** `FIREBASE_SERVICE_ACCOUNT`
     - **Value:** Mở file `backend/serviceAccountKey.json` trên máy tính của bạn, sao chép toàn bộ nội dung JSON (từ `{` đến `}`) và dán vào ô này.
6. Bấm nút **Create Web Service**.
7. Chờ khoảng 1-2 phút để Render build xong. Khi thấy thông báo `Live`, bạn sẽ có link **Backend Cloud URL** dạng:
   👉 `https://quizgen-cloud-backend.onrender.com`
   *(Có thể kiểm tra nhanh bằng cách mở `https://quizgen-cloud-backend.onrender.com/health` trên trình duyệt, nếu thấy `status: "ok"` là hoàn hảo!)*

---

## 💻 BƯỚC 2: TRIỂN KHAI FRONTEND LÊN VERCEL (LẤY FRONTEND CLOUD URL)

1. Truy cập [Vercel.com](https://vercel.com) và đăng nhập bằng tài khoản **GitHub**.
2. Tại màn hình Dashboard, bấm **Add New...** ➔ Chọn **Project**.
3. Tìm và bấm nút **Import** cạnh repository `Quizgen_Cloud`.
4. Điền các thông số cấu hình:
   - **Project Name:** `quizgen-cloud`
   - **Framework Preset:** `Vite` (Vercel thường tự nhận diện)
   - **Root Directory:** Bấm nút **Edit** và chọn thư mục `Quizgen_Cloud` *(Rất quan trọng)*
   - **Build and Output Settings:** Giữ mặc định (`npm run build` và `dist`)
5. **Cấu hình biến môi trường (Environment Variables):**
   - Mở rộng mục **Environment Variables**:
     - **Key:** `VITE_API_URL`
     - **Value:** Dán link Backend bạn vừa nhận được ở Bước 1 (Ví dụ: `https://quizgen-cloud-backend.onrender.com`). *(Lưu ý: Không để dấu gạch chéo `/` ở cuối)*
6. Bấm nút **Deploy**.
7. Sau khoảng 45 giây, Vercel sẽ cấp cho bạn đường link **Frontend Cloud URL chính thức** dạng:
   👉 `https://quizgen-cloud.vercel.app` (hoặc domain do Vercel cấp phát).

---

## 🔒 BƯỚC 3: CẤP QUYỀN DOMAIN TRÊN FIREBASE CONSOLE

Để tính năng Đăng nhập Google (Google Sign-In) hoạt động được trên link Cloud mới:
1. Mở [Firebase Console](https://console.firebase.google.com) ➔ Chọn dự án `quizgencloud`.
2. Vào mục **Build** ➔ **Authentication** ➔ Chọn tab **Settings** (Cài đặt).
3. Chọn thẻ **Authorized domains** (Miền được ủy quyền).
4. Bấm nút **Add domain** (Thêm miền) ➔ Dán tên miền Vercel của bạn vào (Ví dụ: `quizgen-cloud.vercel.app`) ➔ Bấm **Add**.

---

## 🏆 KẾT QUẢ ĐẠT ĐƯỢC
Bạn đã có trọn bộ sản phẩm chạy trực tuyến trên Đám mây công cộng (Public Cloud):
- **Frontend Cloud URL (Dành cho Giảng viên & Người dùng chấm điểm):** `https://quizgen-cloud.vercel.app`
- **Backend Cloud API Health Check:** `https://quizgen-cloud-backend.onrender.com/health`
- **Cloud Database:** Google Cloud Firestore (Live sync real-time).
