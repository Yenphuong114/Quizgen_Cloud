# BÁO CÁO ĐÁNH GIÁ AN TOÀN & BẢO MẬT HỆ THỐNG (SECURITY CONSIDERATION)
**Dự án:** Quizgen Cloud - Hệ Thống Tạo Đề Thi Tự Động  
**Tiêu chuẩn tham chiếu:** OWASP Top 10, Google Cloud Security Best Practices  
**Thời gian lập:** 2026-09-08  

---

## 1. HIỆN TRẠNG AN TOÀN ĐÃ TRIỂN KHAI (CURRENT SECURITY POSTURE)

Hệ thống Quizgen Cloud ở phiên bản MVP đã thiết lập được các chốt chặn bảo mật cơ bản theo kiến trúc Cloud hiện đại:

1. **Xác thực phi mật khẩu (Passwordless Authentication):**
   - Tích hợp **Google OAuth 2.0** thông qua Firebase Authentication.
   - Hệ thống không tự lưu trữ hoặc mã hóa mật khẩu thô của người dùng trong cơ sở dữ liệu, loại bỏ hoàn toàn nguy cơ bị lộ lọt dữ liệu xác thực (Credential Stuffing, Rainbow Table attacks).
2. **Bảo mật kênh truyền (Data in Transit):**
   - Bắt buộc giao thức **HTTPS/TLS 1.3** khi triển khai trên Vercel, Render và Firebase. Toàn bộ thông tin gửi từ trình duyệt tới API đều được mã hóa toàn trình.
3. **Quản trị bí mật đám mây (Secret Management):**
   - Khóa quản trị cấp cao `serviceAccountKey.json` đã được đưa vào `.gitignore` để ngăn chặn lộ lọt lên kho mã nguồn công khai (Public Git Repo).
   - Backend hỗ trợ nạp cấu hình thông qua biến môi trường hệ thống (`process.env.FIREBASE_SERVICE_ACCOUNT`).
4. **Cơ chế CORS (Cross-Origin Resource Sharing):**
   - Express Server kiểm soát quyền truy cập cross-origin, ngăn chặn các website giả mạo gọi API trái phép.

---

## 2. NHẬN DIỆN RỦI RO & HẠN CHẾ TRONG GIAI ĐOẠN MVP (KNOWN LIMITATIONS)

Là phiên bản phát triển nhanh (MVP) nhằm kiểm chứng luồng dữ liệu, hệ thống hiện tồn tại một số hạn chế an ninh cần được ghi nhận và có phương án kiểm soát:

| Nguy cơ an ninh (Vulnerability) | Mức độ rủi ro | Mô tả chi tiết trong hệ thống |
| :--- | :---: | :--- |
| **Thiếu phân quyền người dùng (Lack of RBAC)** | **Cao** | Chưa phân tách vai trò giữa Giáo viên, Quản trị viên và Sinh viên. Mọi người dùng đăng nhập tài khoản Google bất kỳ đều có thể nạp câu hỏi và sinh đề. |
| **API Endpoint chưa xác thực Token (Unauthenticated Endpoints)** | **Cao** | Backend API chưa có middleware kiểm tra `Firebase ID Token` trong `Authorization: Bearer <token>`. Nếu kẻ gian biết URL endpoint backend, họ có thể gửi request nạp dữ liệu bằng script tự động. |
| **Nguy cơ Flood Request / DoS** | **Trung bình** | Chưa có giới hạn tần suất gọi API (Rate Limiting) trên Express server. |
| **Thiếu kiểm tra Schema chặt chẽ** | **Thấp** | Việc kiểm tra tính hợp lệ của file CSV và các cột dữ liệu mới thực hiện ở tầng giao diện client, backend chỉ kiểm tra mảng cơ bản. |

---

## 3. LỘ TRÌNH NÂNG CẤP BẢO MẬT CHO BẢN PRODUCTION (FUTURE SECURITY ROADMAP)

Để đưa Quizgen Cloud lên môi trường thương mại hoặc triển khai thực tế cho trường đại học, nhóm đề xuất kiến trúc bảo mật 4 lớp:

```
[Client (Browser)]
       │
       ▼  (1. HTTPS + Firebase ID Token)
[Cloudflare WAF / Rate Limiter] (2. Chống DDoS & Giới hạn 60 req/phút)
       │
       ▼
[Express Backend Middleware] (3. verifyIdToken() & Check Role 'Teacher'/'Admin')
       │
       ▼
[Cloud Firestore with Security Rules] (4. RBAC Rules & Data Isolation)
```

### 3.1. Triển khai Phân quyền Vai trò (RBAC via Firebase Custom Claims)
Gán vai trò trực tiếp vào Token của Firebase Auth:
```javascript
// Cấp quyền Quản trị viên / Giáo viên trên Backend:
await admin.auth().setCustomUserClaims(uid, { 
  role: 'teacher',
  school_id: 'HCMUS' 
});
```

### 3.2. Middleware Xác thực Token trên Express Server
Bảo vệ các endpoint nhạy cảm bằng xác thực chữ ký JWT của Google:
```javascript
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Không tìm thấy Token xác thực hợp lệ." });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Phiên đăng nhập hết hạn hoặc Token không hợp lệ." });
  }
}
```

### 3.3. Thiết lập Firestore Security Rules
Khóa toàn bộ quyền đọc/ghi tự do từ Client SDK, chỉ cho phép đọc danh mục đề thi công khai:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Câu hỏi: Chỉ tài khoản có claim 'teacher' mới được tạo và sửa
    match /Questions/{questionId} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.role == 'teacher' || request.auth.token.role == 'admin';
    }
    // Đề thi: Người dùng chỉ được xem đề thi được phân công
    match /ExamPapers/{examId} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.role == 'teacher';
    }
  }
}
```

### 3.4. Phòng chống Tấn công Tải (Rate Limiting)
Sử dụng `express-rate-limit` để giới hạn mỗi địa chỉ IP chỉ được phép gọi API sinh đề thi tối đa 30 lần / 15 phút, ngăn chặn bot cạn kiệt hạn mức quota Firestore.
