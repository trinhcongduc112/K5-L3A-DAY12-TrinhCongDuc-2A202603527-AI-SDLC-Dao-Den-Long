# Bằng chứng Phase 4

Kết quả đo ở repo dùng Intel Core i5-12500H, Intel Iris Xe ADL GT2, RAM khoảng 15,3 GiB, Linux x64 và Node.js 22.12.0. Số của giảng viên phụ thuộc máy chấm.

## Benchmark

```sh
npm run build
node scripts/bench.js --seed 42 --duration 30 --out bench.json
```

Benchmark mở Chrome ở cửa sổ 1280×720, vòng camera 15 giây. Đêm 1 có đúng 200 Bóng Mực wander và 100 đom đóm theo seed, ba đèn đầy dầu. Đếm các khoảng khung đầy đủ trong 30 giây sau 3 giây khởi động. Cùng renderer với gameplay, tắt trang trí riêng. Chrome nhận cờ tắt vsync và giới hạn khung hình.

| Chỉ số | Đo được | Ngưỡng |
|---|---:|---:|
| FPS trung bình | 836,503 | ≥ 60 |
| FPS 1% thấp | 344,875 | ≥ 30 |
| Thời gian tải | 1.376 ms | ≤ 10.000 ms |
| Thời gian khung p95 | 1,8 ms | Theo dõi |
| Khung đo | 25.094 | Theo dõi |

Đây là tốc độ vòng render khi bỏ giới hạn khung, không phải tần số quét hiển thị. `peak_mem_mb` là null vì bộ đo web không tách được RSS đáng tin cậy của trang khỏi tiến trình trình duyệt. [JSON benchmark](../../bench.json)

## Soak

```sh
npm run soak -- --seed 7 --nights 10 --out soak.json
```

Cùng một tiến trình chạy đủ 10 đêm theo seed 7–16, **0 crash**, RSS **47,777 → 56,168 MiB**, tăng khoảng **17,56%**. Các ván ngẫu nhiên kết thúc `lost` theo luật. Lần đo mất **0,947 giây**. [JSON soak](../../soak.json)

## Hồi quy, UI và bản bàn giao

- `npm test` đạt **38/38**. Bốn ca bổ sung xác minh phép tính FPS, phím trùng và lưu tùy chọn, top 10 và thứ tự hòa điểm, ghi đồng thời và xuất bảng điểm từ đĩa. Kịch bản bình minh cũ vẫn trả 524 điểm khi chạy qua contract v1.3.
- Chrome kiểm tra 18 px và 22,5 px, phím trùng bị chặn và phím mới được lưu rồi khôi phục, giảm chuyển động, châm dầu, các cảnh báo, chuyển đêm, lưu bảng điểm ở cả màn Bình Minh và màn thua. Dữ liệu thử được lưu vào thư mục riêng. Có 0 ngoại lệ JavaScript. [Kết quả Chrome](phase-4-browser.json) · [Ảnh đang chạy](phase-4-game.jpg)
- Demo MP4 dài khoảng 62 giây, 1280×720, ghi hình từ gameplay với đầu vào tự động ở seed 1200, gồm nhặt đom đóm, thắp L1, mất Ngọn Lửa, lưu tên vào bảng điểm và các số kiểm thử. [Video MP4](../demo/demo.mp4)
- Bản ZIP chứa thư mục `dist` cùng trình phục vụ cục bộ nhỏ chạy bằng Node.js, gồm cả lệnh xuất điểm. [Hướng dẫn phát hành](../release-v1.0.0.md)

Bản nguồn sạch đã cài, build và chạy bằng đúng ba lệnh trong README. Bản ZIP đã giải nén, khởi động bằng launcher và trả được HTML, JavaScript và bảng điểm. Kết quả xuất JSON từ lệnh CLI khớp dữ liệu mà launcher đọc.
