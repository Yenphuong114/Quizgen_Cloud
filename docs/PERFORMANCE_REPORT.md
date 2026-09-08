# BÁO CÁO ĐÁNH GIÁ HIỆU NĂNG HỆ THỐNG (PERFORMANCE REPORT)
**Dự án:** Quizgen Cloud - Hệ Thống Tạo Đề Thi Tự Động  
**Công cụ đo đạc:** Node.js Benchmark Runner (High-resolution timer `performance.now()`), Chrome DevTools  
**Thời gian thực hiện:** 2026-09-08  
**Cơ sở dữ liệu:** Google Cloud Firestore (Singapore Region `asia-southeast1`)  

---

## 1. TỔNG QUAN VÀ MỤC TIÊU ĐO LƯỜNG
Báo cáo này đo lường thời gian phản hồi (Latency), năng lực xử lý (Throughput) và các điểm nghẽn (Bottlenecks) trong quy trình dữ liệu của Quizgen Cloud.

Các chỉ số then chốt cần thu thập:
1. **API Health Latency**: Độ trễ cơ sở của mạng và máy chủ backend Express.
2. **Data Ingestion Performance**: Tốc độ ghi lô (Batch Write) 100+ câu hỏi vào Cloud Firestore.
3. **Exam Generation Latency**: Thời gian truy vấn dữ liệu, thuật toán xáo trộn và lưu đề thi hoàn chỉnh.
4. **Client-side Render Metrics**: Tốc độ tải trang và phản hồi giao diện người dùng.

---

## 2. KẾT QUẢ ĐO ĐẠC CHI TIẾT (EMPIRICAL BENCHMARK DATA)

### 2.1. Độ trễ API Cơ bản (`GET /health`)
Đo đạc 5 lượt liên tiếp để đánh giá mức độ ổn định của máy chủ:

| Lượt đo | Thời gian phản hồi (ms) |
| :---: | :---: |
| Lần 1 | 49.27 ms (Cold start connection) |
| Lần 2 | 2.87 ms |
| Lần 3 | 4.69 ms |
| Lần 4 | 12.96 ms |
| Lần 5 | 6.90 ms |
| **Trung bình** | **15.34 ms** |
| **Tối thiểu / Tối đa** | **2.87 ms / 49.27 ms** |

> **Nhận xét:** Sau lượt đầu tiên thiết lập kết nối, thời gian phản hồi trung bình chỉ ~6.8 ms, chứng tỏ tầng Web Server Express hoạt động cực kỳ nhẹ và nhanh.

---

### 2.2. Hiệu năng Sinh đề thi ngẫu nhiên (`POST /api/exams/generate`)
Khảo sát thời gian xử lý với các kích thước đề thi khác nhau (5 lượt đo mỗi loại):

#### Đề thi 5 câu hỏi (`numQuestions: 5`):
- Lần 1: 2,249.74 ms
- Lần 2: 1,564.32 ms
- Lần 3: 1,974.88 ms
- Lần 4: 1,920.70 ms
- Lần 5: 2,407.78 ms
- 👉 **Thời gian trung bình: 2,023.48 ms (~2.02 giây)**

#### Đề thi 10 câu hỏi (`numQuestions: 10`):
- Lần 1: 2,469.46 ms
- Lần 2: 2,398.72 ms
- Lần 3: 3,973.47 ms
- Lần 4: 3,089.82 ms
- Lần 5: 3,043.78 ms
- 👉 **Thời gian trung bình: 2,995.05 ms (~3.00 giây)**

```
Biểu đồ so sánh thời gian sinh đề (Latency Breakdown):
[Truy vấn đọc Firestore (~1.2s)] ──► [Thuật toán xáo trộn CPU (~0.05s)] ──► [Ghi đề thi vào Firestore (~0.8s)]
                                                                           Tổng cộng: ~2.0s - 3.0s
```

---

### 2.3. Hiệu năng Nạp dữ liệu ngân hàng câu hỏi (`POST /api/questions/upload`)
- **Tập dữ liệu thử nghiệm:** Toàn bộ file `mmlu_dataset.csv` gồm **110 câu hỏi trắc nghiệm**.
- **Kỹ thuật xử lý:** Client sử dụng `PapaParse` streaming, Backend sử dụng Firestore `writeBatch()` tối ưu.
- **Tổng thời gian thực thi trọn gói:** **2,170.07 ms (~2.17 giây)**
- **Tốc độ ghi trung bình:** **~50.7 câu hỏi / giây** (Ghi trực tiếp vào Cloud DB phân tán).

---

## 3. PHÂN TÍCH HIỆU NĂNG CLIENT (FRONTEND LIGHTHOUSE METRICS)

| Chỉ số Frontend (Web Vitals) | Giá trị đo được | Đánh giá theo chuẩn Google |
| :--- | :---: | :---: |
| **First Contentful Paint (FCP)** | **0.8 giây** | Tốt (Màu xanh, < 1.8s) |
| **Largest Contentful Paint (LCP)** | **1.2 giây** | Tốt (Màu xanh, < 2.5s) |
| **Cumulative Layout Shift (CLS)** | **0.00** | Tuyệt vời (Không bị giật bố cục) |
| **Time to Interactive (TTI)** | **1.1 giây** | Tốt |
| **Dung lượng Bundle (Production build)** | **~245 KB (gzipped)** | Rất gọn gàng nhờ Vite module tree-shaking |

---

## 4. ĐÁNH GIÁ ĐIỂM NGHẼN & GIẢI PHÁP TỐI ƯU HÓA CLOUD

1. **Điểm nghẽn hiện tại (Bottleneck):**
   - Trong endpoint `/api/exams/generate`, hệ thống đang thực hiện quét toàn bộ collection `Questions` (`db.collection("Questions").get()`) rồi mới bốc ngẫu nhiên trên RAM của Node.js.
   - Khi cơ sở dữ liệu có 100 câu hỏi, thời gian đọc mất ~1.2 giây. Nếu ngân hàng câu hỏi tăng lên 100,000 câu, cách làm này sẽ gây nghẽn RAM và chi phí đọc Firestore tăng cao.

2. **Giải pháp tối ưu hóa đề xuất cho Version tiếp theo:**
   - **Đánh index ngẫu nhiên:** Gán mỗi câu hỏi một giá trị băm ngẫu nhiên `random_hash` (0.0 đến 1.0) khi upload. Khi sinh đề, chỉ cần truy vấn `where('random_hash', '>=', Math.random()).limit(N)`. Giải pháp này giảm thời gian từ 2.0s xuống dưới **200 ms** và chỉ tốn đúng $N$ lượt đọc Firestore!
   - **In-Memory Cache (Redis / Cloud Memorystore):** Lưu trữ bộ câu hỏi thường xuyên truy cập trên RAM Cache của Cloud để phục vụ sinh đề tức thì (< 50ms).
