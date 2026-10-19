/**
 * @file src/data/defaultState.js
 * @description Bộ dữ liệu mẫu khởi tạo mặc định (3 Phả hệ nghiên cứu: Weak Label, Grounded RAG, Tương tác Người-AI)
 * khi một người dùng mới đăng nhập lần đầu tiên hoặc khi bấm "Mẫu gốc".
 */

export function createDefaultState() {
  return {
    version: 4,
    activeQuestionId: 'q-weak-label',
    ecosystems: [
      {
        id: 'eco-weak-label',
        title: 'Phả hệ 1: Weak Label (Học từ Nhãn yếu & Nhiễu)',
        description:
          'Phả hệ nghiên cứu về gán nhãn yếu tự động, các bài báo con kế thừa và các bài báo tấn công làm sụp đổ giả định nhiễu độc lập.',
        color: '#10b981',
      },
      {
        id: 'eco-rag',
        title: 'Phả hệ 2: Grounded RAG & Bảo toàn Điều kiện biên',
        description:
          'Phả hệ truy xuất tri thức khoa học, chống rơi rớt điều kiện tồn tại khi tóm tắt đa bài báo.',
        color: '#6366f1',
      },
      {
        id: 'eco-synthesis',
        title: 'Phả hệ 3: Tương tác Người-AI & Phản biện Khoa học',
        description:
          'Phả hệ nghiên cứu tốc độ tổng hợp tài liệu so với năng lực phát hiện giả thuyết sai.',
        color: '#f59e0b',
      },
    ],
    problems: [
      {
        id: 'prob-weak-noise',
        title: 'Sụp đổ mô hình Weak Label khi nhiễu nhãn có tương quan (Correlated Noise)',
        description:
          'Khi các hàm gán nhãn yếu dùng chung tín hiệu bề mặt, sai số cộng hưởng làm mô hình học sai hoàn toàn.',
        ecosystemId: 'eco-weak-label',
      },
      {
        id: 'prob-scope-stripping',
        title: 'Hiện tượng Rơi rớt Điều kiện tồn tại (Scope Stripping)',
        description:
          'Tóm tắt bài báo làm mất điều kiện biên khiến kết luận hẹp bị ngộ nhận là luôn đúng.',
        ecosystemId: 'eco-rag',
      },
      {
        id: 'prob-speed-rigor',
        title: 'Đánh đổi Tốc độ đọc lướt vs. Độ sâu thẩm định lập luận',
        description:
          'Tăng tốc độ đọc tài liệu nhưng dễ bám vào câu hỏi nghiên cứu sai ban đầu.',
        ecosystemId: 'eco-synthesis',
      },
    ],
    sources: [
      {
        id: 'wl-1',
        title: 'Snorkel: Rapid Training Data Creation with Weak Supervision',
        authors: 'A. Ratner, S. Bach, C. Ré, et al.',
        venue: 'VLDB / Stanford',
        year: 2017,
        url: 'https://arxiv.org/abs/1711.10160',
        ecosystemId: 'eco-weak-label',
        problemId: 'prob-weak-noise',
        provenance: {
          type: 'system',
          origin: 'Mẫu chuẩn hệ thống Filio3D',
          model: null,
          timestamp: 1714000000000,
        },
        coreKnowledge:
          'Bài báo GỐC của nhánh Weak Label: Kết hợp nhiều quy tắc gán nhãn yếu (Labeling Functions) bằng mô hình sinh để ước lượng nhãn thật mà không cần gán nhãn tay.',
        methodPipeline:
          'Xây dựng Generative Model ước lượng trọng số tin cậy của các hàm gán nhãn Heuristic -> Tối ưu hóa ma trận đồng xuất hiện -> Sinh phân phối nhãn xác suất không cần nhãn người.',
        conditions: [
          {
            category: 'method',
            factor: 'Giả định độc lập',
            value: 'Các hàm gán nhãn yếu (LFs) phải có sai số độc lập có điều kiện (Conditionally Independent)',
          },
          {
            category: 'data',
            factor: 'Ngưỡng chất lượng nhãn',
            value: 'Độ chính xác trung bình của các quy tắc phải tốt hơn đoán ngẫu nhiên (>50%)',
          },
        ],
        materials:
          'Tập dữ liệu Text & Biomedical (TREC, Sprout, CDR), các bộ heuristic viết bằng Python/Regex, mô hình phân loại Logistic Regression & LSTM.',
        evidence:
          'Đạt độ chính xác tương đương huấn luyện có giám sát với nhãn tay (chênh lệch dưới 1-2 điểm F1), nhưng giảm chi phí gán nhãn tới 10 lần.',
        limitations:
          'Sụp đổ hoàn toàn khi các hàm gán nhãn yếu bị phụ thuộc/tương quan ngầm (correlated errors) hoặc khi lớp dữ liệu cực kỳ mất cân bằng.',
        internalChain: [
          { stage: 'Vấn đề', text: 'Gán nhãn thủ công quá đắt đỏ cho các miền chuyên sâu' },
          { stage: 'Điều kiện', text: 'Các quy tắc heuristic độc lập nhau và đúng > 50%' },
          { stage: 'Phương pháp', text: 'Ma trận đồng xuất hiện ước lượng trọng số tin cậy của từng LF' },
          { stage: 'Kết luận', text: 'Huấn luyện được bộ phân loại tương đương nhãn sạch với chi phí giảm 10x' },
        ],
      },
      {
        id: 'wl-2',
        title: 'COSINE: Contrastive Self-Training for Fine-Tuning with Weak Labels',
        authors: 'Y. Yu, S. Zuo, H. Jiang, et al.',
        venue: 'ACL',
        year: 2021,
        url: 'https://aclanthology.org/2021.acl-long.80',
        ecosystemId: 'eco-weak-label',
        problemId: 'prob-weak-noise',
        provenance: {
          type: 'system',
          origin: 'Mẫu chuẩn hệ thống Filio3D',
          model: null,
          timestamp: 1714000000000,
        },
        coreKnowledge:
          'Bài báo CON kế thừa Snorkel (wl-1): Dùng Contrastive Learning và độ tự tin của mô hình để tự lọc bớt các mẫu nhãn yếu bị nhiễu trong quá trình huấn luyện.',
        methodPipeline:
          'Tích hợp Contrastive Learning vào Self-Training để kéo gần các biểu diễn cùng nhãn thật -> Lọc mẫu nhiễu dựa trên ngưỡng độ tự tin (Confidence Thresholding).',
        conditions: [
          {
            category: 'method',
            factor: 'Biểu diễn nhúng',
            value: 'Các mẫu cùng nhãn thật phải nằm gần nhau trong không gian biểu diễn của Pretrained LM',
          },
          {
            category: 'data',
            factor: 'Phân phối lớp',
            value: 'Các lớp có kích thước tương đương nhau, không có lớp hiếm (long-tail)',
          },
        ],
        materials:
          'Pretrained Language Models (RoBERTa, BERT), bộ benchmark GLUE (SST-2, IMDB, AGNews) dưới nhãn yếu sinh từ Snorkel.',
        evidence:
          'Cải thiện 6.8% F1 so với huấn luyện trực tiếp trên nhãn yếu của Snorkel; lọc bỏ được 82% mẫu nhiễu ngẫu nhiên.',
        limitations:
          'Khi gặp dữ liệu đuôi dài (long-tail), cơ chế lọc nhiễu theo ngưỡng tự tin sẽ xóa sạch toàn bộ mẫu của lớp hiếm vì tưởng nhầm là nhãn sai!',
        internalChain: [
          { stage: 'Vấn đề', text: 'Nhãn tổng hợp từ Snorkel vẫn còn tỷ lệ nhiễu cao làm giảm trần hiệu năng' },
          { stage: 'Điều kiện', text: 'Mật độ cụm đặc trưng phản ánh đúng nhãn ngữ nghĩa' },
          { stage: 'Phương pháp', text: 'Contrastive regularizer + Self-training chỉ giữ mẫu độ tự tin cao' },
          { stage: 'Kết luận', text: 'Cải thiện 6.8% F1 so với huấn luyện trực tiếp trên nhãn yếu của Snorkel' },
        ],
      },
      {
        id: 'wl-3',
        title: 'When Does Weak Supervision Fail? Attacks via Correlated Heuristic Noise',
        authors: 'H. Zhang, M. Chen, et al.',
        venue: 'ICML',
        year: 2023,
        url: 'https://proceedings.mlr.press/v202',
        ecosystemId: 'eco-weak-label',
        problemId: 'prob-weak-noise',
        provenance: {
          type: 'system',
          origin: 'Mẫu chuẩn hệ thống Filio3D',
          model: null,
          timestamp: 1714000000000,
        },
        coreKnowledge:
          'BÀI TẤN CÔNG / BÁC BỎ Snorkel (wl-1): Chứng minh trong thực tế các chuyên gia viết hàm nhãn yếu luôn dùng chung từ khóa bề mặt, tạo ra nhiễu tương quan làm mô hình của wl-1 hội tụ ngược về nhãn sai!',
        methodPipeline:
          'Thiết kế đòn tấn công đối kháng thông qua phân tích ma trận hiệp phương sai giữa các quy tắc gán nhãn -> Đo độ sai lệch khi các hàm nhãn cùng dựa trên từ khóa bề mặt.',
        conditions: [
          {
            category: 'data',
            factor: 'Cấu trúc nhiễu',
            value: 'Từ 3 hàm gán nhãn yếu trở lên cùng bắt chung một từ khóa gây nhiễu (Spurious Trigger)',
          },
          {
            category: 'metric',
            factor: 'Kiểm định ngoài phân phối',
            value: 'Đánh giá trên tập test không chứa từ khóa lối tắt (Shortcut-free OOD test)',
          },
        ],
        materials:
          'Tập dữ liệu Stanford Sentiment Treebank và YouTube Spam với các bộ hàm gán nhãn cố tình gài từ khóa tương quan (Spurious triggers).',
        evidence:
          'Chứng minh khi 3 hàm nhãn trở lên có tương quan ẩn, tỷ lệ lỗi của Snorkel tăng vọt từ 12% lên 47%, mô hình hội tụ ngược về nhãn sai!',
        limitations:
          'Chỉ mới chỉ ra sự sụp đổ của wl-1 và wl-2; phương pháp sửa lỗi đề xuất đòi hỏi phải biết trước cấu trúc đồ thị phụ thuộc giữa các hàm nhãn.',
        internalChain: [
          { stage: 'Vấn đề', text: 'Kiểm tra xem giả định sai số độc lập của Snorkel (wl-1) có tồn tại thực tế không' },
          { stage: 'Điều kiện', text: 'Nhiều LF cùng dựa trên từ khóa bề mặt (spurious correlations)' },
          { stage: 'Phương pháp', text: 'Phân tích phổ hiệp phương sai và tấn công nhiễu đồng thuận giả' },
          { stage: 'Kết luận', text: 'Bác bỏ giả định của wl-1: Độ đồng thuận cao giữa các nhãn yếu lại là bẫy nhiễu' },
        ],
      },
      {
        id: 'wl-4',
        title: 'Minority Collapse in Self-Trained Weak Supervision under Imbalance',
        authors: 'K. Tran, D. Pham, et al.',
        venue: 'NeurIPS',
        year: 2024,
        url: 'https://neurips.cc/virtual/2024',
        ecosystemId: 'eco-weak-label',
        problemId: 'prob-weak-noise',
        provenance: {
          type: 'system',
          origin: 'Mẫu chuẩn hệ thống Filio3D',
          model: null,
          timestamp: 1714000000000,
        },
        coreKnowledge:
          'BÀI TẤN CÔNG COSINE (wl-2): Chứng minh cơ chế lọc mẫu theo ngưỡng tự tin của wl-2 xóa sổ 89% mẫu thuộc lớp hiếm (ví dụ ca bệnh hiếm), làm mô hình mù hoàn toàn trên lớp thiểu số.',
        methodPipeline:
          'Theo dõi động lực học gradient và trần hội tụ của các lớp thiểu số qua từng vòng lặp Self-training dưới phân phối mất cân bằng cực độ.',
        conditions: [
          {
            category: 'data',
            factor: 'Tỷ lệ mất cân bằng',
            value: 'Dữ liệu lệch (Imbalance ratio > 20:1) như chẩn đoán y khoa hoặc phát hiện gian lận',
          },
        ],
        materials:
          'Bộ dữ liệu chẩn đoán ung thư MIMIC-III và gian lận tín dụng Kaggle với tỷ lệ mất cân bằng từ 20:1 đến 100:1.',
        evidence:
          'Cơ chế lọc theo độ tự tin của COSINE xóa sạch 89% mẫu thuộc lớp hiếm, khiến mô hình đạt Recall = 0% trên lớp bệnh nhân nặng.',
        limitations:
          'Giải pháp hiệu chỉnh ngưỡng theo tần suất lớp vẫn bị đánh lừa nếu lớp hiếm đồng thời chịu nhiễu tương quan từ wl-3.',
        internalChain: [
          { stage: 'Vấn đề', text: 'Tại sao wl-2 thất bại nặng nề khi áp dụng vào dữ liệu y sinh thực tế?' },
          { stage: 'Điều kiện', text: 'Phân phối nhãn lệch mạnh (Long-tail distribution)' },
          { stage: 'Phương pháp', text: 'Theo dõi động lực học gradient của các mẫu thiểu số qua từng vòng self-training' },
          { stage: 'Kết luận', text: 'Tấn công wl-2: Độ tự tin thấp không đồng nghĩa với nhãn nhiễu mà có thể là mẫu hiếm!' },
        ],
      },
      {
        id: 'wl-5',
        title: 'Causal Disentanglement for Weak Labels under Correlated Noise',
        authors: 'T. Le, A. Nguyen, et al.',
        venue: 'ICLR',
        year: 2025,
        url: 'https://openreview.net/forum?id=iclr2025',
        ecosystemId: 'eco-weak-label',
        problemId: 'prob-weak-noise',
        provenance: {
          type: 'system',
          origin: 'Mẫu chuẩn hệ thống Filio3D',
          model: null,
          timestamp: 1714000000000,
        },
        coreKnowledge:
          'BÀI KẾ THỪA MỚI NHẤT: Khắc phục đòn tấn công của wl-3 bằng cách tách biến nhân quả (Causal Content) khỏi biến lối tắt của hàm gán nhãn yếu.',
        methodPipeline:
          'Kết hợp Invariant Risk Minimization (IRM) với Đồ thị nhãn yếu: Tách biểu diễn thành phần nhân quả bất biến (Causal core) khỏi biến nhiễu ngoại cảnh.',
        conditions: [
          {
            category: 'data',
            factor: 'Môi trường đa dạng',
            value: 'Cần dữ liệu thu thập từ ít nhất 2 môi trường (environments) khác nhau để tách bất biến nhân quả',
          },
        ],
        materials:
          'Dữ liệu đa miền (Multi-domain text & image benchmarks) thu thập từ ít nhất 2 bệnh viện / nguồn dữ liệu độc lập.',
        evidence:
          'Khôi phục F1 từ 51% lên 84% trong điều kiện có nhiễu tương quan nghiêm trọng của wl-3, miễn là có dữ liệu từ >= 2 môi trường.',
        limitations:
          'Chưa giải quyết được bài toán kết hợp đồng thời Nhiễu tương quan (wl-3) VÀ Sụp đổ lớp hiếm (wl-4) khi chỉ có 1 môi trường duy nhất.',
        internalChain: [
          { stage: 'Vấn đề', text: 'Cứu phả hệ Weak Label khỏi đòn tấn công nhiễu tương quan của wl-3' },
          { stage: 'Điều kiện', text: 'Tồn tại tín hiệu bất biến qua nhiều môi trường dữ liệu' },
          { stage: 'Phương pháp', text: 'Invariant Risk Minimization kết hợp đồ thị nhãn yếu' },
          { stage: 'Kết luận', text: 'Khôi phục độ chính xác khi các LF bị phụ thuộc ngầm' },
        ],
      },
      {
        id: 'rag-1',
        title: 'Evaluating LLMs for Literature Claim Extraction',
        authors: 'J. Kim, R. Patel, et al.',
        venue: 'EMNLP',
        year: 2024,
        url: 'https://aclanthology.org/2024.emnlp',
        ecosystemId: 'eco-rag',
        problemId: 'prob-scope-stripping',
        provenance: {
          type: 'system',
          origin: 'Mẫu chuẩn hệ thống Filio3D',
          model: null,
          timestamp: 1714000000000,
        },
        coreKnowledge:
          'Trích xuất kết luận chính đạt F1 = 88%, nhưng làm rơi mất 61% các điều kiện tồn tại (cỡ mẫu, giả định biên) đi kèm kết luận đó.',
        methodPipeline:
          'Xây dựng bộ đo Scope-Recall kiểm định mức độ bảo toàn các mệnh đề phụ thuộc điều kiện khi đưa bài báo qua các LLM tóm tắt phổ biến.',
        conditions: [
          { category: 'data', factor: 'Đầu vào', value: 'Chỉ tóm tắt từ Abstract và Conclusion' },
        ],
        materials:
          'Bộ dữ liệu 500 bài báo y sinh và khoa học máy tính với chú giải thủ công về các điều kiện biên của từng tuyên bố (claim).',
        evidence:
          'LLM chỉ bảo toàn được 39% điều kiện tồn tại dù trích xuất tuyên bố chính đạt F1 = 88%, tạo nguy cơ ngộ nhận khoa học nghiêm trọng.',
        limitations: 'Làm người đọc tưởng kết luận trong điều kiện hẹp là chân lý phổ quát.',
        internalChain: [
          { stage: 'Vấn đề', text: 'Đo độ trung thực khi LLM tóm tắt bài báo' },
          { stage: 'Điều kiện', text: 'Prompt tóm tắt ngắn 1 chiều' },
          { stage: 'Kết luận', text: 'Rơi mất 61% điều kiện tồn tại của bài báo' },
        ],
      },
      {
        id: 'rag-2',
        title: 'Condition-Aware Evidence Graphs for Contradictory Papers',
        authors: 'D. Nguyen, K. Tanaka, et al.',
        venue: 'NeurIPS',
        year: 2024,
        url: 'https://neurips.cc/virtual/2024',
        ecosystemId: 'eco-rag',
        problemId: 'prob-scope-stripping',
        provenance: {
          type: 'system',
          origin: 'Mẫu chuẩn hệ thống Filio3D',
          model: null,
          timestamp: 1714000000000,
        },
        coreKnowledge:
          'Biểu diễn mỗi bài báo dưới dạng cặp (Mệnh đề + Điều kiện tồn tại) giúp phân giải 74% các mâu thuẫn bề mặt giữa các bài báo.',
        methodPipeline:
          'Mô hình hóa đồ thị tri thức 2 tầng: Nút thực thể bài báo gắn kèm vector điều kiện biên; tính độ tương thích miền trước khi xác lập cạnh mâu thuẫn.',
        conditions: [
          { category: 'method', factor: 'Cấu trúc đồ thị', value: 'Tách riêng nút Bài báo, Điều kiện biên và cạnh Tương khắc' },
        ],
        materials:
          '1,200 cặp bài báo có kết luận trái ngược nhau trên PubMed và arXiv.',
        evidence:
          'Phân giải thành công 74% mâu thuẫn biểu kiến: chỉ ra hai bài không hề phủ định nhau mà chỉ đúng ở hai tập điều kiện khác nhau.',
        limitations:
          'Chưa tích hợp khả năng tự động tìm câu hỏi mới khi người dùng xóa câu hỏi nghiên cứu cũ.',
        internalChain: [
          { stage: 'Vấn đề', text: 'Tại sao hai bài báo uy tín lại kết luận ngược nhau?' },
          { stage: 'Điều kiện', text: 'Mỗi bài đúng ở một miền điều kiện khác nhau' },
          { stage: 'Kết luận', text: 'Gắn Điều kiện tồn tại vào đồ thị giúp hóa giải 74% xung đột giả' },
        ],
      },
      {
        id: 'syn-1',
        title: 'Can LLMs Accelerate Scientific Discovery?',
        authors: 'S. Liu, A. Wang, et al.',
        venue: 'Nature Machine Intelligence',
        year: 2024,
        url: 'https://doi.org/10.1038/s42256-024-00833-5',
        ecosystemId: 'eco-synthesis',
        problemId: 'prob-speed-rigor',
        provenance: {
          type: 'system',
          origin: 'Mẫu chuẩn hệ thống Filio3D',
          model: null,
          timestamp: 1714000000000,
        },
        coreKnowledge:
          'LLM giảm 42% thời gian gom tài liệu ban đầu, nhưng không làm tăng chất lượng thẩm định lập luận.',
        methodPipeline:
          'Thử nghiệm ngẫu nhiên có đối chứng (RCT) trên 120 nghiên cứu sinh thực hiện khảo cứu tài liệu với và không có công cụ hỗ trợ AI.',
        conditions: [
          { category: 'data', factor: 'Quy mô', value: 'Tác vụ ngắn < 10 bài báo trong 60 phút' },
        ],
        materials:
          '120 nhà nghiên cứu, 5 chủ đề khảo sát khoa học chuẩn hóa, hệ thống ghi log thao tác đọc và trích xuất.',
        evidence:
          'Thời gian hoàn thành tổng quan giảm từ 95 phút xuống 55 phút (giảm 42%), nhưng số lượng giả định sai được nhận diện không có ý nghĩa thống kê (p > 0.05).',
        limitations: 'Không phát hiện được khi câu hỏi nghiên cứu ban đầu bị đặt sai.',
        internalChain: [
          { stage: 'Vấn đề', text: 'Đo tốc độ tổng hợp tài liệu bằng LLM' },
          { stage: 'Kết luận', text: 'Nhanh hơn 42% nhưng chất lượng phản biện không đổi' },
        ],
      },
      {
        id: 'syn-2',
        title: 'AI Tools and Research Productivity: Longitudinal Study',
        authors: 'A. Morris, L. Zhang, et al.',
        venue: 'Science',
        year: 2025,
        url: 'https://science.org',
        ecosystemId: 'eco-synthesis',
        problemId: 'prob-speed-rigor',
        provenance: {
          type: 'system',
          origin: 'Mẫu chuẩn hệ thống Filio3D',
          model: null,
          timestamp: 1714000000000,
        },
        coreKnowledge:
          'BÀI TẤN CÔNG / TƯƠNG KHẮC với Liu (syn-1): Trong dài hạn 6 tháng, đọc tóm tắt danh sách phẳng làm tăng thiên kiến xác nhận và thu hẹp phả hệ trích dẫn.',
        methodPipeline:
          'Nghiên cứu đoàn hệ dọc (Longitudinal Cohort Study) theo dõi 85 phòng thí nghiệm trong 6 tháng: phân tích mạng lưới trích dẫn và tỷ lệ chuyển hướng đề tài.',
        conditions: [
          { category: 'environment', factor: 'Thời gian', value: 'Quan sát thực địa dài hạn 6 tháng' },
        ],
        materials:
          'Dữ liệu theo dõi nhật ký nghiên cứu của 85 lab trong 6 tháng, hơn 15,000 lượt tra cứu tài liệu học thuật.',
        evidence:
          'Đoàn hệ chỉ dùng AI tóm tắt phẳng có độ phân kỳ trích dẫn hẹp hơn 31% và tỷ lệ phát hiện lỗ hổng phản biện thấp hơn 48% so với nhóm đọc phả hệ đa chiều.',
        limitations: 'Chưa thử nghiệm trên giao diện đồ thị 3D có hiển thị cạnh Bác bỏ/Tương khắc.',
        internalChain: [
          { stage: 'Vấn đề', text: 'Hệ quả dài hạn của việc đọc tóm tắt phẳng' },
          { stage: 'Kết luận', text: 'Làm nhà nghiên cứu lún sâu vào giả thuyết sai ban đầu' },
        ],
      },
    ],
    relations: [
      {
        id: 'rel-wl-1',
        from: 'wl-1',
        to: 'wl-2',
        type: 'lineage',
        label: 'Kế thừa Snorkel & bổ sung Contrastive Self-Training',
        conditionNote: 'Mở rộng từ mô hình sinh sang lọc nhiễu tự huấn luyện',
      },
      {
        id: 'rel-wl-2',
        from: 'wl-3',
        to: 'wl-1',
        type: 'refute',
        label: 'TẤN CÔNG: Bác bỏ giả định sai số độc lập khi có nhiễu tương quan',
        conditionNote: 'Làm wl-1 sụp đổ khi các LF dùng chung từ khóa bề mặt',
      },
      {
        id: 'rel-wl-3',
        from: 'wl-3',
        to: 'wl-2',
        type: 'refute',
        label: 'TẤN CÔNG: Self-training khuếch đại nhiễu đồng thuận giả',
        conditionNote: 'Khi các LF cùng sai, wl-2 tự tin giữ lại nhãn sai',
      },
      {
        id: 'rel-wl-4',
        from: 'wl-4',
        to: 'wl-2',
        type: 'refute',
        label: 'TẤN CÔNG: Lọc độ tự tin xóa sổ 89% mẫu lớp hiếm (Long-tail)',
        conditionNote: 'Làm wl-2 thất bại trên dữ liệu mất cân bằng',
      },
      {
        id: 'rel-wl-5',
        from: 'wl-1',
        to: 'wl-5',
        type: 'lineage',
        label: 'Phát triển nhánh Nhân quả (Causal Weak Supervision)',
        conditionNote: 'Tách biến nhân quả để chống nhiễu tương quan',
      },
      {
        id: 'rel-wl-6',
        from: 'wl-5',
        to: 'wl-3',
        type: 'support',
        label: 'Khắc phục đòn tấn công nhiễu tương quan của wl-3 khi có đa môi trường',
        conditionNote: 'Đòi hỏi dữ liệu từ >= 2 môi trường',
      },
      {
        id: 'rel-wl-7',
        from: 'wl-4',
        to: 'wl-5',
        type: 'conflict',
        label: 'Tương khắc: Tách nhân quả vẫn chưa cứu được lớp cực hiếm trong 1 môi trường',
        conditionNote: 'Khe hở giữa Nhiễu tương quan và Dữ liệu đuôi dài',
      },
      {
        id: 'rel-rag-1',
        from: 'rag-1',
        to: 'rag-2',
        type: 'lineage',
        label: 'Khắc phục lỗi rơi rớt 61% điều kiện biên bằng Đồ thị Điều kiện',
        conditionNote: 'Bổ sung vector điều kiện tồn tại vào từng nút',
      },
      {
        id: 'rel-rag-2',
        from: 'rag-2',
        to: 'rag-1',
        type: 'refute',
        label: 'Bác bỏ cách trích xuất mệnh đề phẳng không kèm điều kiện biên',
        conditionNote: 'Mệnh đề thiếu điều kiện gây ngộ nhận khoa học',
      },
      {
        id: 'rel-syn-1',
        from: 'syn-1',
        to: 'syn-2',
        type: 'lineage',
        label: 'Mở rộng khảo sát từ 60 phút sang 6 tháng thực địa',
        conditionNote: 'Đối chiếu ngắn hạn vs dài hạn',
      },
      {
        id: 'rel-syn-2',
        from: 'syn-2',
        to: 'syn-1',
        type: 'conflict',
        label: 'Tương khắc: Ngắn hạn nhanh hơn nhưng dài hạn làm tăng thiên kiến xác nhận',
        conditionNote: 'Khác điều kiện thời gian & giao diện hiển thị',
      },
    ],
    questions: [
      {
        id: 'q-weak-label',
        title: 'Làm sao huấn luyện từ Nhãn yếu (Weak Label) khi vừa có nhiễu tương quan (wl-3) vừa lệch lớp đuôi dài (wl-4)?',
        hypothesis:
          'Các bài báo tấn công (wl-3, wl-4) đã chứng minh giả định độc lập và lọc ngưỡng tự tin đều sụp đổ. Cần cơ chế phân biệt "mẫu hiếm" với "nhiễu tương quan".',
        status: 'active',
        ecosystemId: 'eco-weak-label',
        createdAt: Date.now() - 86400000,
        reasoningChain: [
          {
            id: 'st-wl-1',
            stepOrder: 1,
            title: 'Nền tảng Gán nhãn yếu (Snorkel & COSINE)',
            description: 'Gộp nhiều quy tắc yếu và lọc theo độ tự tin giúp giảm chi phí gán nhãn.',
            status: 'conditional',
            linkedPaperIds: ['wl-1', 'wl-2'],
          },
          {
            id: 'st-wl-2',
            stepOrder: 2,
            title: 'Điểm gãy 1: Bị tấn công bởi Nhiễu tương quan',
            description: 'Khi các LF dùng chung từ khóa lối tắt, mô hình đồng thuận sai (Zhang 2023 bác bỏ wl-1).',
            status: 'broken',
            linkedPaperIds: ['wl-3'],
          },
          {
            id: 'st-wl-3',
            stepOrder: 3,
            title: 'Điểm gãy 2: Xóa nhầm mẫu hiếm (Long-tail)',
            description: 'Lọc độ tự tin của wl-2 xóa mất 89% mẫu hiếm (Tran 2024 tấn công wl-2).',
            status: 'contested',
            linkedPaperIds: ['wl-4'],
          },
          {
            id: 'st-wl-4',
            stepOrder: 4,
            title: 'Hướng mở: Tách nhân quả bảo toàn lớp hiếm',
            description: 'Kế thừa wl-5 nhưng giải quyết thêm điều kiện đuôi dài trong 1 môi trường.',
            status: 'solid',
            linkedPaperIds: ['wl-5'],
          },
        ],
      },
    ],
  };
}
