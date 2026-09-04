// File: download_mmlu.js
import fs from "fs";
import https from "https";

// Sử dụng API mở của Hugging Face để lấy 100 câu hỏi môn Khoa học máy tính
const url = "https://datasets-server.huggingface.co/rows?dataset=cais%2Fmmlu&config=college_computer_science&split=test&offset=0&length=100";

console.log("⏳ Đang kết nối tới Hugging Face (MMLU Dataset)...");

https.get(url, (res) => {
    let data = "";
    res.on("data", (chunk) => { data += chunk; });

    res.on("end", () => {
        console.log("✅ Tải dữ liệu thành công, đang chuyển đổi sang định dạng CSV...");
        const json = JSON.parse(data);
        
        // Tạo dòng tiêu đề cho file CSV (Khớp với Code React của bạn)
        let csvContent = "subject,chapter,difficulty,question_text,optionA,optionB,optionC,optionD,correct_answer\n";
        
        const answerMap = { 0: "A", 1: "B", 2: "C", 3: "D" };

        json.rows.forEach(item => {
            const row = item.row;
            // Xử lý loại bỏ dấu phẩy, dấu ngoặc kép trong câu hỏi để không làm lỗi file CSV
            const cleanText = (text) => `"${String(text).replace(/"/g, '""')}"`;

            const subject = "Khoa học máy tính (MMLU)";
            const chapter = "Đề chuẩn quốc tế";
            const difficulty = "Hard"; // Câu hỏi đại học là mức khó
            const question = cleanText(row.question);
            const optA = cleanText(row.choices[0]);
            const optB = cleanText(row.choices[1]);
            const optC = cleanText(row.choices[2]);
            const optD = cleanText(row.choices[3]);
            const answer = answerMap[row.answer];

            // Nối thành 1 dòng CSV
            csvContent += `${subject},${chapter},${difficulty},${question},${optA},${optB},${optC},${optD},${answer}\n`;
        });

        // Lưu ra file mmlu_dataset.csv
        fs.writeFileSync("mmlu_dataset.csv", csvContent);
        console.log("🎉 Hoàn tất! Đã lưu 100 câu hỏi vào file mmlu_dataset.csv");
        console.log("➡️ Bây giờ bạn hãy mở web lên và Upload file này vào hệ thống nhé!");
    });
}).on("error", (err) => {
    console.error("❌ Lỗi khi tải dữ liệu: ", err.message);
});