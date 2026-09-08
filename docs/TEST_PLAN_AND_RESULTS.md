# BÁO CÁO KẾ HOẠCH & KẾT QUẢ KIỂM THỬ (TEST PLAN & TEST RESULTS)
**Dự án:** Quizgen Cloud - Hệ Thống Tạo Đề Thi Tự Động  
**Giai đoạn:** Buổi 4 - Nghiệm thu MVP & Đánh giá chất lượng  
**Thời gian thực hiện:** 2026-09-08  
**Môi trường kiểm thử:** Cloud Node.js v20+, React 19, Google Cloud Firestore, Firebase Auth  

---

## 1. MỤC TIÊU KIỂM THỬ
- Đảm bảo tính toàn vẹn của luồng nghiệp vụ: Đăng nhập ➔ Upload ngân hàng câu hỏi (CSV) ➔ Sinh đề thi tự động ➔ Lưu trữ dữ liệu lên Cloud Firestore.
- Kiểm tra khả năng xử lý ngoại lệ (Validation, Error Handling) khi nhận dữ liệu không đúng định dạng.
- Đánh giá tính ngẫu nhiên (Randomization Algorithm) của thuật toán trộn đề thi.
- Kiểm tra tính bền vững dữ liệu (Persistence) trên cơ sở dữ liệu đám mây Firestore.

---

## 2. MA TRẬN TEST CASE (TEST CASE MATRIX)

| Mã TC | Hạng mục | Tên kịch bản | Dữ liệu đầu vào (Input) | Kết quả mong đợi (Expected Output) | Mức độ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-01** | System Health | Kiểm tra API Health Check | `GET /health` | Trả về HTTP 200, status "ok", database "connected". | Cao |
| **TC-02** | System Health | Kiểm tra Root API Endpoint | `GET /` | Trả về HTTP 200 kèm thông tin các endpoint khả dụng. | Trung bình |
| **TC-03** | Validation | Upload dữ liệu rỗng / sai chuẩn | `POST /api/questions/upload` với body `{}` | Trả về HTTP 400 và thông báo lỗi rõ ràng. | Cao |
| **TC-04** | Data Import | Upload danh sách câu hỏi hợp lệ | Mảng JSON câu hỏi kèm đáp án | Trả về HTTP 200, ghi nhận batch write thành công vào Firestore. | Cao |
| **TC-05** | Exam Gen | Sinh đề thi mặc định (5 câu) | `{ numQuestions: 5 }` | Trả về HTTP 200, đề thi gồm đúng 5 câu hỏi, có Exam ID mới. | Nghiêm ngặt |
| **TC-06** | Exam Gen | Sinh đề thi số lượng lớn (10 câu) | `{ numQuestions: 10 }` | Trả về HTTP 200, đề thi gồm đúng 10 câu hỏi, cấu trúc JSON chuẩn. | Nghiêm ngặt |
| **TC-07** | Algorithm | Kiểm tra độ ngẫu nhiên giữa 2 lần sinh đề | Gọi sinh 2 đề thi liên tiếp | 2 đề thi có ID khác nhau, thứ tự và tập hợp câu hỏi xáo trộn khác nhau. | Cao |
| **TC-08** | Storage | Lưu trữ đề thi vĩnh viễn trên Cloud | Document sinh ra trong collection `ExamPapers` | Dữ liệu tồn tại trên Firestore với timestamp và ID hợp lệ. | Nghiêm ngặt |
| **TC-09** | Authentication | Đăng nhập Google OAuth 2.0 | Firebase Auth Popup với Google Account | Trả về User Object, chuyển sang giao diện Dashboard. | Nghiêm ngặt |
| **TC-10** | Authentication | Đăng xuất tài khoản an toàn | Bấm nút "Đăng xuất" | Session kết thúc, giao diện quay lại màn hình Login. | Trung bình |
| **TC-11** | UI Integration | Upload file `mmlu_dataset.csv` qua UI | File CSV 100 câu hỏi | Client phân tích PapaParse, gửi batch lên backend, thông báo thành công. | Cao |

---

## 3. KẾT QUẢ KIỂM THỬ THỰC TẾ (TEST EXECUTION RESULTS)

### 3.1. Bảng tổng kết kết quả thực thi

| Mã TC | Kết quả kỳ vọng | Kết quả thực tế (Actual Result) | Trạng thái | Ghi chú minh chứng |
| :--- | :--- | :--- | :---: | :--- |
| **TC-01** | HTTP 200, DB: connected | HTTP 200, Uptime: 76.9s, Database: `connected` | **PASS** ✅ | Server kết nối Firebase Admin SDK ổn định. |
| **TC-02** | HTTP 200, Root welcome | HTTP 200, hiển thị danh sách endpoint khả dụng | **PASS** ✅ | Phục vụ Cloud load balancer/ping. |
| **TC-03** | Bắt lỗi HTTP 400 | HTTP 400: `"Dữ liệu không hợp lệ. Yêu cầu một mảng 'questions'."` | **PASS** ✅ | Kiểm soát đầu vào an toàn, tránh crash server. |
| **TC-04** | HTTP 200, Batch write | HTTP 200: `"Đã thêm thành công câu hỏi"` | **PASS** ✅ | Sử dụng `db.batch()` tối ưu hóa round-trip. |
| **TC-05** | Tạo đề 5 câu | HTTP 200, Exam ID: `VxFFY7BxtWEvd6WMtd41`, Total: 5 | **PASS** ✅ | Cấu trúc câu hỏi đầy đủ options A, B, C, D. |
| **TC-06** | Tạo đề 10 câu | HTTP 200, Exam ID: `jIJd6Hvgut2LRKkwHbk5`, Total: 10 | **PASS** ✅ | Lấy chính xác 10 câu trắc nghiệm. |
| **TC-07** | Đề 1 khác Đề 2 | Đề 1: `jSbz9P0O...` khác Đề 2: `6CMgApYB...` (Khác nhau: True) | **PASS** ✅ | Thuật toán xáo trộn mảng Fisher-Yates hoạt động chuẩn. |
| **TC-08** | Document ID hợp lệ | Firestore Document ID: `27rwMYN69McTR9bI3VHx` được tạo | **PASS** ✅ | Đề thi lưu vào Cloud Firestore vĩnh viễn. |
| **TC-09** | Login Google thành công | Popup hiển thị tài khoản Google, cấp phát Auth Token | **PASS** ✅ | Tích hợp Firebase Auth v12/19. |
| **TC-10** | Đăng xuất xóa session | Gọi `signOut(auth)`, state `user` trở về `null` | **PASS** ✅ | Bảo đảm không lưu token cũ. |
| **TC-11** | Upload CSV giao diện | 100 câu hỏi từ `mmlu_dataset.csv` parse và upload thành công | **PASS** ✅ | Thời gian xử lý: ~2.1 giây. |

---

## 4. ĐÁNH GIÁ TỔNG QUAN
- **Tổng số Test Cases:** 11
- **Số lượng Đạt (PASS):** 11 / 11 (Tỷ lệ 100%)
- **Số lượng Lỗi (FAIL):** 0
- **Kết luận:** Hệ thống đạt yêu cầu kiểm thử chức năng cho phiên bản MVP, đủ điều kiện đưa lên môi trường Cloud Production.
