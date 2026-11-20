# Đảo Đèn Lồng

- Cài với `npm ci`, chạy bản 3D với `npm run dev`, kiểm tra với `npm test` và `npm run build`.
- `src/game.js` là logic dùng chung cho trình duyệt và CLI. Giữ fixed step 60 Hz, seed và ID tất định, độc lập với thời gian thực/đồ họa.
- Giao thức và thông số đã khai báo nằm trong `game.contract.json`. Thử CLI trực tiếp như người chấm khi thay đổi giao thức.
- Nêu tiêu chí nghiệm thu trước khi sửa. Chạy test và lưu kết quả thật vào `docs/proof/`. Ghi trường hợp chưa đạt và thay đổi yêu cầu trong `docs/notes/`.
- Bật chốt kiểm chứng khi push bằng `git config core.hooksPath .githooks`. Sửa nguyên nhân khi test đỏ và chạy lại.
- Không commit bí mật. Ghi nguồn mọi nội dung bên ngoài hoặc do AI tạo trong CREDITS.md.

## Từ Phase 2

- Tuning chuẩn nằm trong `game.contract.json`, bản đồ trong `src/world.js`. `Game.step` giữ nguyên thứ tự xử lý của Ticket-02.
- Kiểm tra pause qua cả `tick` và `sim_tick`. Khi đổi xử lý va chạm, chạy lại scenario bục, vực, tầng Đêm 3, vùng sáng và Gió Lạc.
- Dùng `docs/proof/phase-2.md` để chạy bài đo dài và kiểm tra Chrome. Chỉ ghi số liệu đo được cùng cấu hình.

## Từ Phase 3

- Lưu dầu theo đơn vị nguyên 1/60 và chỉ làm tròn tại đầu ra. Bước trừ dầu và tắt đèn chạy trước tương tác. Giữ phép kiểm tra bình minh ở cuối tick.
- Khi thay đổi đèn, chạy scenario ở `docs/proof/phase-3.md`. So lại ngưỡng 30, điểm bình minh, thứ tự thắng/thua và màu cảnh báo sau khi reload.

## Từ Phase 4

- Chạy `npm test`, `npm run build` và các lệnh trong `docs/proof/phase-4.md`. Dùng thư mục dữ liệu thử qua `DAO_DEN_LONG_DATA_DIR` khi kiểm thử xếp hạng.
- Benchmark dùng renderer chung. Giữ scene chuẩn, cửa sổ 1280×720 và cửa sổ đo tách khỏi warm-up. Đừng lưu số từ lần đo thử ngắn vào `bench.json`.
- `scripts/package-release.py` đóng gói bản đã build. Workflow chỉ tạo bản bàn giao khi push tag phát hành `v1.0.0`.
