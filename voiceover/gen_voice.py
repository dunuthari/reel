import sys, json, re
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
script_path, out_wav, out_json = sys.argv[1:4]
voice, speed = "am_michael", float(sys.argv[4]) if len(sys.argv) > 4 else 1.15
paras = [p.strip() for p in open(script_path, encoding="utf-8").read().split("\n\n") if p.strip()]
k = Kokoro("/root/kokoro-models/kokoro-v1.0.onnx", "/root/kokoro-models/voices-v1.0.bin")
sr = 24000; chunks = []; t = 0.0; lines = []
def trim(a, thr=0.008):
    idx = np.where(np.abs(a) > thr)[0]
    if len(idx) == 0: return a
    s = max(0, idx[0] - int(0.02*sr)); e = min(len(a), idx[-1] + int(0.05*sr))
    return a[s:e]
for pi, p in enumerate(paras):
    sents = re.split(r'(?<=[.!?])\s+', p)
    for si, s in enumerate(sents):
        a, sr = k.create(s, voice=voice, speed=speed, lang="en-us")
        a = trim(a)
        lines.append({"para": pi, "sent": si, "text": s, "start": round(t, 3), "end": round(t + len(a)/sr, 3)})
        chunks.append(a); t += len(a)/sr
        gap = 0.32 if si == len(sents)-1 else 0.14
        if not (pi == len(paras)-1 and si == len(sents)-1):
            chunks.append(np.zeros(int(sr*gap), dtype=a.dtype)); t += gap
full = np.concatenate(chunks)
sf.write(out_wav, full, sr)
json.dump({"duration": round(len(full)/sr, 3), "lines": lines}, open(out_json, "w"), indent=1)
print(f"{len(full)/sr:.2f}s, {len(lines)} sentences")
for l in lines: print(f'{l["start"]:6.2f}-{l["end"]:6.2f} p{l["para"]} {l["text"]}')
