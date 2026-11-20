from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parent.parent
archive_path = root / "Dao-Den-Long-v1.0.0.zip"
files = [
    root / "LICENSE",
    root / "CREDITS.md",
    root / "scripts" / "run-game.js",
    root / "scripts" / "static-server.js",
    root / "scripts" / "leaderboard-store.js",
    root / "src" / "leaderboard.js",
]
if not (root / "dist" / "index.html").is_file():
    raise SystemExit("Run npm run build before packaging.")
files.extend(path for path in (root / "dist").rglob("*") if path.is_file())

with ZipFile(archive_path, mode="w", compression=ZIP_DEFLATED) as archive:
    prefix = "Dao-Den-Long-v1.0.0/"
    for file in sorted(files):
        archive.write(file, prefix + file.relative_to(root).as_posix())
    archive.write(root / "docs" / "release-v1.0.0.md", prefix + "HUONG-DAN.md")
    archive.writestr(prefix + "package.json", '{"type":"module","engines":{"node":">=20"}}\n')

print(archive_path)
