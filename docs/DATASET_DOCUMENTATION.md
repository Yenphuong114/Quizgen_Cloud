# TÀI LIỆU HÓA TẬP DỮ LIỆU (DATASET DOCUMENTATION)
**Dự án:** Quizgen Cloud - Hệ Thống Tạo Đề Thi Tự Động  
**Tên tập dữ liệu:** `mmlu_dataset.csv`  
**Dung lượng:** ~47.2 KB (110 bản ghi câu hỏi)  
**Định dạng:** CSV (Comma-Separated Values, UTF-8 Encoding)  

---

## 1. NGUỒN GỐC DỮ LIỆU (DATA PROVENANCE)
Tập dữ liệu câu hỏi được trích xuất từ bộ benchmark chuẩn quốc tế **MMLU (Massive Multitask Language Understanding)** được xây dựng bởi nhóm nghiên cứu tại Đại học UC Berkeley, Columbia University và Chicago University.

- **Chuyên ngành trích xuất:** Khoa học Máy tính (Computer Science) bao gồm các chủ đề: Kiến trúc máy tính, Hệ điều hành, Mạng máy tính, Điện toán đám mây, Cơ sở dữ liệu và Cấu trúc dữ liệu & Giải thuật.
- **Mục đích sử dụng:** Đóng vai trò làm ngân hàng câu hỏi mẫu phục vụ kiểm thử tính năng Data Import, Batch Write vào Cloud Firestore và kiểm chứng thuật toán sinh đề thi ngẫu nhiên.

---

## 2. CẤU TRÚC VÀ LƯỢC ĐỒ DỮ LIỆU (DATA SCHEMA)

Mỗi dòng trong file CSV đại diện cho một câu hỏi trắc nghiệm hoàn chỉnh với các trường thông tin sau:

| Tên trường (Column) | Kiểu dữ liệu | Bắt buộc | Mô tả nội dung | Ví dụ minh họa |
| :--- | :---: | :---: | :--- | :--- |
| `question_text` | String (Text) | Có | Nội dung đầy đủ của câu hỏi trắc nghiệm | `"Which of the following is a cloud computing service model?"` |
| `optionA` | String | Có | Phương án trả lời A | `"IaaS (Infrastructure as a Service)"` |
| `optionB` | String | Có | Phương án trả lời B | `"Local Hard Drive"` |
| `optionC` | String | Có | Phương án trả lời C | `"USB Flash Storage"` |
| `optionD` | String | Có | Phương án trả lời D | `"Optical Disc"` |
| `correct_answer` | Char(1) | Có | Ký tự đại diện cho phương án đúng (`A`, `B`, `C`, `D`) | `"A"` |
| `subject` *(Tùy chọn)* | String | Không | Tên môn học phân loại (Mặc định: `"Điện toán đám mây"`) | `"Khoa học máy tính"` |
| `chapter` *(Tùy chọn)* | String | Không | Chương kiến thức (Mặc định: `"Chương 1"`) | `"Kiến trúc Cloud"` |
| `difficulty` *(Tùy chọn)* | String | Không | Mức độ khó (`"Easy"`, `"Medium"`, `"Hard"`) | `"Medium"` |

---

## 3. MẪU DỮ LIỆU MINH HỌA (SAMPLE RECORDS)

### 3.1. Dạng thô trong file CSV:
```csv
question_text,optionA,optionB,optionC,optionD,correct_answer
"Find the minimum number of states in a DFA that recognizes the language: {w | w contains an even number of 0s}",1,2,3,4,B
"Which page replacement algorithm suffers from Belady's anomaly?",FIFO,LRU,Optimal,LFU,A
"In cloud architectures, what is the primary benefit of auto-scaling?",Low latency only,Cost efficiency and elasticity,Physical server access,Single point of failure,B
```

### 3.2. Dạng Document NoSQL được lưu trữ trên Cloud Firestore:
```json
{
  "_id": "0Wk89gZ2Lp1qO4x7",
  "subject": "Khoa học máy tính",
  "chapter": "Hệ điều hành",
  "difficulty": "Medium",
  "question_text": "Which page replacement algorithm suffers from Belady's anomaly?",
  "options": [
    "FIFO",
    "LRU",
    "Optimal",
    "LFU"
  ],
  "correct_answer": "A",
  "created_at": "2026-09-08T14:20:19.000Z"
}
```

---

## 4. QUY TRÌNH TIỀN XỬ LÝ DỮ LIỆU TRÊN CLOUD (DATA PIPELINE)
1. **Trích xuất & Đọc (Client-side Streaming):** Thư viện `PapaParse` đọc file CSV từ trình duyệt người dùng mà không cần gửi toàn bộ file vật lý lên server, tiết kiệm băng thông mạng.
2. **Chuẩn hóa (Normalization):** Chuyển đổi 4 cột riêng biệt `optionA`, `optionB`, `optionC`, `optionD` thành một mảng đồng nhất `options: [...]` và loại bỏ các giá trị rỗng/null.
3. **Nạp dữ liệu (Cloud Ingestion):** Gửi gói dữ liệu JSON lên endpoint `/api/questions/upload`. Backend kích hoạt cơ chế `db.batch()` của Firebase Admin SDK để ghi hàng loạt 100+ câu hỏi chỉ trong một transaction mạng duy nhất.
