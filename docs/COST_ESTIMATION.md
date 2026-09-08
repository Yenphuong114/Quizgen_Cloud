# BÁO CÁO DỰ TOÁN CHI PHÍ ĐÁM MÂY (CLOUD COST ESTIMATION)
**Dự án:** Quizgen Cloud - Hệ Thống Tạo Đề Thi Tự Động  
**Nền tảng mục tiêu:** Google Cloud Platform (Firebase), Vercel & Render  
**Thời gian lập:** 2026-09-08  

---

## 1. NGUYÊN TẮC VÀ MÔ HÌNH TÍNH GIÁ (PRICING MODEL)
Quizgen Cloud được thiết kế theo kiến trúc Serverless & Microservices nhằm tận dụng tối đa mô hình tính phí theo mức sử dụng thực tế (Pay-as-you-go) và hạn mức miễn phí (Free Tier) của các nhà cung cấp dịch vụ đám mây lớn.

### Đơn giá tiêu chuẩn (Google Cloud / Firebase Blaze Plan):
- **Firebase Authentication (Google OAuth):** Miễn phí vĩnh viễn (Unlimited).
- **Cloud Firestore (NoSQL Database):**
  - Đọc (Document Read): **$0.06** / 100,000 lượt.
  - Ghi (Document Write): **$0.18** / 100,000 lượt.
  - Xóa (Document Delete): **$0.02** / 100,000 lượt.
  - Dung lượng lưu trữ (Storage): **$0.18** / GiB / tháng.
- **Compute (Cloud Run / Render Web Service):**
  - vCPU: ~$0.00002400 / vCPU-giây.
  - Memory (RAM): ~$0.00000250 / GiB-giây.
- **Frontend Hosting (Vercel / Firebase Hosting):** Miễn phí 100 GB băng thông / tháng.

---

## 2. HẠN MỨC MIỄN PHÍ HÀNG THÁNG (FREE TIER / SPARK PLAN)

Cả Google Cloud và Vercel/Render đều cung cấp hạn mức miễn phí rất hào phóng cho giai đoạn phát triển và thử nghiệm:

| Dịch vụ đám mây | Hạn mức Miễn phí mỗi ngày | Hạn mức Miễn phí mỗi tháng |
| :--- | :--- | :--- |
| **Cloud Firestore - Reads** | **50,000 lượt đọc / ngày** | **1,500,000 lượt đọc / tháng** |
| **Cloud Firestore - Writes** | **20,000 lượt ghi / ngày** | **600,000 lượt ghi / tháng** |
| **Cloud Firestore - Deletes** | **20,000 lượt xóa / ngày** | **600,000 lượt xóa / tháng** |
| **Cloud Firestore - Storage** | N/A | **1.0 GiB dữ liệu lưu trữ** |
| **Render Web Service** | N/A | **750 giờ chạy miễn phí / tháng** |
| **Vercel Frontend Hosting** | N/A | **100 GB Bandwidth / tháng** |

---

## 3. DỰ TOÁN CHI PHÍ THEO CÁC MỨC QUY MÔ (SCALING SIMULATION)

### 📊 Kịch bản 1: Giai đoạn Thử nghiệm & Đồ án (MVP - Hiện tại)
* **Quy mô:** 50 - 200 người dùng thử nghiệm, ~1,000 lượt tạo đề thi, ~500 câu hỏi trong ngân hàng.
* **Tài nguyên tiêu thụ:**
  * Lượt đọc Firestore: ~100,000 lượt/tháng (< 1.5 triệu hạn mức).
  * Lượt ghi Firestore: ~5,000 lượt/tháng (< 600 nghìn hạn mức).
  * Dung lượng lưu trữ: ~10 MB (< 1 GB hạn mức).
  * Backend Compute: Chạy trên gói Render Free Tier.
* 👉 **TỔNG CHI PHÍ THỰC TẾ: $0.00 USD / tháng (Hoàn toàn Miễn phí 100%)**

---

