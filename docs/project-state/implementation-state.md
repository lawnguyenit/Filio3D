# Trạng thái triển khai (Folio 3D v2.0)

Trạng thái: **Đã hoàn thiện kiến trúc Đồ thị Không gian 3D, Chuỗi suy luận, Điều kiện tồn tại của bài báo, Ma trận Điều kiện và Bộ dò Khe hở Nghiên cứu (Hybrid Gap Finder).**

Thư mục gốc: `D:/Project/Freelancer/Test/Research_Notes_App/`

## Các năng lực đã triển khai

1. **Mô hình Tri thức 3 Tầng (`folio-research-v2`)**:
   - **Tầng 1 (`questions` & `reasoningChain`)**: Câu hỏi nghiên cứu kèm chuỗi các bước suy luận (`Bước 1 → Bước 2 → Bước 3...`), trạng thái từng bước (`solid`, `conditional`, `contested`, `broken`), gắn kết trực tiếp với các bài báo ở tầng dưới.
   - **Tầng 2 (`sources` — Bài báo & Điều kiện tồn tại)**: Lưu trữ `coreKnowledge` (Tri thức cốt lõi), `conditions` (Điều kiện tồn tại theo Dữ liệu, Môi trường, Giả định, Thước đo), `limitations` (Điểm gãy khi bài báo sụp đổ), và `internalChain` (Chuỗi suy luận nội tại 4 bước của bài báo có thể bung ra trong 3D).
   - **Tầng 3 (`ecosystems`, `problems`, `relations`)**: Các cụm Hệ sinh thái, Nút Vấn đề chung và 6 loại mũi tên tương tác ngữ nghĩa (`lineage`, `support`, `conflict`, `refute`, `condition`, `gap`).

2. **Engine Đồ thị Không gian 3D (`app.js`)**:
   - Hỗ trợ 3 chế độ bố cục 3D: **Phân tầng 3D (`stratified`)**, **Cây Phả hệ (`lineage`)**, và **Hệ sinh thái Lực 3D (`force`)**.
   - Mũi tên cong Bézier 3D có hướng, hạt chuyển động dọc theo chiều suy luận/phả hệ, mũi tên 2 đầu cho sự tương khắc (`conflict`), và hình khối 3D riêng biệt cho từng loại nút.
   - Cho phép click đúp vào Bài báo (hoặc bấm nút) để **bung chuỗi suy luận con** của bài báo ngay trong không gian 3D.
   - Cho phép nối mũi tên tương tác trực tiếp giữa các bài báo trên đồ thị 3D.

3. **Xóa Câu hỏi sai & Dò Khe hở Nghiên cứu (Research Gap Finder)**:
   - Xóa câu hỏi sai chỉ gỡ bỏ tầng câu hỏi chủ quan ($Z+$), giữ nguyên 100% hệ sinh thái bài báo và phả hệ ở tầng dưới.
   - Tự động phát hiện các **Nút Khe Hở (`◇ Gap Nodes`)** từ các cặp bài báo tương khắc chưa phân xử và các điểm dừng giới hạn ở ngọn phả hệ.
   - Hỗ trợ 1-click **Biến Khe hở thành Câu hỏi & Chuỗi suy luận mới**.
   - Tab **Ma trận Điều kiện & Khe hở** đối chiếu trực quan điều kiện tồn tại của toàn bộ bài báo.

4. **Chạy linh hoạt trên cả Web App & Edge Sidebar**:
   - Mở trực tiếp `index.html` trên trình duyệt, hoặc chạy `node server.js` / `.\Start-Gemini.ps1` để mở tại `http://127.0.0.1:43127`, hoặc nạp làm tiện ích mở rộng Edge Sidebar.
