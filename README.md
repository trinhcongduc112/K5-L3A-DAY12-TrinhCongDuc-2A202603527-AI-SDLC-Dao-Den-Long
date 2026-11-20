# Đảo Đèn Lồng

Game 3D góc nhìn thứ ba. Mây nhặt đom đóm, thắp năm chiếc đèn và dùng Tỏa Sáng để tránh Bóng Mực trên Đảo Bến.

## Cài và chơi

Cần Node.js 20 trở lên và trình duyệt có WebGL 2 trên Linux hoặc macOS.

```sh
npm ci
npm run dev
```

Mở địa chỉ Vite in ra. Dùng WASD hoặc phím mũi tên để di chuyển, Space để nhảy, kéo chuột để xoay góc nhìn, E để nạp đom đóm và Q để Tỏa Sáng. Sau khi hết thời gian, mất hết Ngọn Lửa hoặc thắp đủ đèn, dùng nút Chơi lại.

Mỗi đom đóm nhặt được cho 10 điểm, mỗi đèn thắp được cho 100 điểm và mỗi Bóng Mực bị choáng cho 5 điểm. Khi thắng, nhận thêm 2 điểm mỗi giây còn lại (làm tròn xuống) và 50 điểm mỗi Ngọn Lửa còn lại.

## Kiểm chứng

```sh
npm test
npm run build
node src/headless.js --seed 42 --night 1 --scenario tests/fixtures/phase1-win.json --inputs tests/fixtures/phase1-win-inputs.json --ticks 120 --out /tmp/lantern.jsonl
```

`game.contract.json` khai báo contract v1.0 và tuning của bản này. Mây được giữ ở mép đảo trong Đêm 1, nên `fall_enabled` là `false`. Xem [ghi chép Phase 1](docs/notes/phase-1.md) và [bằng chứng](docs/proof/phase-1.md) để đối chiếu.

## Sáng tạo của tôi

Biển mây, sao, trăng và hiệu ứng đom đóm lơ lửng tạo cảnh đêm. Các hiệu ứng nằm ở phần hiển thị. Test tất định của headless có thể chạy lại bằng `npm test`.

[Xem tài liệu lab](LAB.md) · [Nguồn nội dung](CREDITS.md)
