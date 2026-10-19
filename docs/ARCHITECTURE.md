# 📐 Tài liệu Kiến trúc & Bản đồ Mã nguồn `Filio3D`

Tài liệu này giúp bạn định vị tức thì bất kỳ tính năng nào trong dự án mà không bị lạc hướng. Toàn bộ mã nguồn trước đây nằm trong 1 file đơn lẻ (`app.js`) đã được **tách bạch thành kiến trúc ES Modules chuẩn (`src/`)** và **Cloudflare Pages Functions (`functions/api/`)**.

---

## 1. Sơ đồ Cây Thư Mục Toàn Dự Án

```text
Filio3D/
├── index.html                  # Giao diện khung 100vh: Cổng Khóa Truy Cập + 4 Tab chính
├── styles.css                  # Toàn bộ hệ thống CSS, biến màu sắc, phân tầng thẻ & 3D HUD
├── app.js                      # Cầu nối mỏng (import './src/main.js')
├── wrangler.toml               # Cấu hình triển khai miễn phí lên Cloudflare Pages + KV
├── server.js                   # Server chạy cục bộ trên máy cá nhân (Node.js)
├── docs/
│   └── ARCHITECTURE.md         # [Tài liệu này] Bản đồ chi tiết từng file và hàm chức năng
├── src/                        # 🎯 MÃ NGUỒN FRONTEND ĐÃ TÁCH MODULE
│   ├── main.js                 # Điểm khởi chạy trung tâm, điều phối đăng nhập & chuyển Tab
│   ├── config/
│   │   └── constants.js        # Hằng số mũi tên 3D, danh mục điều kiện, cấu hình Cloud LLM
│   ├── utils/
│   │   └── dom.js              # Hàm tiện ích DOM ($, $$), thông báo Toast, escapeHTML
│   ├── data/
│   │   └── defaultState.js     # Bộ dữ liệu mẫu mặc định (3 Phả hệ: Weak Label, RAG, AI Synthesis)
│   ├── auth/
│   │   └── accessGate.js       # Cổng Khóa Truy Cập & Trình tạo Mã có thời hạn (HMAC-SHA256)
│   ├── store/
│   │   └── workspaceStore.js   # Lưu trữ Đồ thị 3D tách biệt theo từng người dùng (Local + Cloud KV)
│   ├── engine/
│   │   ├── gapEngine.js        # Thuật toán tìm Khe hở nghiên cứu (◇) & tạo câu hỏi mới
│   │   └── spatial3DEngine.js  # Bộ máy Không gian 3D Đa tầng (X-Y-Z), lực đẩy & Camera 360°
│   └── views/
│       ├── inspectorView.js    # Ngăn Chi tiết Nút 3D bên phải, Sidebar Phả hệ & Popover Câu hỏi
│       ├── editorView.js       # Tab 2: Danh sách thẻ màu gọn + 4 Sub-tabs sửa bài báo
│       ├── aiHubView.js        # Tab 3: Gọi AI bằng API Key cá nhân (BYOK) + Bộ Trung Gian
│       └── matrixView.js       # Tab 4: Bản đồ Thẻ Phân Tầng Điều Kiện & Khe Hở
└── functions/                  # ☁️ BACKEND TRÊN CLOUDFLARE PAGES FUNCTIONS (MIỄN PHÍ)
    └── api/
        ├── auth.js             # API /api/auth: Xác thực chữ ký số HMAC-SHA256 & hạn sử dụng mã
        ├── workspace.js        # API /api/workspace: Lưu đồ thị riêng của từng userId trên Cloudflare KV
        └── ai-proxy.js         # API /api/ai-proxy: Proxy gọi Claude API bằng Key cá nhân của người dùng
```

---

## 2. Chi tiết Chức năng Từng File (Khi cần Debug / Nâng cấp thì mở file nào?)

### 🔐 A. Phân hệ Đăng nhập & Cấp Mã Có Thời Hạn (`src/auth/accessGate.js` & `functions/api/auth.js`)
- **Nhiệm vụ**:
  - Chặn tuyệt đối 100% người dùng không có mã truy cập (`#accessGateOverlay`).
  - Tạo và kiểm tra chữ ký số `HMAC-SHA256` trên từng mã truy cập theo định dạng:
    `F3D.<userId>.<YYYY-MM-DD|PERMANENT>.<admin|member>.<CHỮ_KÝ_12_KÝ_TỰ>`