### 📊 Kịch bản 2: Cấp Trường học (1,000 Sinh viên hoạt động)
* **Quy mô:**
  * 1,000 sinh viên và giáo viên.
  * 20,000 lượt sinh đề thi mỗi tháng.
  * Ngân hàng 5,000 câu hỏi.
* **Chi tiết chi phí:**
  1. **Lượt đọc Firestore:**
     * $20,000 \text{ lượt đề} \times 100 \text{ câu hỏi} = 2,000,000 \text{ reads}$.
     * Vượt hạn mức: $2,000,000 - 1,500,000 = 500,000 \text{ reads}$.
     * Thành tiền: $\frac{500,000}{100,000} \times \$0.06 = \mathbf{\$0.30}$.
  2. **Lượt ghi Firestore:**
     * $20,000 \text{ đề thi} + 5,000 \text{ câu hỏi} = 25,000 \text{ writes}$ (Nằm trọn trong Free Tier) $\rightarrow \mathbf{\$0.00}$.
  3. **Lưu trữ dữ liệu:**
     * ~150 MB (Nằm trong 1 GB Free Tier) $\rightarrow \mathbf{\$0.00}$.
  4. **Backend Server (Render Starter / Cloud Run):**
     * Duy trì server không sleep: $\mathbf{\$7.00 / tháng}$.
* 👉 **TỔNG CHI PHÍ KỊCH BẢN 2: ~$7.30 USD / tháng (Tương đương ~185.000 VNĐ)**

---

### 📊 Kịch bản 3: Cấp Thành phố / Doanh nghiệp lớn (50,000 Sinh viên thi trực tuyến)
* **Quy mô:**
  * 50,000 người dùng đồng thời trong các kỳ thi cao điểm.
  * 500,000 lượt sinh đề thi và làm bài trắc nghiệm.
  * Ngân hàng câu hỏi: 50,000 câu.
* **Chi tiết chi phí:**
  1. **Lượt đọc Firestore (áp dụng kỹ thuật Index Random):**
     * $500,000 \text{ đề} \times 10 \text{ câu} = 5,000,000 \text{ reads}$.
     * Chi phí đọc: $\frac{3,500,000}{100,000} \times \$0.06 = \mathbf{\$2.10}$.
  2. **Lượt ghi Firestore:**
     * $500,000 \text{ đề thi đã tạo} = 500,000 \text{ writes}$.
     * Chi phí ghi: $\mathbf{\$0.90}$.
  3. **Lưu trữ dữ liệu:**
     * ~5 GB dữ liệu = $(5 - 1) \times \$0.18 = \mathbf{\$0.72}$.
  4. **Compute Auto-Scaling (Google Cloud Run):**
     * Tự động co giãn từ 1 instance lên 10 instances trong giờ thi cao điểm: $\mathbf{\$25.00 / tháng}$.
  5. **Băng thông mạng Egress:**
     * ~50 GB truyền tải JSON $\rightarrow \mathbf{\$4.50 / tháng}$.
* 👉 **TỔNG CHI PHÍ KỊCH BẢN 3: ~$33.22 USD / tháng (Tương đương ~830.000 VNĐ)**

---

## 4. CHIẾN LƯỢC TỐI ƯU CHI PHÍ (COST OPTIMIZATION STRATEGY)
1. **Áp dụng Client-side Caching:** Sử dụng IndexedDB hoặc LocalStorage để cache ngân hàng môn học trên trình duyệt của sinh viên, giảm 70% số lượt đọc Firestore không cần thiết.
2. **Kỹ thuật Serverless Scale-to-Zero:** Khi không có kỳ thi (ban đêm), hệ thống tự động tắt toàn bộ container Cloud Run để chi phí CPU về đúng $0.
3. **Vòng đời tài liệu (TTL - Time to Live):** Tự động dọn dẹp các đề thi nháp cũ hơn 60 ngày trên Firestore để duy trì dung lượng lưu trữ luôn dưới hạn mức trả phí.
