# BÁO CÁO NGHIỆM THU ĐỒ ÁN BUỔI 4: PHÁT TRIỂN ỨNG DỤNG ĐIỆN TOÁN ĐÁM MÂY
## HỆ THỐNG QUẢN LÝ NGÂN HÀNG CÂU HỎI & TẠO ĐỀ THI TRẮC NGHIỆM TỰ ĐỘNG (QUIZGEN CLOUD)

* **Học phần:** Điện toán đám mây (Cloud Computing)
* **Giai đoạn:** Buổi 4 - Nghiệm thu MVP & Đánh giá toàn diện
* **Tác giả:** Yến Phương (@Yenphuong114)
* **Repository GitHub:** [https://github.com/Yenphuong114/Quizgen_Cloud](https://github.com/Yenphuong114/Quizgen_Cloud)
* **Thời gian thực hiện:** 2026-09-08

---

## 📑 BẢNG TỔNG HỢP DANH MỤC SẢN PHẨM NỘP (OUTPUT BUỔI 4 CHECKLIST)

| STT | Yêu cầu đầu ra (Output) | Trạng thái | Minh chứng / Vị trí tài liệu |
| :---: | :--- | :---: | :--- |
| **1** | **Cloud URL** | **Sẵn sàng** | Hướng dẫn & Cấu hình tại [docs/DEPLOYMENT_GUIDE_CLOUD_URL.md](docs/DEPLOYMENT_GUIDE_CLOUD_URL.md) |
| **2** | **MVP hoàn chỉnh** | **Đạt** | Mã nguồn chuẩn hóa React 19 + Express 5 + Firebase Admin SDK |
| **3** | **Test Case** | **Đạt** | 11 kịch bản kiểm thử chi tiết tại [docs/TEST_PLAN_AND_RESULTS.md](docs/TEST_PLAN_AND_RESULTS.md) |
| **4** | **Test Result** | **Đạt** | Tỷ lệ thành công 100% (11/11 Test Cases PASS) |
| **5** | **Performance Result** | **Đạt** | Báo cáo đo lường thực nghiệm tại [docs/PERFORMANCE_REPORT.md](docs/PERFORMANCE_REPORT.md) |
| **6** | **Cost Estimation** | **Đạt** | Mô hình tính phí 3 quy mô (Free Tier, 1K users, 50K users) tại [docs/COST_ESTIMATION.md](docs/COST_ESTIMATION.md) |
| **7** | **Security Consideration** | **Đạt** | Phân tích an ninh & Lộ trình RBAC tại [docs/SECURITY_CONSIDERATION.md](docs/SECURITY_CONSIDERATION.md) |
| **8** | **Screenshot** | **Đạt** | Giao diện đăng nhập, nạp CSV, kết xuất đề thi (Mục 3 của báo cáo) |
| **9** | **Dataset** | **Đạt** | 110 câu hỏi MMLU Computer Science tại `Quizgen_Cloud/mmlu_dataset.csv` |
| **10** | **GitHub** | **Đạt** | Repository đã bảo mật biến môi trường, loại trừ file nhạy cảm |
| **11** | **Draft Report** | **Đạt** | Tài liệu báo cáo hoàn chỉnh (`DRAFT_REPORT.md`) |

---

## CHƯƠNG 1: TỔNG QUAN HỆ THỐNG (SYSTEM OVERVIEW)

### 1.1. Bối cảnh và Đặt vấn đề
Trong hoạt động giáo dục và đào tạo hiện đại, việc quản trị ngân hàng đề thi trắc nghiệm thủ công gặp nhiều bất cập: tốn thời gian soạn đề, thiếu tính ngẫu nhiên khách quan, dễ trùng lặp câu hỏi và khó khăn trong việc chia sẻ tài nguyên dữ liệu giữa các giảng viên. 

**Quizgen Cloud** ra đời nhằm ứng dụng sức mạnh của các dịch vụ **Điện toán đám mây (Cloud Computing)** để giải quyết trọn vẹn bài toán trên: tự động hóa quy trình nạp dữ liệu ngân hàng câu hỏi, sinh đề thi ngẫu nhiên chỉ trong vài giây và lưu trữ vĩnh viễn trên cơ sở dữ liệu đám mây phân tán.

### 1.2. Mục tiêu hệ thống
- Xây dựng giải pháp Cloud Native có khả năng truy cập mọi lúc, mọi nơi qua giao diện Web.
- Tự động hóa quá trình sinh đề thi trắc nghiệm theo thuật toán xáo trộn ngẫu nhiên.
- Đảm bảo an toàn xác thực người dùng thông qua giao thức nhận thực liên kết (Federated Identity - Google OAuth 2.0).
- Tận dụng tối đa mô hình Serverless và Free-tier nhằm tối ưu hóa chi phí vận hành ở mức $0.

---

## CHƯƠNG 2: KIẾN TRÚC CLOUD & LUỒNG DỮ LIỆU (CLOUD ARCHITECTURE & DATA PIPELINE)

### 2.1. Kiến trúc hệ thống 3 tầng phân tán (Decoupled Cloud Architecture)

Hệ thống được thiết kế theo mô hình kiến trúc Microservices phân tách hoàn toàn giữa giao diện, máy chủ xử lý và cơ sở dữ liệu:

```
                  ┌──────────────────────────────────────────────────┐
                  │                 NGƯỜI DÙNG / TRÌNH DUYỆT         │
                  └───────────────┬──────────────────────────────────┘
                                  │ HTTPS (TLS 1.3)
                                  ▼
     ┌─────────────────────────────────────────────────────────────┐
     │                     TẦNG FRONTEND (Vercel Edge)             │
     │  - React 19 + Vite Framework                                │
     │  - Client-side CSV Stream Parsing (PapaParse)               │
     │  - Responsive Glassmorphism Dashboard UI                    │
     └───────────────┬─────────────────────────────┬───────────────┘
                     │                             │
    Google Sign-in   │                             │ Gọi REST API (JSON)
    Popup Auth       │                             │
                     ▼                             ▼
┌──────────────────────────────┐ ┌───────────────────────────────────┐
│     FIREBASE AUTHENTICATION  │ │     TẦNG BACKEND (Render / GCP)   │
│ - Google OAuth 2.0 Token     │ │ - Node.js Express Server          │
│ - Quản lý phiên đăng nhập    │ │ - Thuật toán Fisher-Yates Shuffle │
└──────────────────────────────┘ │ - Firebase Admin SDK Service      │
                                 └─────────────────┬─────────────────┘
                                                   │
                                                   │ Batch Write & Read
                                                   ▼
                                 ┌───────────────────────────────────┐
                                 │     GOOGLE CLOUD FIRESTORE        │
                                 │  - Collection 'Questions'         │
                                 │  - Collection 'ExamPapers'        │
                                 └───────────────────────────────────┘
```

### 2.2. Chi tiết luồng dữ liệu (Data Pipeline)
1. **Xác thực:** Người dùng đăng nhập qua Google OAuth ➔ Firebase cấp phát phiên xác thực an toàn.
2. **Nạp dữ liệu (Import):** Người dùng tải lên file `mmlu_dataset.csv` ➔ Client đọc luồng dữ liệu (Stream parsing) và cấu trúc lại mảng câu hỏi ➔ Gửi mảng JSON tới API `POST /api/questions/upload`.
3. **Ghi phân tán (Cloud Batch Ingestion):** Backend sử dụng `db.batch()` của Firestore để ghi hàng trăm câu hỏi vào Cloud trong một transaction duy nhất.
4. **Sinh đề thi (Cloud Processing):** Người dùng yêu cầu tạo $N$ câu hỏi ➔ Backend truy vấn collection `Questions`, áp dụng thuật toán xáo trộn ngẫu nhiên ➔ Trích xuất $N$ câu và lưu kết quả vào collection `ExamPapers`.
5. **Hiển thị (Rendering):** Client nhận kết quả đề thi kèm Document ID và hiển thị trực quan lên Dashboard.

---

## CHƯƠNG 3: TÍNH NĂNG MVP VÀ MINH CHỨNG VẬN HÀNH (SCREENSHOTS & FEATURES)

### 3.1. Các tính năng cốt lõi (Core Functions)
- **Authentication:** Đăng nhập một chạm bằng Google Popup, bảo mật không lưu mật khẩu thô.
- **CSV Data Import:** Nạp dữ liệu tự động từ file CSV với khả năng chuẩn hóa cấu trúc các phương án A, B, C, D.
- **Random Exam Generator:** Cho phép tùy biến số lượng câu hỏi cần sinh (5 câu, 10 câu, 20 câu...), xáo trộn thứ tự khách quan.
- **Persistent Cloud Storage:** Lưu trữ đề thi vĩnh viễn trên Cloud Firestore để tra cứu và xuất bản.

### 3.2. Mô tả màn hình vận hành (Screenshots Workflow)
* **Màn hình 1: Giao diện Đăng nhập (Authentication Panel)**  
  Giao diện thiết kế theo phong cách Glassmorphism hiện đại, thông báo yêu cầu đăng nhập trước khi sử dụng các dịch vụ Cloud.
* **Màn hình 2: Nạp ngân hàng câu hỏi (Data Ingestion)**  
  Người dùng chọn file `mmlu_dataset.csv`, thanh trạng thái hiển thị: `⏳ Đang đọc file CSV...` ➔ `⏳ Đang đẩy câu hỏi lên Backend API...` ➔ `✅ Thành công! Đã thêm thành công 110 câu hỏi.`
* **Màn hình 3: Sinh đề thi & Kết xuất kết quả (Exam Generation)**  
  Người dùng nhập số lượng (ví dụ: 5 câu), bấm "Tạo Đề Thi Mới", hệ thống hiển thị mã đề Firestore (ví dụ: `VxFFY7BxtWEvd6WMtd41`), danh sách câu hỏi kèm đáp án đúng được làm nổi bật.
* **Màn hình 4: Quản trị Firebase Console**  
  Hiển thị trực quan dữ liệu đã đồng bộ thời gian thực trong 2 collections: `Questions` (chứa ngân hàng câu hỏi) và `ExamPapers` (chứa các đề thi đã tạo).

---

## CHƯƠNG 4: KẾ HOẠCH & KẾT QUẢ KIỂM THỬ (TEST RESULTS)

Hệ thống đã trải qua quy trình kiểm thử tự động (Automated Test Suite) bao gồm 11 kịch bản kiểm thử bao phủ toàn bộ các tầng:

* **TC-01 đến TC-02 (System Health):** Đảm bảo backend phản hồi mã 200 và duy trì kết nối database liên tục. *(Kết quả: PASS)*
* **TC-03 (Validation & Boundary):** Kiểm tra bắt lỗi khi gửi body rỗng hoặc sai chuẩn, server trả về mã lỗi 400 Bad Request kèm giải thích rõ ràng. *(Kết quả: PASS)*
* **TC-04 (Data Ingestion):** Ghi nhận ghi thành công mảng câu hỏi vào Cloud Firestore qua Batch Write. *(Kết quả: PASS)*
* **TC-05 đến TC-06 (Exam Generation):** Sinh thành công đề thi với số lượng 5 câu và 10 câu, cấu trúc dữ liệu đầy đủ nội dung câu hỏi và các phương án. *(Kết quả: PASS)*
* **TC-07 (Randomness Verification):** So sánh tập hợp câu hỏi giữa 2 lần sinh đề liên tiếp, chứng minh thuật toán trộn ngẫu nhiên sinh ra 2 đề thi độc lập, không trùng lặp thứ tự. *(Kết quả: PASS)*
* **TC-08 (Cloud Persistence):** Kiểm tra Document ID tạo mới trong collection `ExamPapers`, đảm bảo đề thi được lưu vĩnh viễn trên cơ sở dữ liệu đám mây. *(Kết quả: PASS)*
* **TC-09 đến TC-11 (Frontend Integration):** Đăng nhập Google, đăng xuất an toàn và upload toàn bộ file `mmlu_dataset.csv` qua giao diện người dùng. *(Kết quả: PASS)*

👉 **Tổng kết:** **11 / 11 Test Cases đạt chuẩn (Tỷ lệ thành công 100%)**. *(Xem chi tiết tại [docs/TEST_PLAN_AND_RESULTS.md](docs/TEST_PLAN_AND_RESULTS.md))*

---

## CHƯƠNG 5: ĐÁNH GIÁ HIỆU NĂNG HỆ THỐNG (PERFORMANCE ANALYSIS)

Đo đạc thực nghiệm trên hệ thống sử dụng bộ hẹn giờ độ phân giải cao `performance.now()` thu được các thông số kỹ thuật:

1. **Độ trễ API Backend cơ bản (`GET /health`):**
   - Trung bình: **15.34 ms** (Thời gian phản hồi ở trạng thái ấm: ~4.6 ms - 6.9 ms).
2. **Hiệu năng sinh đề thi (`POST /api/exams/generate`):**
   - Đề thi 5 câu hỏi: **2,023.48 ms (~2.02 giây)**.
   - Đề thi 10 câu hỏi: **2,995.05 ms (~3.00 giây)**.
3. **Hiệu năng nạp dữ liệu ngân hàng câu hỏi (`POST /api/questions/upload`):**
   - Nạp toàn bộ 110 câu hỏi từ CSV vào Cloud Firestore: **2,170.07 ms (~2.17 giây)**.
   - Tốc độ xử lý tương đương **~50.7 câu hỏi / giây** vào cơ sở dữ liệu phân tán.
4. **Hiệu năng tải trang Web (Lighthouse Web Vitals):**
   - FCP (First Contentful Paint): **0.8 giây**.
   - LCP (Largest Contentful Paint): **1.2 giây**.
   - CLS (Cumulative Layout Shift): **0.00** (Hoàn hảo).

👉 **Kết luận:** Hệ thống có thời gian phản hồi dưới 3 giây đối với các tác vụ nặng trên Cloud, đáp ứng xuất sắc trải nghiệm người dùng tương tác. *(Xem chi tiết tại [docs/PERFORMANCE_REPORT.md](docs/PERFORMANCE_REPORT.md))*

---

## CHƯƠNG 6: DỰ TOÁN CHI PHÍ CLOUD (COST ESTIMATION)

Phân tích chi phí vận hành dựa trên biểu phí chính thức của Google Cloud Platform và các nền tảng PaaS:

* **Mức 1: Giai đoạn Đồ án / MVP thử nghiệm (Quy mô hiện tại):**
  - Tận dụng gói Firebase Spark Plan (50K reads/ngày, 20K writes/ngày) + Render Free Tier + Vercel Edge.
  - **Chi phí hàng tháng: $0.00 USD (Miễn phí 100%).**
* **Mức 2: Cấp Trường học (1,000 Sinh viên hoạt động thường xuyên):**
  - ~2,000,000 lượt đọc Firestore + ~25,000 lượt ghi + Máy chủ Render Starter ($7/tháng).
  - **Tổng chi phí: ~$7.30 USD / tháng (~185.000 VNĐ).**
* **Mức 3: Cấp Thành phố / Doanh nghiệp thi trực tuyến (50,000 Thí sinh cao điểm):**
  - Áp dụng Serverless Container Auto-Scaling (Google Cloud Run) và kỹ thuật Indexing Random.
  - **Tổng chi phí: ~$33.22 USD / tháng (~830.000 VNĐ).**

👉 **Kết luận:** Kiến trúc Serverless giúp Quizgen Cloud đạt mức chi phí tối ưu vượt trội so với các hệ thống máy chủ truyền thống (On-premise hoặc VPS cố định). *(Xem chi tiết tại [docs/COST_ESTIMATION.md](docs/COST_ESTIMATION.md))*

---

## CHƯƠNG 7: ĐÁNH GIÁ AN TOÀN & BẢO MẬT (SECURITY CONSIDERATION)

### 7.1. Hiện trạng an toàn đã đạt được
- Ứng dụng mô hình nhận thực hiện đại **Google OAuth 2.0**, loại bỏ hoàn toàn rủi ro lộ mật khẩu người dùng.
- Toàn bộ lưu lượng mạng được bảo vệ bằng giao thức **HTTPS/TLS 1.3**.
- Khóa bảo mật `serviceAccountKey.json` được đưa vào `.gitignore` và quản lý bảo mật qua biến môi trường hệ thống.

### 7.2. Hạn chế của phiên bản MVP & Lộ trình nâng cấp (Security Roadmap)
- **Hạn chế đã nhận diện:** Hệ thống MVP hiện tại **chưa triển khai phân quyền theo vai trò (Role-Based Access Control - RBAC)**; mọi tài khoản đăng nhập đều có quyền tương đương. Các endpoint Express chưa gắn middleware giải mã `Firebase ID Token`.
- **Lộ trình nâng cấp cho phiên bản tiếp theo:**
  1. Gán vai trò (`admin`, `teacher`, `student`) qua `Firebase Custom Claims`.
  2. Xây dựng Middleware `authenticateToken` trên Express để xác minh chữ ký số Google trên từng request.
  3. Áp dụng bộ quy tắc bảo mật **Firestore Security Rules** chặn truy cập trái phép trực tiếp vào Database.
  4. Tích hợp giải pháp **Rate Limiting** để phòng chống tấn công từ chối dịch vụ (DoS/Brute-force).

*(Xem chi tiết tại [docs/SECURITY_CONSIDERATION.md](docs/SECURITY_CONSIDERATION.md))*

---

## CHƯƠNG 8: TẬP DỮ LIỆU THỬ NGHIỆM (DATASET)

- **Tên tập dữ liệu:** `mmlu_dataset.csv`.
- **Nguồn gốc:** Trích xuất từ tập benchmark **MMLU (Massive Multitask Language Understanding)** của UC Berkeley.
- **Quy mô:** 110 câu hỏi trắc nghiệm chuyên ngành Khoa học Máy tính & Điện toán đám mây.
- **Cấu trúc bản ghi:** Mỗi câu hỏi bao gồm `question_text`, 4 phương án lựa chọn `optionA` - `optionD`, và `correct_answer`.

*(Xem chi tiết tại [docs/DATASET_DOCUMENTATION.md](docs/DATASET_DOCUMENTATION.md))*

---

## CHƯƠNG 9: KẾT LUẬN

Hệ thống **Quizgen Cloud** đã hoàn thành trọn vẹn và xuất sắc các yêu cầu kỹ thuật của **Buổi 4 - Phát triển ứng dụng Điện toán đám mây**:
1. Đã kiểm chứng thành công kiến trúc ứng dụng kết nối đám mây hoàn chỉnh.
2. Vượt qua 100% các ca kiểm thử chức năng và ngoại lệ.
3. Đạt hiệu năng xử lý cao, chi phí vận hành tiệm cận $0 nhờ kiến trúc Cloud Native.
4. Đầy đủ minh chứng, báo cáo số liệu và hướng dẫn triển khai Cloud URL thực tế.
