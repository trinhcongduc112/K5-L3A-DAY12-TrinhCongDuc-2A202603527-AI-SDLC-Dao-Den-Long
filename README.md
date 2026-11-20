# Đảo Đèn Lồng

Game 3D góc nhìn thứ ba. Theo chân Mây qua Đảo Bến, Đảo Cau và Đảo Chuông. Nhặt đom đóm, thắp đèn và giữ đủ đèn sáng đến bình minh.

## Cài và chơi

Cần Node.js 20 trở lên, npm và trình duyệt có WebGL 2 trên Linux hoặc macOS.

```sh
npm ci
npm run dev
```

Mở địa chỉ Vite in ra.

| Điều khiển | Hành động |
|---|---|
| WASD hoặc phím mũi tên | Chạy |
| Kéo chuột | Xoay góc nhìn |
| Space | Nhảy |
| Shift | Lướt |
| E | Nạp đom đóm vào đèn tắt hoặc châm dầu cho đèn đang sáng |
| Q | Tỏa Sáng |
| Esc hoặc P | Tạm dừng hoặc tiếp tục |

Đèn hao dầu theo thời gian. Dưới 30 dầu, đèn nhấp nháy, mất vùng an toàn và có thể bị Bóng Mực hút dầu. Đèn tắt cần 10 đom đóm để thắp lần đầu và 5 đom đóm để thắp lại. Khi bình minh, Mây cần còn Ngọn Lửa và giữ sáng ít nhất 3/5, 4/6 hoặc 5/7 đèn tùy đêm. Vào **Cài đặt → Bảng màu dễ phân biệt** để đổi màu Bóng Mực và thêm biểu tượng cảnh báo.

Nạp hoặc châm một đom đóm được 5 điểm. Thắp lần đầu được 100 điểm, thắp lại được 40 điểm. Tỏa Sáng được 5 điểm mỗi Bóng Mực trúng và 15 nếu Bóng đó đang hút dầu. Khi thắng, mỗi đèn còn sáng cho 50 điểm cộng phần nguyên của dầu, mỗi Ngọn Lửa còn lại cho 50 điểm. Tổng điểm cộng từ các đêm đã thắng.

## Kiểm chứng

```sh
npm test
npm run build
node src/headless.js --seed 42 --night 1 --scenario tests/fixtures/phase3-dawn.json --inputs tests/fixtures/phase3-dawn-inputs.json --ticks 65 --out /tmp/dao-den-long.jsonl
```

`game.contract.json` khai báo Test Contract v1.2. Xem [bằng chứng Phase 3](docs/proof/phase-3.md), [quyết định thiết kế](docs/notes/phase-3.md) và [changelog](CHANGELOG.md). Dùng tag tương ứng để tái lập [bằng chứng Phase 1](docs/proof/phase-1.md) và [bằng chứng Phase 2](docs/proof/phase-2.md).

## Sáng tạo của tôi

Biển mây, sao, trăng và đom đóm lơ lửng tạo cảnh đêm. Game dùng mô hình sinh từ mã và âm nhạc nền tổng hợp riêng cho đảo. Các hiệu ứng nằm ở phần hiển thị. Test tất định và các scenario chạy qua lõi chung bằng `npm test`.

[Tài liệu lab](LAB.md) · [Nguồn nội dung](CREDITS.md)
