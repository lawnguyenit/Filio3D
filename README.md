# ◈ Filio3D — Không gian Phả hệ Nghiên cứu 3D & Tái tổ hợp Tri thức AI

**Filio3D** là hệ thống không gian đồ thị 3D đa tầng hỗ trợ nghiên cứu khoa học: liên kết chuỗi bài báo theo **Phả hệ kế thừa (Lineage)**, biểu diễn trực diện các **Đòn tấn công / Bác bỏ điều kiện (Refutation / Attack)**, tự động phát hiện **Khe hở nghiên cứu (Research Gaps ◇)** khi câu hỏi nghiên cứu cũ bị sai, và tích hợp **Bộ Trung Gian Chuẩn Hóa AI (BYOK)**.

---

## ✨ Tính năng Cốt lõi

1. **🔐 Cổng Khóa Truy Cập Có Thời Hạn (`HMAC-SHA256` Signed Access Gate)**:
   - Chặn tuyệt đối người lạ chưa có mã.
   - Chủ sở hữu có thể tạo mã riêng có hạn sử dụng (đến ngày `YYYY-MM-DD` hoặc vĩnh viễn) cho Thầy hướng dẫn hoặc đồng nghiệp ngay trên giao diện web.
2. **👤 Không gian Nghiên cứu Cô lập theo Từng Người dùng**:
   - Dữ liệu đồ thị 3D của ai chỉ hiển thị cho người đó (`filio3d-v4-workspace::<userId>` + đồng bộ Cloudflare KV).
3. **🌐 Không gian 3D Đa Tầng Thực Thụ (True Volumetric 3D)**:
   - **Tầng Đỉnh ($Y$ cao)**: Các bài báo Tấn công / Bác bỏ phóng mũi tên đỏ xuống bài gốc.
   - **Tầng Giữa (Khối $X-Z$)**: Dòng chảy các bài báo Gốc & Kế thừa.
   - **Tầng Đáy ($Y$ thấp)**: Các Nút Khe Hở Nghiên Cứu (`◇`) và Vấn đề chung (`⬢`).
   - Hỗ trợ xoay 360° Turntable và 5 góc nhìn nhanh (`🧊 Khối 3D`, `👁 Chính diện`, `⬇ Từ đỉnh`, `➡ Cắt ngang`, `↻ Xoay 360°`).
4. **🔑 Gọi AI theo cơ chế BYOK (Ai có API Key người đó dùng)**:
   - Người dùng tự nhập API Key cá nhân (Gemini / OpenAI / Claude API) để gọi AI tự động; người không có API Key vẫn có thể nhập tay hoặc dán văn bản vào **Bộ Trung Gian Chuẩn Hóa**.

---

## 📂 Kiến trúc Mã nguồn Đã Tách Module

Xem chi tiết từng file và từng hàm chức năng tại: **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**

- `src/main.js`: Điểm khởi chạy trung tâm & điều hướng Tab.
- `src/auth/accessGate.js`: Cổng đăng nhập & Trình tạo mã có thời hạn (`HMAC-SHA256`).
- `src/store/workspaceStore.js`: Quản lý dữ liệu tách biệt theo từng `userId` (Local + Cloud KV).
- `src/engine/spatial3DEngine.js`: Bộ máy Không gian 3D Đa tầng, chống đè nút & Camera 360°.
- `src/engine/gapEngine.js`: Bộ máy phát hiện Khe hở nghiên cứu (`◇`).
- `src/views/inspectorView.js`: Ngăn Chi tiết Nút 3D, Sidebar Phả hệ & Popover Câu hỏi.
- `src/views/editorView.js`: Tab Thêm & Sửa Bài báo (Thẻ màu gọn + 4 Sub-tabs phân màu).
- `src/views/aiHubView.js`: Tab AI & Bộ Trung Gian (BYOK).
- `src/views/matrixView.js`: Tab Ma trận & Khe hở (Thẻ phân tầng màu sắc).
- `functions/api/`: Backend Serverless miễn phí trên Cloudflare Pages Functions (`auth.js`, `workspace.js`, `ai-proxy.js`).
