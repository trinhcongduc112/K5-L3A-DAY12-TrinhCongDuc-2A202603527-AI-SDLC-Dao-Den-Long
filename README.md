# Đảo Đèn Lồng

Game 3D góc nhìn thứ ba. Theo chân Mây qua Đảo Bến, Đảo Cau và Đảo Chuông. Mang đom đóm về thắp đèn trước bình minh.

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
| E | Nạp đom đóm vào đèn |
| Q | Tỏa Sáng |
| Esc hoặc P | Tạm dừng hoặc tiếp tục |

Nạp một đom đóm được 10 điểm, thắp một đèn được 100 điểm và mỗi Bóng Mực trúng Tỏa Sáng được 5 điểm. Khi thắng, cộng thêm 2 điểm mỗi giây còn lại (làm tròn xuống) và 50 điểm mỗi Ngọn Lửa còn lại. Tổng điểm cộng từ các đêm đã thắng. Khi thua có thể chơi lại đêm đang chơi.

## Kiểm chứng

```sh
npm test
npm run build
node src/headless.js --seed 42 --night 2 --scenario tests/fixtures/phase2-abilities.json --inputs tests/fixtures/phase2-abilities-inputs.json --ticks 24 --out /tmp/dao-den-long.jsonl
```

`game.contract.json` khai báo Test Contract. Xem [bằng chứng Phase 1 tại tag v1.0](docs/proof/phase-1.md) và [bằng chứng Phase 2](docs/proof/phase-2.md) để tái lập kết quả. Các giả định và tiêu chí nghiệm thu ở [ghi chép Phase 1](docs/notes/phase-1.md) và [spec Phase 2](docs/notes/phase-2.md).

## Sáng tạo của tôi

Biển mây, sao, trăng và đom đóm lơ lửng tạo cảnh đêm. Game dùng mô hình sinh từ mã và âm nhạc nền tổng hợp riêng cho đảo. Các hiệu ứng nằm ở phần hiển thị. Test tất định và các scenario chạy qua lõi chung bằng `npm test`.

[Tài liệu lab](LAB.md) · [Nguồn nội dung](CREDITS.md)
