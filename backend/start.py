"""Simple startup script that loads .env and starts uvicorn."""
import os
from pathlib import Path

def load_env():
    env_file = Path(__file__).parent / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip("'\""))

if __name__ == "__main__":
    load_env()
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False, app_dir=str(Path(__file__).parent))
