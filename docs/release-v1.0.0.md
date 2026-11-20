# Đảo Đèn Lồng v1.0.0

Mây giữ đèn sáng tới bình minh trên Đảo Bến, Đảo Cau và Đảo Chuông. Bản phát hành có bảng điểm cục bộ, gán phím, phụ đề, giảm chuyển động, chữ lớn và bảng màu dễ phân biệt.

Giải nén `Dao-Den-Long-v1.0.0.zip`, mở terminal trong thư mục vừa giải nén và chạy với Node.js 20 trở lên:

```sh
node scripts/run-game.js
```

Mở địa chỉ được in ra trong Chrome, Chromium hoặc một trình duyệt hỗ trợ WebGL 2. Đây là bản web đã build sẵn, dùng được trên macOS hoặc Linux. Để xuất điểm đã lưu:

```sh
node scripts/run-game.js --export-leaderboard out.json
```

Dùng WASD và kéo chuột để di chuyển, Space để nhảy, Shift để lướt, E để nạp hoặc châm dầu, Q để Tỏa Sáng, Esc hoặc P để tạm dừng. Mọi phím chơi có thể đổi trong Cài đặt.
