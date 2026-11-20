# Đảo Đèn Lồng

- Cài với `npm ci`, chạy bản 3D với `npm run dev`, kiểm tra với `npm test` và `npm run build`.
- `src/game.js` là logic dùng chung cho trình duyệt và CLI. Giữ fixed step 60 Hz, seed và ID tất định, độc lập với thời gian thực/đồ họa.
- Giao thức và thông số đã khai báo nằm trong `game.contract.json`. Thử CLI trực tiếp như người chấm khi thay đổi giao thức.
- Nêu tiêu chí nghiệm thu trước khi sửa. Chạy test và lưu kết quả thật vào `docs/proof/`. Ghi trường hợp chưa đạt và thay đổi yêu cầu trong `docs/notes/`.
- Bật chốt kiểm chứng khi push bằng `git config core.hooksPath .githooks`. Sửa nguyên nhân khi test đỏ và chạy lại.
- Không commit bí mật. Ghi nguồn mọi nội dung bên ngoài hoặc do AI tạo trong CREDITS.md.
