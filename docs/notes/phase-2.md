# Phase 2 — Ba hòn đảo

## Tiêu chí nghiệm thu

| Phần trong Ticket-02 | Tiêu chí nghiệm thu | Kiểm chứng |
|---|---|---|
| Chuẩn hóa, bản đồ | Đêm 1/2/3 có 5/6/7 đèn, 300/330/360 giây. Đảo Cau qua cầu và bục nhảy được. Đảo Chuông đi lên bằng dốc/bục, rơi khỏi mép và bị tháp chặn. | Scenario headless cho cả ba map, cầu, bục, dốc, vách, tháp và rơi. |
| Lướt, nhặt, nạp, vùng sáng | Lướt 14 m/s trong 12 tick và hồi chiêu 90 tick. Nạp tối đa phần còn thiếu, chọn đèn gần rồi ưu tiên ID. Bóng bị đẩy ra mép 6 m trong 30 tick. | Test dash, nạp, trùng khoảng cách, đẩy khỏi vùng sáng. |
| Gió Lạc | Xuất hiện theo lịch. Chỉ cướp một lần, tối đa 3 đom đóm. Cướp trước khi Bóng Mực gây hit. Pulse khi đuổi buộc chạy, pulse khi mang đồ trả lại đồ. | Test spawn, thứ tự va chạm, chạy trốn và trả đồ. |
| Bùa Gió | Chạy 7.2 m/s trong 600 tick, lướt vẫn 12 tick nhưng bỏ hồi chiêu và hồi bùa sau 2.700 tick. | Scenario chạy, bấm lướt lặp, hết bùa và hồi bùa. |
| Chuỗi 3 đêm | Menu mở lời dẫn của Ông Đăng, thắng mở đêm kế, thua mở chơi lại. Sau Đêm 3 hiển thị Bình Minh và tổng điểm. | CLI kiểm tra thắng/thua. Chrome kiểm tra luồng chuyển màn bằng fixture trong bộ nhớ. |
| Tạm dừng | Esc/P dừng gameplay, sim tick, đồng hồ, hồi chiêu và vòng đời thực thể. Tiếp tục, chơi lại, cài đặt và về menu thao tác được. | Snapshot trước/trong/sau pause và kiểm tra menu trong Chrome. |
| Cài đặt | Lưu âm lượng và độ nhạy chuột giữa các lần mở. | Kiểm chứng giá trị còn sau khi reload Chrome. |
| Âm thanh | Phát nhạc nền và hiệu ứng khi nhặt, thắp, tỏa, trúng, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện và từng giây còn lại trong 10 giây cuối. | Âm thanh tổng hợp bằng Web Audio. Cần nghe thủ công để xác nhận đầu ra loa. |
| HUD và màu | Ngọn Lửa, đồng hồ, đèn, điểm, thanh đom đóm, hồi chiêu, nhắc E và mũi tên ngoài màn. Các nhóm màu dùng mã hex của ticket. | Mở bản 3D, kiểm tra DOM/ảnh. Màu khai báo trong `src/view.js` và `src/style.css`; màu trên vật thể chịu ánh sáng và sương. |
| Gió mạnh | Cảnh báo bằng lá và âm thanh ở giây 28, gió 2 m/s ở giây 30–35, lặp mỗi 30 giây và hướng được chọn theo seed. | Scenario bắt đầu và kết thúc cơn gió, kiểm tra quãng đường 10 m. |
| V1.1, hồi quy, hiệu năng | Các sự kiện, snapshot, scenario mới theo v1.1. Chạy đủ 21.600 tick trong 30 giây và đạt trung bình tối thiểu 30 FPS ở 1280×720 trên bản thường. | Tests, đo CLI, đo Chrome với WebGL 2. |

## Giả định

- Cấu trúc scenario do ticket để mở được hỗ trợ theo các trường `drifters[] { id?, pos, state?, stolen?, state_ticks_left? }` và `charms[] { id?, pos?, available?, respawn_ticks? }`. Hai mảng thay thế danh sách mặc định. `pos` của bùa có thể lấy theo ID chuẩn của đêm. Mỗi điểm sương của Gió Lạc dùng danh sách điểm sinh Bóng Mực, lệch cao 1,2 m.
- Sự kiện `night_start` ghi ở tick gameplay đầu tiên. Snapshot tick 0 phản ánh trạng thái dựng. `player.invuln` là boolean, `motes[].ttl_s` là `null` nếu vô hạn. Gió Lạc ở trạng thái removed được bỏ khỏi danh sách hoạt động.
- Dùng phép đo XZ cho nạp đèn và vùng sáng theo v1.0. Các quy tắc nhặt, chạm Bóng Mực và Tỏa Sáng áp dụng điều kiện độ cao riêng của v1.1.
- Đêm 3 có mặt đất bên dưới đĩa đặt tháp để hợp lệ với điểm xuất phát chuẩn ở (0,0,0). Bậc cao từ mặt đất được chặn theo mô hình vách và có va chạm khi hạ xuống.
- `score.per_mote` khớp tên trường cũ, tính lúc nạp trong v1.1. Bóng Mực tan trạng thái sinh ở tick kế tiếp và có thể đuổi tại tick đó. Tốc độ đi lang thang bằng một nửa tốc độ đuổi.

## Nhật ký AI và retro

- Codex đọc yêu cầu và log test, triển khai chỉ sau khi chốt tag Phase 1. Test thắng được giữ nhưng đổi kỳ vọng điểm theo quy tắc nạp mới. Kiểm tra tất định, nhảy, nhặt, Tỏa Sáng, mất Lửa và lỗi dữ liệu tiếp tục chạy.
- Lỗi phát hiện bằng chạy thật: bản đầu dùng độ cao mặt trên cùng làm nền nên Mây rơi ở điểm xuất phát Đêm 3. Sửa tìm mặt đỡ dưới chân và giữ scenario gió/điểm xuất phát để bắt hồi quy. Phép thử bước khỏi vách ban đầu vô tình giẫm bục nhảy, nên dời điểm xuất phát của scenario ra ngoài bục.
- Kiểm tra bản 3D bằng Chrome và lưu JSONL do chương trình xuất. Giữ hook kiểm test/build và bổ sung kiểm tra trình duyệt có thể chạy lại.
- Phiên này chưa có số liệu token hoặc chi phí thực tế từ công cụ. Ước lượng theo lượng mã và test đã viết được ghi trong mục Dùng AI ở cuối trang. Dùng cùng một lõi cho game và CLI, tái sử dụng fixture và chạy test nhỏ để tiết kiệm ngữ cảnh.

## Dùng AI

Tính theo dung lượng các dòng mã, test và ghi chép do AI thêm, quy đổi thô 4 byte mỗi token, Phase 1 khoảng 13.600 token đầu ra và Phase 2 khoảng 16.400. Phép tính loại tệp khóa phụ thuộc, ảnh, JSONL và tài liệu đề. Đây là ước lượng phần tạo ra lưu trong Git. Chi phí thực và lượng token cho lần thử, lịch sử hội thoại và công cụ không được quan sát.
