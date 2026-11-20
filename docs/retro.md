# Retro · Đảo Đèn Lồng

## Kết quả qua bốn phase

| Phase | Điều đã kiểm chứng | Điều rút ra |
|---|---|---|
| 1 | Đảo Bến chơi được, headless v1.0 và hai lần chạy cùng seed giống từng byte. Bộ 8 kiểm thử, build và kiểm tra Chrome. | Một lõi 60 tick dùng cho cả CLI và 3D giúp so hành vi mà không cần nhìn ảnh ở mỗi lần chỉnh luật. Các tham số giai đoạn đầu cần nằm trong contract để cập nhật được. |
| 2 | Ba đêm, địa hình và tương tác chuẩn, 24 kiểm thử, một đêm headless 21.600 tick, kiểm tra Chrome 1280×720. | Yêu cầu bổ sung có thể làm lộ giả định kiến trúc. Kiểm tra từng bề mặt bằng scenario nhỏ bắt lỗi nhanh hơn chơi lại cả đêm. |
| 3 | Hết dầu, thắp lại, hút cộng dồn, bình minh và cài đặt bảng màu, với 34 kiểm thử và ảnh Chrome. | Khi luật thắng thay đổi, cần ghi rõ ca cũ phải sửa và giữ các ca còn đúng. Số nguyên 1/60 giúp kiểm thử đúng ngưỡng 30 và điểm ở tick cuối. |
| 4 | Kiểm thử hồi quy, benchmark 30 giây, soak 10 đêm, bảng điểm và cài đặt được kiểm tra sau reload, đóng gói và quay demo. | Thu số liệu thật trước khi chốt bản phát hành. FPS của trình duyệt có thể phụ thuộc cửa sổ, GPU và cách đồng bộ khung, nên phải lưu phương pháp cùng số đo. |

## Làm việc với AI

Chia công việc theo tiêu chí nghiệm thu và yêu cầu Codex chạy cùng lệnh mà người chấm sẽ sử dụng. Kết quả tốt nhất khi mỗi thay đổi có đầu vào nhỏ và đầu ra kiểm được. Ví dụ, kịch bản bình minh kết hợp đủ ba ca: đèn tắt rồi thắp lại, châm dầu và Bóng Mực hút, sau đó kiểm chính xác lý do kết thúc và điểm. Một lệnh có thể tái lập nguyên tệp JSONL từ tag tương ứng.

AI ban đầu lấy mặt đất cao nhất dưới tọa độ XZ cho Đêm 3, khiến Mây rơi ở tâm dù điểm xuất phát chuẩn là tầng dưới. Chạy test gió từ gốc và xem tọa độ từng tick đã khoanh vùng lỗi. Sau khi sửa tìm mặt đỡ dưới chân, giữ lại test ấy. Một ca kiểm vách lại vô tình đặt Mây trong bán kính bục nhảy. So log với bố trí map cho thấy test sai thiết lập. Dời scenario khỏi bục giúp kiểm riêng hành vi đi khỏi vách.

Khi thay luật ở Phase 3, kỳ vọng thắng sớm và điểm theo thời gian trở nên sai. Tôi giữ các kiểm tra nhặt/nạp và thắng/thua, sửa chúng để chờ đúng tick bình minh, thêm trường hợp đèn cạn ngay trước quyết định và trường hợp Mây hết Ngọn Lửa ngay ở tick cuối. Sau đó kiểm tra Chrome xác nhận phần giao diện dùng cùng luật.

## Harness và cách dùng token

`AGENTS.md` có ích nhất vì giữ những điểm dễ quên: logic chung, đơn vị tick, lệnh CLI và cách lưu bằng chứng. Hook kiểm tra trước push bao gồm test/build. Workflow phát hành chạy lại chúng từ checkout sạch. Script Chrome kiểm tra các luồng khó nhìn qua CLI, gồm chuyển đêm, cài đặt sau reload, đổi phím trùng, chữ lớn và bảng xếp hạng.

| Phase | Token đầu ra ước tính từ phần mã, test và ghi chép lưu trong Git |
|---|---:|
| 1 | ~13.600 |
| 2 | ~16.400 |
| 3 | ~7.200 |
| 4 | ~13.600 |
| **Tổng** | **~50.800** |

Ước lượng thô quy đổi 4 byte mỗi token, bỏ file khóa phụ thuộc, ảnh, video và JSONL sinh ra. Số này không đại diện cho quota, token đầu vào hay chi phí thực tế vì phiên làm việc không cung cấp số liệu đó. Dùng lại lõi, scenario và script kiểm tra giúp giảm lượt nhắc. Khi thấy lỗi, tập trung vào trace ngắn của ca đó rồi chạy hồi quy đầy đủ thay vì hỏi AI đọc lại toàn repo.

Nếu làm lại, tôi sẽ dựng kiểm tra Chrome và phương án phát hành ngay từ đêm đầu, thêm fixture va chạm có nhiều tầng trước khi vẽ đảo, và định kỳ đo một scene tải lớn. Tôi cũng sẽ ghi số usage ngay sau mỗi phase để có ước lượng chi phí tốt hơn.
