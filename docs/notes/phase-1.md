# Ghi chép Phase 1

- Chọn JavaScript để dùng chung logic giữa Node.js và Three.js. Không cần GPU hoặc thiết lập đồ họa cho CLI.
- Mây chạy 6 m/s, mang 10 đom đóm. Nạp 5 đom đóm cho mỗi đèn. Đêm kéo dài 180 giây và bắt đầu với 3 Ngọn Lửa. Công thức điểm ghi trong README.
- Nhặt tự động và nạp theo bán kính ngang. Tỏa Sáng đo bán kính ngang trong v1.0. Bóng Mực không tiến sâu vào vùng đèn sáng. Đêm 1 giữ Mây ở mép đảo.
- Tiêu chí nghiệm thu gồm đi lại và nhảy, nhặt rồi nạp đủ năm đèn, trừ Ngọn Lửa khi chạm Bóng Mực, dùng Tỏa Sáng, thắng/thua và chơi lại. CLI dựng được scenario, đếm đúng tick và tạo JSONL giống từng byte khi lặp với cùng dữ liệu.
- Dùng Codex để chuyển đề thành tiêu chí, triển khai logic, CLI, bản 3D và kịch bản thử. Chưa có số token/chi phí của phiên từ công cụ sử dụng. Dùng cùng logic và kiểm thử CLI nhỏ để giảm yêu cầu lặp lại.
- Hook trước push chạy test và build. Kết quả thật được ghi tại [bằng chứng Phase 1](../proof/phase-1.md).
