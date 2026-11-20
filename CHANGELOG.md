# Changelog

## Phase 4 · Release v1.0.0 · Test Contract v1.3

- Thêm benchmark 1280×720 và soak 10 đêm, khai báo lệnh trong contract và lưu kết quả thực.
- Thêm bảng xếp hạng top 10 lưu đĩa, màn hình bảng điểm và xuất JSON. Lệnh chạy chuẩn phục vụ bản web đã build.
- Thêm đổi phím và phát hiện xung đột, phụ đề cảnh báo, giảm chuyển động và cỡ chữ 18/22,5 px.
- Gom bản sao 3D cho đom đóm và Bóng Mực để scene lớn dùng ít lệnh vẽ hơn. Bản phát hành gồm ZIP chạy được, hướng dẫn và demo MP4.

## Phase 3 · Test Contract v1.2

Các thay đổi phá vỡ tương thích với v1.1:

- Đêm kết thúc khi Mây hết Ngọn Lửa hoặc tới bình minh. Bỏ lý do `all_lit`. Thắng dùng `dawn_survived` khi đủ đèn và còn Ngọn Lửa.
- Thời lượng đổi thành 240, 270 và 300 giây. Thắp đủ đèn giữa đêm vẫn tiếp tục chơi.
- Đèn đang sáng có thể nhận châm dầu qua `interact`. Dầu cạn sinh `lantern_out` và đặt lại tiến độ nạp. `lantern_lit` luôn có trường `relight`. `refuel` và `fuel_drain` là sự kiện mới.
- Bóng Mực có trạng thái `drain`. Đèn dưới 30 dầu không tạo vùng an toàn. Các đèn trong snapshot có `fuel`, `ever_lit`, `relit_count`. Snapshot người chơi có thêm `capacity`, tăng qua mỗi lần thắp.
- Điểm dùng mức nạp mới và thưởng dầu còn lại tại bình minh. Bỏ thưởng thời gian. Điểm thắp lần đầu, thắp lại và Tỏa Sáng trúng Bóng Mực đang hút dầu được tính riêng.
- Scenario nhận `player.successful_lights`, `lanterns[].fuel`, `lanterns[].ever_lit` và `shades[].target_lantern_id`.

Bảng màu dễ phân biệt được lưu trong cài đặt. Hình dạng và vết rách trên đèn tắt giúp phân biệt trạng thái bằng hình dáng.


## Phase 2 · Test Contract v1.1

- Chuẩn hóa tốc độ, lịch sinh, thứ tự tick và bản đồ. Đêm 2 có cầu và bục nhảy, Đêm 3 có dốc, tầng và gió.
- Thêm Lướt, Bùa Gió, Gió Lạc, menu, tạm dừng và lưu cài đặt. Mở rộng dữ liệu headless cho ba đêm.

## Phase 1 · Test Contract v1.0

- Đảo Bến chơi được với năm đèn, đom đóm, nhảy, Bóng Mực, Tỏa Sáng, HUD và chơi lại.
- Thêm CLI 60 tick/giây, scenario và JSONL tất định.
