# Folio 3D — Kiến trúc Hệ sinh thái, Phả hệ & Điều kiện Tồn tại Nghiên cứu

## Tầm nhìn cốt lõi

Xây dựng không gian nghiên cứu 3D nơi **Chuỗi suy luận chủ quan** (Câu hỏi & các bước lập luận của nhà nghiên cứu) được tách tầng rõ rệt khỏi **Hệ sinh thái & Phả hệ bài báo khách quan**:

1. **Truy xuất tức thì không cần nhớ chi tiết bài báo**:
   - Khi click vào bất kỳ bài báo nào trên đồ thị 3D hoặc trong chuỗi suy luận, hệ thống hiển thị ngay:
     - **💡 Tri thức cốt lõi (`coreKnowledge`)**: Đóng góp và kết luận trọng tâm của bài báo.
     - **⚖️ Điều kiện tồn tại (`conditions`)**: Các điều kiện cụ thể về *Dữ liệu & Mẫu*, *Môi trường / Miền áp dụng*, *Giả định mô hình*, và *Thước đo* để kết luận của bài báo đó tồn tại và đúng.
     - **⚠️ Điểm gãy & Giới hạn (`limitations`)**: Khi nào bài báo này không còn đúng hoặc bị sụp đổ.
     - **⛓ Chuỗi suy luận nội tại (`internalChain`)**: `Vấn đề → Điều kiện → Phương pháp → Kết luận` có thể **bung trực tiếp ra trong không gian 3D** xung quanh nút bài báo.

2. **Đồ thị Không gian 3D & Mũi tên Tương tác Ngữ nghĩa**:
   - **3 Chế độ Bố cục 3D**:
     - `Phân tầng 3D (Stratified 3D)`:
       - **Tầng trên ($Z+$)**: Chuỗi suy luận của Câu hỏi nghiên cứu (`Bước 1 ➔ Bước 2 ➔ Bước 3...`).
       - **Tầng giữa ($Z_0$)**: Mạng lưới Phả hệ Bài báo & Hệ sinh thái (Trục X = Cụm Hệ sinh thái, Trục Y = Chiều thời gian Phả hệ).
       - **Tầng dưới ($Z-$)**: Các Nút Vấn đề chung (`⬢ Problem Nodes`) và Nút Khe hở nghiên cứu (`◇ Gap Nodes`).
     - `Cây Phả hệ (Genealogy Tree 3D)`: Dàn theo thế hệ kế thừa, phản biện từ bài báo gốc đến các nhánh phát triển.
     - `Hệ sinh thái Lực 3D (3D Force-Directed)`: Mô phỏng vật lý lực 3D tự gom cụm theo độ liên kết ngữ nghĩa.
   - **6 Loại Mũi tên 3D có hướng & hạt chuyển động**:
     - `🧬 Phả hệ / Kế thừa (lineage)`: Tím Indigo, biểu diễn dòng chảy kế thừa theo thời gian.
     - `↗ Hỗ trợ / Ủng hộ (support)`: Xanh ngọc lục bảo, củng cố kết luận hoặc bước suy luận.
     - `⚡ Tương khắc / Mâu thuẫn (conflict)`: Cam hổ phách, mũi tên 2 đầu đối nghịch do khác điều kiện tồn tại.
     - `✕ Bác bỏ / Phản bác (refute)`: Đỏ san hô nét đứt, bác bỏ trực tiếp giả định hoặc kết luận trước đó.
     - `⌑ Ràng buộc Điều kiện (condition)`: Vàng kim, chỉ ra giới hạn phạm vi áp dụng.
     - `◇ Khe hở Nghiên cứu (gap)`: Hồng Neon đứt nét, hội tụ từ các bài báo biên về Nút Khe Hở (`◇`).

3. **Xóa Câu hỏi sai nhưng Giữ nguyên Hệ sinh thái & Tự động Tìm Khe Hở (Research Gap Discovery)**:
   - Khi phát hiện một bước suy luận hoặc cả câu hỏi nghiên cứu bị sai, người dùng có thể bấm **`✕ Câu hỏi này sai → Xóa & Giữ Hệ sinh thái`**.
   - Tầng câu hỏi chủ quan ($Z+$) được gỡ bỏ, nhưng **100% mạng lưới Bài báo, Điều kiện tồn tại, Vấn đề chung và Phả hệ ở tầng dưới vẫn nguyên vẹn**.
   - **Bộ dò Khe hở Lai (Algorithmic + AI Hybrid Gap Finder)** tự động đối chiếu Ma trận Điều kiện tồn tại, các cặp bài báo Tương khắc/Bác bỏ chưa phân xử, và các điểm dừng ở ngọn phả hệ để sinh ra các **Nút Khe Hở (`◇ Gap Nodes`)** ngay trong 3D.
   - Từ bất kỳ Nút Khe Hở nào, người dùng chỉ cần bấm 1 nút để **khởi tạo Câu hỏi nghiên cứu & Chuỗi suy luận mới**.
