# Phase 3 — Đèn cạn dầu

## Tiêu chí nghiệm thu

- Dầu hao đúng mỗi bước mô phỏng. Châm dầu dùng công thức làm tròn lên, chọn đèn hợp lệ gần nhất và đổi sức chứa khi thắp. Hết dầu làm đèn tắt, giữ dấu đã sáng và thắp lại cần 5 đom đóm.
- Bóng Mực đi về đèn yếu khi đi lang thang, hút dầu cộng dồn trong tầm 2 m, chuyển đúng trạng thái khi Mây đến gần, khi đèn đầy lại, khi mất mục tiêu và khi bị Tỏa Sáng.
- Bình minh quyết định thắng với ngưỡng 3/5, 4/6, 5/7. Hết Ngọn Lửa được xét trước. Điểm tính theo loại thao tác, trạng thái Bóng Mực và mức dầu còn lại.
- Snapshot, scenario và sự kiện tuân theo v1.2. Tạm dừng dừng cả hao và hút dầu. Các bài kiểm tra còn hiệu lực của Phase 1–2 vẫn chạy.
- HUD hiện số đom đóm và sức chứa. Đèn có thanh dầu, nhấp nháy khi yếu, xẹp và rách khi tắt. Cài đặt bảng màu lưu qua lần mở sau.

## Quyết định thiết kế

Lõi dùng chung lưu dầu dưới dạng số nguyên, một đơn vị nội bộ bằng 1/60 dầu. Đèn giữ `lit`, tiến độ nạp, dầu, dấu đã từng sáng và số lần thắp lại. Dựng sẵn đèn trong scenario không tạo sự kiện, điểm hoặc lượt tăng sức chứa. Đèn sáng ngầm định đầy dầu, đèn tắt xuất đúng 0 dầu. Chỉ làm tròn một chữ số ở đầu ra.

Trong mỗi bước gameplay, tính hao tự nhiên và hút cộng dồn từ các Bóng Mực đang hút, sau đó tắt các đèn cạn. Chuyển sang hút ở bước di chuyển có hiệu lực ở lần trừ dầu tiếp theo. Mốc báo `fuel_drain` là mỗi 60 bước hút liên tục của từng con, với dầu sau các khoản trừ cùng tick. Ra khỏi trạng thái hút đặt lại bộ đếm. Với scenario có `state: "drain"` mà không ghi mục tiêu, tìm đèn yếu hợp lệ gần nhất. Ngưỡng an toàn so với dầu nội bộ, gồm cả đúng 30. Khi đèn được châm hồi vùng an toàn, tác vụ đẩy đã bắt đầu được đi hết tối đa 30 bước.

Luật cũ xét `all_lit` mỗi tick được thay bằng đánh giá cuối đêm sau khi tất cả thao tác trong tick đã chạy. So số đèn đang sáng với ngưỡng của đêm. Ưu tiên hết Ngọn Lửa và chỉ cộng thưởng cuối đêm khi sống sót qua bình minh. Điểm nhiên liệu lấy phần nguyên của dầu nội bộ, kể cả khi snapshot làm tròn lên.

## Hồi quy và nhật ký AI

- Giữ test đi lại, nhảy, nhặt, Dash, tạm dừng, mất Lửa, Gió Lạc, Bùa Gió, bản đồ và tính tất định. Cập nhật bài thắng sớm thành kiểm tra chơi tiếp sau khi thắp đủ và chỉ thắng lúc bình minh. Điều chỉnh kỳ vọng điểm nạp và trạng thái sau choáng theo Ticket-03. Bài kiểm tra ưu tiên hết Ngọn Lửa tiếp tục xác minh thứ tự ở đúng tick cuối.
- Codex triển khai thay đổi trong lõi chung, rồi đối chiếu các ca biên bằng scenario CLI. Dùng cùng test browser để kiểm tra cả cài đặt lưu lại và đường chuyển đêm mới. Ước lượng khoảng 7.200 token đầu ra theo lượng mã/test/tài liệu chính thêm trong diff, quy đổi thô 4 byte mỗi token. Tổng token và chi phí thực tế của phiên không được ghi nhận.