- **Các hàm chính trong [`src/auth/accessGate.js`](../src/auth/accessGate.js)**:
  - `generateSignedAccessKey({ userId, expiryDateStr, role })`: Sinh mã bảo mật có ngày hết hạn để bạn gửi cho Thầy hướng dẫn hoặc đồng nghiệp.
  - `verifyAccessKey(rawToken)`: Kiểm tra chữ ký chống giả mạo và kiểm tra xem ngày hiện tại đã vượt quá `expiryDateStr` hay chưa.
  - `enforceAccessGate(onAuthenticated)`: Khóa màn hình cho tới khi nhập đúng mã hợp lệ.
- **Mật khẩu Chủ sở hữu mặc định (Master Secret)**:
  - `FILIO3D-ADMIN-2026` (Khi triển khai lên Cloudflare, bạn có thể đổi qua biến môi trường `MASTER_ADMIN_SECRET`).

---

### 💾 B. Phân hệ Lưu trữ Tách biệt theo Người dùng (`src/store/workspaceStore.js` & `functions/api/workspace.js`)
- **Nhiệm vụ**:
  - Đảm bảo **"Của người nào thì chỉ hiển thị của người đó"**.
  - Mỗi `userId` trên mã đăng nhập được cấp một phân vùng lưu trữ riêng biệt:
    - Trên trình duyệt: `filio3d-v4-workspace::<userId>`
    - Trên đám mây Cloudflare KV: `workspace::<userId>`
  - Lưu trữ tách biệt cả **API Key cá nhân (BYOK)** của từng người dùng (`getUserPersonalApiKey`, `saveUserPersonalApiKey`).
- **Các hàm chính trong [`src/store/workspaceStore.js`](../src/store/workspaceStore.js)**:
  - `initWorkspaceForUser(session)`: Tải đồ thị 3D riêng của người vừa đăng nhập.
  - `saveState()`: Lưu tức thì vào trình duyệt và đồng bộ ngầm lên Cloudflare KV (`/api/workspace`).
  - `exportWorkspaceJson()`: Xuất file `.json` mang tên người dùng để sao lưu lên Google Drive.

---

### 🌐 C. Bộ máy Không gian 3D Đa Tầng & Camera (`src/engine/spatial3DEngine.js`)
- **Nhiệm vụ**:
  - Tính toán tọa độ 3 chiều thực thụ ($X, Y, Z$) cho từng nút:
    - **Tầng Đỉnh ($Y < 0$)**: Các bài báo **Tấn công / Bác bỏ (`isAttacker`)**.
    - **Tầng Giữa ($Y \approx 0$)**: Chuỗi bài báo **Gốc & Kế thừa** trải theo chiều ngang $X$ và chiều sâu $Z$.
    - **Tầng Đáy ($Y > 0$)**: Các **Nút Khe Hở Nghiên Cứu (`◇`)** và **Vấn đề chung (`⬢`)**.
- **Các hàm chính trong [`src/engine/spatial3DEngine.js`](../src/engine/spatial3DEngine.js)**:
  - `buildSceneGraph()`: Lọc nút theo Phả hệ hoặc bài báo đang cô lập, gán tọa độ 3D.
  - `relaxNodePositions3D(nodes, minDistance)`: Lực đẩy chống chồng chéo 3 chiều để không bao giờ bị đè chữ.
  - `project3D(pt, w, h)`: Phép chiếu phối cảnh xoay 360° quanh trục đứng $Y$ (`yaw`) và trục ngang $X$ (`pitch`).
  - `draw3DVolumetricStage(w, h)`: Vẽ lưới sàn 3D, 3 mặt phẳng phân tầng, đường gióng độ cao từ từng nút xuống sàn, và la bàn trục `X-Y-Z`.
  - `draw3DEdge()` & `draw3DNode()`: Vẽ đường cong 3D, hạt ánh sáng chạy dọc mũi tên và khối cầu/kim cương.

---

