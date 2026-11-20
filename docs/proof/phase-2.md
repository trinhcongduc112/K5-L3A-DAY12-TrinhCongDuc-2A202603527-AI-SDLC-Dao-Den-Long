# Bằng chứng Phase 2

## Test và hồi quy

`npm test` đạt 24/24 với Node.js 22.12.0 trên Linux. Tám bài kiểm tra gốc được chạy lại với tuning và công thức điểm chuẩn. Các bài mới bao phủ cấu hình ba map, thứ tự xử lý và lịch sinh, Lướt, rơi/hồi sinh, Tỏa Sáng 3D, vùng an toàn, Gió Lạc, Bùa Gió, cầu, bục, vách, dốc, tháp, gió mạnh và dữ liệu không hợp lệ. `npm run build` tạo thành công bản web tĩnh.

```sh
node src/headless.js --seed 42 --night 2 --scenario tests/fixtures/phase2-abilities.json --inputs tests/fixtures/phase2-abilities-inputs.json --ticks 24 --out /tmp/phase-2-abilities.jsonl
cmp docs/proof/phase-2-abilities.jsonl /tmp/phase-2-abilities.jsonl
```

[Kết quả JSONL nguyên bản](phase-2-abilities.jsonl) ghi nhặt bùa và bị cướp ở tick 1, lấy lại đom đóm khi Tỏa Sáng ở tick 2, tạm dừng ở tick 3, tiếp tục ở tick 9 và Lướt ở tick 10. `sim_tick` ở cuối thấp hơn `tick` sáu bước.

## Đo headless

```sh
time node src/headless.js --seed 42 --night 3 --scenario tests/fixtures/phase2-endurance.json --ticks 21600 --out /tmp/phase-2-endurance.jsonl
tail -1 /tmp/phase-2-endurance.jsonl
```

Đo trên Linux, Intel Core i5-12500H, Node.js 22.12.0. Lần đo ghi `real 1.257s` và 2.174 dòng. Scenario giữ miễn nhiễm sát thương để chạy đủ thời gian. Spawn và gió vẫn được bật. Bản ghi cuối là `{"type":"end","ticks":21600,"state":"lost","score":0}`, đúng với kết thúc đêm do hết giờ.

## Đo và kiểm tra bản 3D

Chrome 154, GPU Intel Iris Xe ADL GT2 qua ANGLE Mesa OpenGL 4.6, Linux, framebuffer WebGL 1.280 × 720. Ở đầu mỗi đêm, lấy mẫu 331 khung trong khoảng 5,52 giây, xấp xỉ **60 FPS trung bình cho cả ba đêm**. Đây là số đo trên cấu hình này, trong đoạn chơi đầu mỗi đêm.

| Đêm | Ảnh lúc kiểm tra | FPS trung bình |
|---|---|---:|
| 1 | [Đảo Bến](phase-2-game.jpg) | 60,0 |
| 2 | [Đảo Cau](phase-2-game-night2.jpg) | 60,0 |
| 3 | [Đảo Chuông](phase-2-game-night3.jpg) | 60,0 |

Script Chrome mở game, thử bàn phím, tạm dừng, đổi âm lượng, kiểm tra lưu qua reload và chơi lại. Để kiểm tra luồng chuyển màn, script thắp sẵn đèn **trong phiên kiểm thử trình duyệt** rồi chạy logic thắng thật. Script đi qua đủ ba màn và thấy Bình Minh cùng tổng điểm. Chrome ghi 0 ngoại lệ JavaScript. Chưa kiểm tra bằng cách nghe trực tiếp từ loa.

Có thể tái lập trên Linux với Node.js 22+, ba terminal và bản dev. Với Chrome dùng cấu hình GPU khác, điều chỉnh tham số đồ họa của Chrome cho phù hợp.

```sh
npm run dev -- --host 127.0.0.1
```

```sh
google-chrome --headless=new --remote-debugging-port=9331 --user-data-dir="$(mktemp -d)" --use-gl=angle --use-angle=gl about:blank
```

```sh
GAME_CHECK_PORT=9331 node scripts/check-browser.mjs
```
