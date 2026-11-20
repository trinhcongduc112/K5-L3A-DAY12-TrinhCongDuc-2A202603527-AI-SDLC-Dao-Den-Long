# Bằng chứng Phase 3

## Kiểm thử

`npm test` đạt **34/34** với Node.js 22.12.0 trên Linux. Test cũ thay kỳ vọng theo Ticket-03 được liệt kê trong [ghi chép thiết kế](../notes/phase-3.md). Test mới bao phủ thắp lại, nạp dầu, điểm, sức chứa, hút cộng dồn, tạm dừng, ranh giới 30 dầu và ngưỡng bình minh của ba đêm. `npm run build` tạo bản web tĩnh.

## Tái lập thắng ở bình minh

```sh
node src/headless.js --seed 42 --night 1 --scenario tests/fixtures/phase3-dawn.json --inputs tests/fixtures/phase3-dawn-inputs.json --ticks 65 --out /tmp/phase-3-dawn.jsonl
cmp docs/proof/phase-3-dawn.jsonl /tmp/phase-3-dawn.jsonl
```

Trong [JSONL thực tế](phase-3-dawn.jsonl), L1 cạn và được thắp lại ở tick 3, L2 nhận hai đom đóm để châm dầu ở tick 12, S1 báo hút dầu ở tick 60. Mây giành **524 điểm** và thắng với lý do `dawn_survived` ở tick 65 khi có đủ 3 đèn sáng.

## Trình duyệt

[Ảnh kiểm tra bằng Chrome](phase-3-game.jpg) dựng một đèn yếu, một đèn tắt và một Bóng Mực. Ảnh cho thấy thanh dầu, giấy rách và hình xẹp của đèn tắt, viền/mắt xanh, đồng hồ cảnh báo trắng có biểu tượng và sức chứa 5/12. Script xác nhận phím E châm dầu đổi HUD thành 0/12, chế độ màu còn bật sau reload, và cả ba đêm chuyển được qua luật bình minh bằng scenario kiểm tra trong bộ nhớ. Có 0 ngoại lệ JavaScript trong [kết quả Chrome](phase-3-browser.json).

Khung hình lấy mẫu ở đầu mỗi đêm đạt khoảng 60 FPS ở framebuffer 1280×720, Chrome 154 và Intel Iris Xe qua ANGLE. Chạy lại trong môi trường như phần Chrome ở Phase 2, từ phiên bản Phase 3, bằng lệnh dưới đây.

```sh
GAME_CHECK_PORT=9331 GAME_CHECK_FUEL_SCREENSHOT=/tmp/phase-3-game.jpg node scripts/check-browser.mjs
```

## Hiệu năng headless

```sh
time node src/headless.js --seed 42 --night 3 --scenario tests/fixtures/phase2-endurance.json --ticks 18000 --out /tmp/phase-3-bench.jsonl
tail -1 /tmp/phase-3-bench.jsonl
```

Trên Intel Core i5-12500H, Đêm 3 mới chạy đủ 18.000 tick trong **0,916 giây**. Scenario duy trì miễn nhiễm va chạm để đo đủ thời lượng, vẫn chạy sinh thực thể, gió và hao dầu. Trạng thái cuối là `lost` vì người chơi đứng yên đến bình minh.
