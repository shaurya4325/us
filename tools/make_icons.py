"""Generates launcher icons, notification icon and splash screens into android/app/src/main/res.
   python -I tools/make_icons.py android/app/src/main/res"""
import os, sys, math
from PIL import Image, ImageDraw, ImageFilter

res = sys.argv[1]
BG1, BG2, PINK, ROSE = (11, 5, 9), (58, 15, 39), (255, 62, 138), (245, 163, 199)

def heart_poly(cx, cy, s, n=200):
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * s / 17, cy - y * s / 17))
    return pts

def art(size, bg=True, pad=0.0):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    if bg:
        for y in range(size):  # vertical plum gradient
            k = y / size
            ImageDraw.Draw(im).line([(0, y), (size, y)], fill=tuple(int(BG2[i] * (1 - k) + BG1[i] * k) for i in range(3)) + (255,))
    s = size * (0.30 - pad)
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(glow).polygon(heart_poly(size / 2, size / 2, s * 1.1), fill=PINK + (170,))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(size / 14)))
    d = ImageDraw.Draw(im)
    d.polygon(heart_poly(size / 2, size / 2, s), fill=PINK + (255,))
    d.polygon(heart_poly(size / 2 - s * 0.25, size / 2 - s * 0.2, s * 0.32), fill=ROSE + (150,))
    return im

dens = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for dn, k in dens.items():
    d = os.path.join(res, f'mipmap-{dn}'); os.makedirs(d, exist_ok=True)
    L = int(48 * k)
    sq = art(L * 4).resize((L, L), Image.LANCZOS)
    sq.save(os.path.join(d, 'ic_launcher.png'))
    m = Image.new('L', (L * 4, L * 4), 0); ImageDraw.Draw(m).ellipse([0, 0, L * 4, L * 4], fill=255)
    rd = sq.copy(); rd.putalpha(m.resize((L, L), Image.LANCZOS)); rd.save(os.path.join(d, 'ic_launcher_round.png'))
    F = int(108 * k)
    art(F * 4, bg=False, pad=0.08).resize((F, F), Image.LANCZOS).save(os.path.join(d, 'ic_launcher_foreground.png'))
    # white silhouette for the status bar
    nd = os.path.join(res, f'drawable-{dn}'); os.makedirs(nd, exist_ok=True)
    N = int(24 * k); n = Image.new('RGBA', (N * 4, N * 4), (0, 0, 0, 0))
    ImageDraw.Draw(n).polygon(heart_poly(N * 2, N * 2.05, N * 1.7), fill=(255, 255, 255, 255))
    n.resize((N, N), Image.LANCZOS).save(os.path.join(nd, 'ic_stat_heart.png'))

# adaptive icon background colour
open(os.path.join(res, 'values', 'ic_launcher_background.xml'), 'w').write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#2A0B1E</color>\n</resources>\n')

# splash screens: replace every existing splash.png with plum + glowing heart
for root, _, files in os.walk(res):
    for f in files:
        if f == 'splash.png':
            p = os.path.join(root, f); w, h = Image.open(p).size
            sp = Image.new('RGBA', (w, h), BG1 + (255,))
            a = art(min(w, h) // 2, bg=False)
            sp.alpha_composite(a, ((w - a.width) // 2, (h - a.height) // 2))
            sp.convert('RGB').save(p)
print('icons ok')
