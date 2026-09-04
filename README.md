# Quizgen Cloud - MVP Version

Hệ thống tạo đề thi trắc nghiệm tự động trên nền tảng Điện toán đám mây. Dự án này được phát triển để đáp ứng yêu cầu của **Buổi 3 - Build: Phát triển ứng dụng**.

## 🚀 Các tính năng chính (Core Functions)
- **Authentication**: Người dùng bắt buộc phải đăng nhập (thông qua Google Auth) để sử dụng hệ thống.
- **Data Import**: Upload ngân hàng câu hỏi dưới dạng file `.csv` lên Cloud (Firebase Firestore).
- **Exam Generation**: Thuật toán xử lý trên Cloud giúp lấy ngẫu nhiên danh sách câu hỏi và sinh đề thi tự động.
- **Database Storage**: Lưu trữ đề thi vừa tạo vào Database, đảm bảo có thể xem lại kết quả.

## 🗂 Cấu trúc công nghệ
- **Frontend**: React (khởi tạo bằng Vite)
- **Backend / Database**: Firebase (Auth, Firestore)
- **Dataset**: File dữ liệu `mmlu_dataset.csv` bao gồm 100 câu hỏi môn Khoa học Máy tính trích xuất từ bộ dữ liệu MMLU trên Hugging Face.

## 🛠 Hướng dẫn cài đặt và chạy thử
1. Clone repository về máy.
2. Cài đặt các thư viện cần thiết bằng lệnh:
   ```bash
   npm install
   ```
3. Cấu hình Firebase:
   - Mở file `src/firebase.js`
   - Thay thế cấu hình `firebaseConfig` mẫu bằng thông tin dự án thực tế trên Firebase Console của bạn.
   - Bật phương thức đăng nhập **Google** trong phần Authentication trên Firebase Console.
4. Khởi chạy ứng dụng:
   ```bash
   npm run dev
   ```
5. Mở trình duyệt và truy cập vào đường dẫn cục bộ (thường là `http://localhost:5173`).

## 📥 Dữ liệu mẫu (Dataset)
Bạn có thể sử dụng trực tiếp file `mmlu_dataset.csv` có sẵn trong thư mục gốc của dự án để test tính năng Import.

## 📄 Kiến trúc User Flow
`Login` -> `Nhập dữ liệu (Upload CSV)` -> `Submit` -> `Cloud xử lý (Randomize)` -> `Database lưu` -> `Trả kết quả trên Dashboard`.
