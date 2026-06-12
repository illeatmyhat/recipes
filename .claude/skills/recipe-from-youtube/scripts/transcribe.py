# Local transcription for imports — YouTube captions are unreliable for
# cooking vocabulary. A 3-way comparison (2026-06, RTX 4090) found
# faster-whisper large-v3 on GPU best for accented English when seeded with
# a food-vocab prompt (Qwen3-ASR-1.7B is a fine alternative for clean native
# audio, via its `context` param).
#
# Setup once (any Python 3.11+ venv; an existing one may live at
# ~/.venvs/qwen3-asr):
#   pip install yt-dlp faster-whisper torch --index-url https://download.pytorch.org/whl/cu128
#
# Usage:
#   yt-dlp -x --audio-format wav -o audio.wav <url>
#   python transcribe.py audio.wav -o transcript.txt \
#     --prompt "Pasta Grammar, guanciale, pecorino romano DOP, mantecatura"
#
# --prompt biases the decoder toward the dish's proper nouns: the cook's
# name, dish names, any ingredient likely to be misheard. Always supply one.
import argparse
import os

import torch

# cuDNN DLLs ship in the torch wheel — prepend its lib dir so ctranslate2
# can load them.
os.environ["PATH"] = (
    os.path.join(os.path.dirname(torch.__file__), "lib") + ";" + os.environ.get("PATH", "")
)
from faster_whisper import WhisperModel  # noqa: E402

p = argparse.ArgumentParser(description="faster-whisper large-v3 GPU transcription")
p.add_argument("audio", help="audio file (wav from yt-dlp -x)")
p.add_argument("-o", "--out", required=True, help="output transcript path")
p.add_argument("--prompt", default=None, help="food-vocab bias: names, dishes, ingredients")
p.add_argument("--language", default="en")
args = p.parse_args()

model = WhisperModel("large-v3", device="cuda", compute_type="float16")
segments, _ = model.transcribe(
    args.audio, language=args.language, vad_filter=True, initial_prompt=args.prompt
)
with open(args.out, "w", encoding="utf-8", newline="\n") as f:
    for s in segments:
        f.write(f"[{int(s.start) // 60:02d}:{int(s.start) % 60:02d}] {s.text.strip()}\n")
print("wrote", args.out)