### 🔍 D. Bộ máy Phát hiện Khe hở Nghiên cứu (`src/engine/gapEngine.js`)
- **Nhiệm vụ**:
  - Quét toàn bộ các mũi tên `refute` (Tấn công/Bác bỏ) và `conflict` (Tương khắc) để tìm miền điều kiện bị khuyết giữa 2 bài báo.
- **Các hàm chính trong [`src/engine/gapEngine.js`](../src/engine/gapEngine.js)**:
  - `computeEcosystemGaps(filterEcoId, isolatedPaperIds)`: Trả về danh sách các Khe hở nghiên cứu (`◇`).
  - `promoteGapToQuestion(gap, onPromoted)`: Biến một Khe hở thành Câu hỏi nghiên cứu & Chuỗi suy luận mới.

---

### 🖥️ E. Các Giao diện Thành phần (`src/views/`)
1. **[`src/views/inspectorView.js`](../src/views/inspectorView.js)**:
   - `renderFloatingInspector()`: Hiển thị chi tiết bài báo / khe hở ở ngăn nổi bên phải màn hình 3D.
   - `renderSidebarLineages()`: Danh sách cô lập nhanh từng Phả hệ ở thanh bên trái.
   - `renderQuestionPopover()`: Hộp thoại xem chuỗi suy luận và nút **Xóa câu hỏi sai (nhưng vẫn giữ nguyên 100% Phả hệ)**.
2. **[`src/views/editorView.js`](../src/views/editorView.js)**:
   - `renderEditorTab()`: Vẽ danh sách thẻ bài báo rút gọn có viền màu ở cột trái.
   - `switchEditorSubtab(subtabId)`: Chuyển đổi giữa 4 phân mục màu sắc (`1. Thông tin & Đóng góp`, `2. Điều kiện & Điểm gãy`, `3. Mũi tên Phả hệ & Tấn công`, `4. Chuỗi suy luận`).
   - `populatePaperEditorForm(paper)`: Đổ dữ liệu bài báo vào 4 phân mục.
3. **[`src/views/aiHubView.js`](../src/views/aiHubView.js)**:
   - `callCloudLlmWithUserKey({ provider, apiKey, model, prompt })`: Gọi Gemini / OpenAI / Claude bằng **chính API Key cá nhân của người dùng đang đăng nhập (BYOK)**.
   - `parseRawAiOutputToGraph(rawText)`: **Bộ Trung Gian Chuẩn Hóa** — chuyển văn bản thô hoặc JSON từ AI thành các Nút bài báo, Điều kiện biên và Mũi tên 3D.
4. **[`src/views/matrixView.js`](../src/views/matrixView.js)**:
   - `renderMatrixTab()`: Hiển thị hệ thống **Thẻ Phân Tầng Màu Sắc** đối chiếu giữa Bài Nền tảng (Xanh), Bài Tấn công (Đỏ), Điều kiện (Vàng) và Khe hở (Hồng).

---

## 3. Hướng dẫn Triển khai Miễn phí lên Cloudflare Pages (Dành cho 20–50 người dùng)

1. Đẩy toàn bộ repo này lên GitHub (`https://github.com/lawnguyenit/Filio3D`).
2. Đăng nhập vào **Cloudflare Dashboard** -> Chọn **Workers & Pages** -> **Create Application** -> **Pages** -> **Connect to Git** -> Chọn repo `Filio3D`.
3. Ở bước cấu hình Build:
   - **Framework preset**: `None`
   - **Build command**: *(để trống)*
   - **Build output directory**: `/`
4. *(Tùy chọn để lưu trữ đám mây riêng cho từng người)*:
   - Vào **Workers & Pages -> KV** -> Tạo 1 namespace tên là `FILIO_KV`.
   - Vào **Settings -> Functions -> KV namespace bindings** của dự án Pages -> Gắn biến `FILIO_KV` trỏ tới namespace vừa tạo.
5. *(Tùy chọn đổi mật khẩu ký mã)*:
   - Vào **Settings -> Environment variables** -> Thêm `MASTER_ADMIN_SECRET` (mật khẩu riêng của bạn để tạo mã) và `WORKSPACE_SIGNING_SECRET` (chuỗi bí mật ký HMAC).
