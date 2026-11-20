# Phase 4 — Bình minh v1.0.0

## Tiêu chí nghiệm thu

- Benchmark mở bản 3D ở 1280×720, dựng 200 Bóng Mực, 100 đom đóm và ba đèn đầy dầu rồi đo sau 3 giây. Giữ số đo lấy từ mỗi khung hình.
- Soak dùng một tiến trình, xoay vòng ba bản đồ qua 10 đêm, kiểm tra kết thúc và RSS.
- Lưu top 10 trên đĩa và xuất cùng thứ tự qua `run_cmd`. Kiểm tra thứ tự hòa điểm, tên, chơi lại và còn dữ liệu sau khi khởi động lại.
- Kiểm tra gán phím, từ chối trùng, hoàn nguyên, phụ đề/cảnh báo, giảm chuyển động và hai cỡ chữ.
- Cài từ bản sạch, lưu JSON đo thật, đóng gói và kiểm tra file phát hành, quay demo thực tế.

## Quyết định và giới hạn đo

- Bảng xếp hạng dùng chung dữ liệu đĩa giữa bản chạy Node và lệnh xuất. Gọi lại lưu một mục giống hệt sẽ không tạo hạng trùng. Khi dùng host chỉ phục vụ file, bảng điểm dự phòng lưu trong trình duyệt. Seed mục điểm là seed đầu chiến dịch, 1200 với bản chơi hiện tại.
- Soak dùng seed đầu ở lượt chỉ số 0, cộng một ở mỗi lượt. Đo RSS sau GC ở hai mốc tương ứng. Kích thước vùng cấp phát trẻ của V8 dùng 1 MiB cho tiến trình soak để phù hợp tải nhỏ, lặp lâu. Tiến trình benchmark và game đồ họa chạy độc lập.
- Chromium được yêu cầu tắt vsync và giới hạn khung hình. Bộ đo đếm các khung renderer, mô tả cấu hình đã dùng và để RSS là null đối với trang web.
- Dùng lại mô hình và ánh sáng của game. Gom đom đóm và Bóng Mực bằng instancing cho bản thường lẫn benchmark. Đồ trang trí riêng được tắt khi benchmark, soak chỉ chạy mô phỏng.
- Bản demo dùng đầu vào tự động gửi vào logic game từ seed mặc định, quay giao diện thực, sau đó hiện kết quả lệnh đã chạy. Các ca kiểm thử UI tăng tốc những mốc như bình minh bằng scenario trong bộ nhớ và được ghi riêng.
