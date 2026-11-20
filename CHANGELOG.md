# Changelog

## Phase 3 · Test Contract v1.2

Các thay đổi phá vỡ tương thích với v1.1:

- Đêm kết thúc khi Mây hết Ngọn Lửa hoặc tới bình minh. Bỏ lý do `all_lit`. Thắng dùng `dawn_survived` khi đủ đèn và còn Ngọn Lửa.
- Thời lượng đổi thành 240, 270 và 300 giây. Thắp đủ đèn giữa đêm vẫn tiếp tục chơi.
- Đèn đang sáng có thể nhận châm dầu qua `interact`. Dầu cạn sinh `lantern_out` và đặt lại tiến độ nạp. `lantern_lit` luôn có trường `relight`. `refuel` và `fuel_drain` là sự kiện mới.
- Bóng Mực có trạng thái `drain`. Đèn dưới 30 dầu không tạo vùng an toàn. Các đèn trong snapshot có `fuel`, `ever_lit`, `relit_count`. Snapshot người chơi có thêm `capacity`, tăng qua mỗi lần thắp.
- Điểm dùng mức nạp mới và thưởng dầu còn lại tại bình minh. Bỏ thưởng thời gian. Điểm thắp lần đầu, thắp lại và Tỏa Sáng trúng Bóng Mực đang hút dầu được tính riêng.
- Scenario nhận `player.successful_lights`, `lanterns[].fuel`, `lanterns[].ever_lit` và `shades[].target_lantern_id`.

Bảng màu dễ phân biệt được lưu trong cài đặt. Hình dạng và vết rách trên đèn tắt giúp phân biệt trạng thái bằng hình dáng.
