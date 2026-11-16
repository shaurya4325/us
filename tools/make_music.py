# Renders the original ambient soundtrack for "us!!" (no samples, no copyrighted material).
#   python -I tools/make_music.py   -> public/audio/*.mp3  (needs numpy + ffmpeg on PATH)
import numpy as np, subprocess, os, sys

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(4325)

def note(m): return 440.0 * 2 ** ((m - 69) / 12)

def env(n, a, r):
    e = np.ones(n)
    a, r = int(a * SR), int(r * SR)
    if a: e[:a] = np.linspace(0, 1, a) ** 2
    if r: e[-r:] *= np.linspace(1, 0, r) ** 2
    return e

def pad(freq, dur, bright=0.3):
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for k, det in enumerate((-0.07, 0.0, 0.06)):
        f = freq * 2 ** (det / 12)
        s = np.sin(2 * np.pi * f * t + rng.random() * 6) + bright * 0.5 * np.sin(4 * np.pi * f * t) + bright * 0.2 * np.sin(6 * np.pi * f * t)
        pan = 0.5 + (k - 1) * 0.35
        out[:, 0] += s * (1 - pan); out[:, 1] += s * pan
    trem = 1 + 0.08 * np.sin(2 * np.pi * 0.17 * t + rng.random() * 6)
    return out * (env(n, dur * 0.35, dur * 0.45) * trem)[:, None] / 3

def bell(freq, dur=3.2, vol=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    s = (np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 3) + 0.2 * np.sin(2 * np.pi * freq * 5.4 * t) * np.exp(-t * 6))
    s *= np.exp(-t * 1.6) * env(n, 0.004, 0.05) * vol
    p = rng.random()
    return np.stack([s * (1 - p * 0.6), s * (0.4 + p * 0.6)], 1)

def noise_bed(n, cutoff, vol):
    w = rng.standard_normal((n, 2))
    W = np.fft.rfft(w, axis=0); f = np.fft.rfftfreq(n, 1 / SR)
    W *= (1 / (1 + (f / cutoff) ** 2))[:, None]
    s = np.fft.irfft(W, n, axis=0)
    s /= np.abs(s).max() + 1e-9
    t = np.arange(n) / SR
    return s * vol * (0.6 + 0.4 * np.sin(2 * np.pi * 0.05 * t))[:, None]

def reverb(x, secs=3.5, wet=0.45):
    n = int(secs * SR); t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t * 6.5 / secs)[:, None]
    ir[:200] *= np.linspace(0, 1, 200)[:, None]
    L = x.shape[0] + n; N = 1 << (L - 1).bit_length()
    y = np.stack([np.fft.irfft(np.fft.rfft(x[:, c], N) * np.fft.rfft(ir[:, c], N), N)[:L] for c in range(2)], 1)
    y /= np.abs(y).max() + 1e-9
    return y, wet

def place(buf, clip, at):
    i = int(at * SR); j = min(len(buf), i + len(clip))
    if i < len(buf): buf[i:j] += clip[: j - i]

def track(name, chords, scale, bar, bars, bell_rate, bright, noise, seed):
    global rng
    rng = np.random.default_rng(seed)
    total = bar * bars
    buf = np.zeros((int((total + 6) * SR), 2))
    for b in range(bars):
        ch = chords[b % len(chords)]
        for m in ch: place(buf, pad(note(m), bar * 1.5, bright) * 0.22, b * bar)
        place(buf, pad(note(ch[0] - 12), bar * 1.4, 0.05) * 0.18, b * bar)
    idx = len(scale) // 2
    t = 1.5
    while t < total - 2:
        idx = int(np.clip(idx + rng.integers(-2, 3), 0, len(scale) - 1))
        place(buf, bell(note(scale[idx]), vol=0.16 + rng.random() * 0.08), t)
        if rng.random() < 0.25: place(buf, bell(note(scale[idx] + 12), vol=0.06), t + 0.18)
        t += bell_rate * (0.5 + rng.random())
    if noise: buf[: len(buf)] += noise_bed(len(buf), noise[0], noise[1])
    wet, w = reverb(buf)
    dry = buf / (np.abs(buf).max() + 1e-9)
    mix = dry[: len(wet)] * (1 - w) if len(dry) >= len(wet) else np.pad(dry, ((0, len(wet) - len(dry)), (0, 0))) * (1 - w)
    mix = mix + wet * w
    n = int(total * SR); fade = int(5 * SR)
    loop = mix[:n].copy()
    loop[:fade] = loop[:fade] * np.linspace(0, 1, fade)[:, None] + mix[n:n + fade] * np.linspace(1, 0, fade)[:, None]  # seamless loop tail
    loop /= np.abs(loop).max() + 1e-9
    loop *= 0.82
    pcm = (loop * 32767).astype('<i2').tobytes()
    dst = os.path.join(OUT, name + '.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', '-b:a', '256k', dst], input=pcm, check=True)
    print(name, os.path.getsize(dst) // 1024, 'KB')

# key of D major pentatonic-ish, gentle open voicings
D = 62
tracks = {
    'meadow-breeze':     ([[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]], [74, 76, 78, 81, 83, 86, 88], 9.0, 20, 1.3, 0.35, (900, 0.05), 11),
    'sunset-clouds':     ([[45, 52, 57, 64], [41, 48, 53, 60], [43, 50, 55, 62], [40, 47, 52, 59]], [69, 72, 74, 76, 79, 81, 84], 10.0, 18, 1.9, 0.25, (600, 0.06), 22),
    'fireplace-rain':    ([[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]], [67, 69, 72, 74, 76, 79], 11.0, 16, 2.4, 0.15, (2400, 0.16), 33),
    'stargazing-lullaby':([[52, 59, 64, 68], [49, 56, 61, 64], [45, 52, 57, 61], [47, 54, 59, 63]], [76, 78, 80, 83, 85, 88, 90], 12.0, 15, 2.8, 0.2, (400, 0.04), 44),
}
only = sys.argv[1:]
for k, v in tracks.items():
    if not only or k in only: track(k, *v)
