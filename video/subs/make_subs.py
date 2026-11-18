# Build word-timed, Shorts-style ASS captions from the sentence timings of the Kokoro voiceover.
# Word times inside a sentence are spread by syllable weight, with extra time after commas.
import json, re, sys
L = json.load(open(sys.argv[1]))["lines"]
out = sys.argv[2]

def syl(w):
    w = re.sub(r"[^a-z]", "", w.lower())
    n = len(re.findall(r"[aeiouy]+", w))
    if w.endswith("e") and not w.endswith(("le", "ee")) and n > 1: n -= 1
    return max(1, n)

words = []
for ln in L:
    toks = ln["text"].split()
    wts = [syl(t) + 0.35 + (0.9 if t[-1] in ",;:" else 0) for t in toks]
    tot, t0, dur = sum(wts), ln["start"], ln["end"] - ln["start"]
    acc = 0
    for t, wt in zip(toks, wts):
        s = t0 + dur * acc / tot; acc += wt
        e = t0 + dur * (acc - (0.9 if t[-1] in ",;:" else 0)) / tot
        words.append(dict(w=t, s=s, e=e, end_sent=False))
    words[-1]["end_sent"] = True

# show the year as digits
i = 0
while i < len(words) - 1:
    if words[i]["w"].lower() == "thirteen" and words[i+1]["w"].lower().startswith("eighty-six"):
        words[i] = dict(w="1386" + words[i+1]["w"][len("eighty-six"):], s=words[i]["s"], e=words[i+1]["e"], end_sent=words[i+1]["end_sent"])
        del words[i+1]
    i += 1

# chunks of up to 3 words that fit the frame: measured in the real font (uppercase, 110 px, 10 px outline, 112 % pop)
from PIL import ImageFont
FONT = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf", 110)
MAXW = 820  # 1080 frame - 2 x 50 margins, less the pop-in scale and outline
width = lambda ws: FONT.getlength(" ".join(x["w"].upper() for x in ws)) + 20
chunks, cur = [], []
for w in words:
    if cur and width(cur + [w]) > MAXW:
        chunks.append(cur); cur = []
    cur.append(w)
    if w["end_sent"] or w["w"][-1] in ",;:" or len(cur) == 3:
        chunks.append(cur); cur = []
if cur: chunks.append(cur)

def ts(t):
    t = max(0, t); h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"

hdr = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Inter ExtraBold,110,&H00FFFFFF,&H00FFFFFF,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,1,10,4,2,50,50,560,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
YEL = r"{\c&H2BD7FF&}"; WHT = r"{\c&HFFFFFF&}"
ev = []
for ci, ch in enumerate(chunks):
    nxt = chunks[ci + 1][0]["s"] if ci + 1 < len(chunks) else ch[-1]["e"] + 0.6
    cend = min(nxt, ch[-1]["e"] + 0.35)
    for wi, w in enumerate(ch):
        s = w["s"]; e = ch[wi + 1]["s"] if wi + 1 < len(ch) else cend
        txt = " ".join((YEL + x["w"].upper() + WHT) if j == wi else x["w"].upper() for j, x in enumerate(ch))
        fit = min(1.0, MAXW / width(ch))  # a single very long word shrinks to fit
        fs = rf"{{\fs{round(110 * fit)}}}" if fit < 1 else ""
        pop = fs + (r"{\fscx112\fscy112\t(0,90,\fscx100\fscy100)}" if wi == 0 else "")
        ev.append(f"Dialogue: 0,{ts(s)},{ts(e)},Cap,,0,0,0,,{pop}{txt}")
open(out, "w").write(hdr + "\n".join(ev) + "\n")
# plain SRT too
def st(t): return f"{int(t//3600):02d}:{int(t%3600//60):02d}:{int(t%60):02d},{int(round(t%1*1000))%1000:03d}"
srt = []
for i, ch in enumerate(chunks, 1):
    nxt = chunks[i][0]["s"] if i < len(chunks) else ch[-1]["e"] + 0.6
    srt.append(f"{i}\n{st(ch[0]['s'])} --> {st(min(nxt, ch[-1]['e'] + 0.35))}\n{' '.join(x['w'] for x in ch)}\n")
open(out.replace(".ass", ".srt"), "w").write("\n".join(srt))
print(len(chunks), "chunks,", len(words), "words")
