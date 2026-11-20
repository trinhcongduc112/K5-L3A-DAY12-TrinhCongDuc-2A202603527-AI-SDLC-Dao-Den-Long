# Bằng chứng Phase 1

Đã chạy với Node.js v22.12.0 trên Linux. `npm test` trả về 8/8 đạt, `npm run build` tạo được bản tĩnh. Bài kiểm tra CLI dùng tiến trình riêng với các JSON tạm, gồm chuyển động/camera, nhảy, nhặt/nạp, thắng, thua, Tỏa Sáng, chạm và kiểm tra từng byte của hai kết quả chạy lại.

```sh
node src/headless.js --seed 42 --night 1 --scenario tests/fixtures/phase1-win.json --inputs tests/fixtures/phase1-win-inputs.json --ticks 120 --out /tmp/phase-1-win.jsonl
diff -u docs/proof/phase-1-win.jsonl /tmp/phase-1-win.jsonl
```

[Kết quả JSONL](phase-1-win.jsonl) ghi đom đóm được nhặt từ bước đầu, 5 đom đóm được nạp ở tick 16, L1 sáng và Đêm 1 thắng với 618 điểm. Bốn đèn còn lại được dựng sẵn trong scenario và không cộng điểm.

Chrome 154 ở 1280×720 với SwiftShader đã mở menu, vào Đêm 1, nhận phím di chuyển và nhảy, hiển thị HUD và chạy đồng hồ. Kiểm tra qua DevTools không thấy ngoại lệ JavaScript. [Ảnh từ lần chạy](phase-1-game.jpg). Kết quả thắng và thua ở trên do CLI kiểm chứng.
