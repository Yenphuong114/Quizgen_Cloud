# ☁️ Quizgen Cloud - Hệ Thống Tạo Đề Thi Tự Động

**Quizgen Cloud** là một hệ thống ứng dụng công nghệ Điện toán đám mây (Cloud Computing) nhằm hỗ trợ việc quản lý ngân hàng câu hỏi và tự động tạo đề thi trắc nghiệm. 

Dự án này được phát triển nhằm tối ưu hóa quy trình tổ chức thi cử và đáp ứng yêu cầu của **Buổi 3 - Build: Phát triển ứng dụng**.

---

## 🎯 Mô tả hệ thống (System Description)
Hệ thống cho phép người dùng đăng nhập an toàn, tải lên ngân hàng câu hỏi môn Khoa học máy tính, từ đó ứng dụng sẽ tự động chọn lọc ngẫu nhiên để kết xuất thành một đề thi hoàn chỉnh. Toàn bộ dữ liệu (tài khoản, câu hỏi, đề thi) và tiến trình đều được xử lý và lưu trữ hoàn toàn trên nền tảng Cloud, đảm bảo tính an toàn, đồng bộ và truy xuất tốc độ cao.

- **Frontend:** Xây dựng bằng React + Vite (Giao diện người dùng tương tác).
- **Backend & Database:** Firebase Authentication (Xác thực người dùng) & Firebase Cloud Firestore (Lưu trữ và truy xuất dữ liệu NoSQL).
- **Dataset:** Sử dụng tập dữ liệu 100 câu hỏi môn Computer Science được trích xuất từ bộ `MMLU` (Hugging Face).

---

## 🔄 Logic đường đi (User Flow & Logic)

Đường đi của dữ liệu và người dùng trong hệ thống tuân theo một luồng (flow) chặt chẽ như sau:

1. **🔒 Xác thực (Login):** Khách truy cập bắt buộc phải xác thực danh tính (Đăng nhập bằng tài khoản Google qua Firebase Auth) để vào hệ thống.
2. **📂 Nhập dữ liệu (Upload):** Người dùng (Giáo viên/Admin) chọn file `mmlu_dataset.csv` từ máy tính để đưa lên.
3. **⚙️ Xử lý trên Cloud (Process):**
   - Hệ thống parse (đọc) file CSV.
   - Thuật toán tự động lấy ngẫu nhiên danh sách câu hỏi để sinh ra một cấu trúc đề thi mới.
4. **💾 Lưu trữ (Storage):** Cấu trúc đề thi vừa được sinh ra sẽ lập tức được đẩy (push) lên Cloud Firestore để lưu trữ vĩnh viễn.
5. **📊 Kết xuất kết quả (Render):** Hệ thống lấy ngược dữ liệu từ Database về và hiển thị danh sách đề thi hoàn chỉnh lên giao diện Dashboard.

> **Sơ đồ luồng:** `Login` ➔ `Upload CSV` ➔ `Submit & Randomize (Thuật toán)` ➔ `Lưu vào Firestore` ➔ `Hiển thị Đề thi`.

---

## 🛠 Hướng dẫn cài đặt và chạy thử

1. Clone repository về máy:
   ```bash
   git clone https://github.com/Yenphuong114/Quizgen_Cloud.git
   ```
2. Cài đặt các thư viện cần thiết:
   ```bash
   npm install
   ```
3. Cấu hình Firebase (tại file `src/firebase.js`): Thay thế thông tin cấu hình bằng Project của bạn. Hãy đảm bảo đã bật **Google Sign-in** trong mục Authentication.
4. Chạy môi trường phát triển:
   ```bash
   npm run dev
   ```
5. Mở trình duyệt và truy cập: `http://localhost:5173`

*(Lưu ý: File dữ liệu mẫu `mmlu_dataset.csv` đã được đính kèm sẵn trong mã nguồn để bạn có thể test trực tiếp tính năng Upload).*

---

## 👩‍💻 Tác giả (Authorship & Copyright)
- **Thiết kế & Phát triển bởi:** Yến Phương (@Yenphuong114)
- **Bản quyền © 2026.** Dự án này là sản phẩm cá nhân được xây dựng cho mục đích nghiên cứu và học tập kiến trúc Cloud Computing. Vui lòng ghi rõ nguồn và không sao chép thương mại nếu chưa có sự đồng ý của tác giả.
