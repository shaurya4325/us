# Original 16x16 pixel textures for the blocky UI theme (procedural, no third-party art).
#   python -I tools/make_blocks.py  -> src/ui-tex/*.png
import os, random
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'ui-tex')
os.makedirs(OUT, exist_ok=True)

def save(name, px, w=16, h=16):
    im = Image.new('RGBA', (w, h))
    im.putdata(px)
    im.save(os.path.join(OUT, name + '.png'))

def noise(base, spread, seed, specks=()):
    r = random.Random(seed); out = []
    for i in range(256):
        k = r.uniform(-spread, spread)
        c = tuple(max(0, min(255, int(v + k))) for v in base)
        for chance, col in specks:
            if r.random() < chance: c = col
        out.append(c + (255,))
    return out

# stone: grey with darker cracks
save('stone', noise((112, 108, 120), 14, 1, [(0.07, (82, 78, 90)), (0.04, (140, 136, 148))]))
# dark stone for panels
save('slate', noise((52, 40, 56), 8, 2, [(0.06, (38, 28, 42)), (0.04, (70, 56, 74))]))
# dirt
save('dirt', noise((121, 85, 58), 12, 3, [(0.08, (92, 64, 44)), (0.05, (150, 110, 80))]))
# planks: 4 horizontal boards with seams and nail dots
r = random.Random(4); px = []
for y in range(16):
    for x in range(16):
        board = y // 4
        base = [(176, 128, 82), (164, 118, 74), (182, 134, 88), (170, 122, 78)][board]
        k = r.uniform(-8, 8) + (6 if (x + board * 5) % 9 == 0 else 0)
        c = tuple(int(max(0, min(255, v + k))) for v in base)
        if y % 4 == 3: c = (110, 76, 46)
        if (x == (board * 7 + 3) % 16) and y % 4 != 3: c = (128, 90, 56)
        px.append(c + (255,))
save('planks', px)
# grass top: green over dirt with a ragged edge
r = random.Random(5); px = []
dirt = noise((121, 85, 58), 12, 6, [(0.08, (92, 64, 44))])
for y in range(16):
    for x in range(16):
        edge = 4 + (r.random() < 0.5) + (x % 3 == 0)
        if y < edge:
            k = r.uniform(-14, 14)
            px.append((int(110 + k), int(190 + k), int(90 + k), 255))
        else: px.append(dirt[y * 16 + x])
save('grass', px)
# rose block: soft pink with deeper speckles (the "us!!" accent block)
save('rose', noise((236, 98, 150), 12, 7, [(0.07, (200, 60, 116)), (0.05, (255, 160, 200))]))
# slot: inventory slot tile (dark inset)
px = []
for y in range(16):
    for x in range(16):
        c = (60, 48, 62)
        if x == 0 or y == 0: c = (34, 26, 36)
        if x == 15 or y == 15: c = (120, 108, 124)
        px.append(c + (255,))
save('slot', px)
print('blocks ok')

# hearts: transparent tile with two soft pixel hearts (checker offset) for the love-themed menu background
HEART = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"]
px = [(0, 0, 0, 0)] * 256
def heart(ox, oy, col):
    for y, row in enumerate(HEART):
        for x, c in enumerate(row):
            if c == '1': px[(oy + y) * 16 + ox + x] = col
heart(1, 1, (255, 150, 200, 70)); heart(9, 9, (255, 110, 170, 45))
save('hearts', px)
print('hearts ok')
