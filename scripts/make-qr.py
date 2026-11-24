# يولّد رمز QR لرابط الموقع (مستوى تصحيح H) بصيغتي SVG وPNG، مع شعار النادي وبدونه، ثم يتحقق بقراءته.
# ليس جزءًا من بناء Node: يحتاج Python مع opencv-python وPillow (موجودان على جهاز عمرو).
# الاستخدام: python scripts/make-qr.py [المجلد=qr] [الرابط] [اسم الملف]
#   python scripts/make-qr.py qr https://dsc-name-quote.vercel.app/game.html dsc-game-qr
# QR for the DSC name-card site: OpenCV encoder (level H), our own quiet zone, optional DSC step mark in the centre.
import sys, cv2, numpy as np
from PIL import Image, ImageDraw

OUT = sys.argv[1] if len(sys.argv) > 1 else 'qr'
URL = sys.argv[2] if len(sys.argv) > 2 else 'https://dsc-name-quote.vercel.app'
BASE = sys.argv[3] if len(sys.argv) > 3 else 'dsc-name-quote-qr'
INK, BG, EMBER = '#111111', '#FFFFFF', '#EB5A33'
QUIET = 4          # modules of white border (spec minimum)
PX = 50            # pixels per module in the PNG

p = cv2.QRCodeEncoder.Params()
p.correction_level = cv2.QRCodeEncoder_CORRECT_LEVEL_H
p.mode = cv2.QRCodeEncoder_MODE_BYTE
raw = cv2.QRCodeEncoder.create(p).encode(URL) < 128
rows, cols = np.where(raw)
M = raw[rows.min():rows.max() + 1, cols.min():cols.max() + 1]
n = M.shape[0]
S = n + 2 * QUIET
assert M.shape == (n, n)

# official step mark (icon-ink.svg), bounding box 98.84,20.15 114.63x140.61
PTS = [tuple(map(float, p.split(','))) for p in '175.57,76.08 175.57,48.12 137.68,48.12 137.68,20.15 98.84,20.15 98.84,48.52 136.74,48.52 136.74,76.49 174.64,76.49 174.64,104.42 136.74,104.42 136.74,132.39 98.84,132.39 98.84,160.76 137.68,160.76 137.68,132.79 175.57,132.79 175.57,104.83 213.47,104.83 213.47,104.46 213.47,76.46 213.47,76.08'.split()]
BX, BY, BW, BH = 98.84, 20.15, 114.63, 140.61
BOX = 7                       # white box, in modules (centre, clear of finder/alignment patterns)
b0 = QUIET + (n - BOX) / 2    # box top-left in module units
MARK_H = 5.2
ms = MARK_H / BH
mx = QUIET + n / 2 - BW * ms / 2
my = QUIET + n / 2 - MARK_H / 2
mark = [(mx + (x - BX) * ms, my + (y - BY) * ms) for x, y in PTS]

def write(name, logo):
    # SVG in module units
    d = ''.join(f'M{c + QUIET} {r + QUIET}h1v1h-1z' for r, c in zip(*np.where(M)))
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" shape-rendering="crispEdges">',
           f'<rect width="{S}" height="{S}" fill="{BG}"/>', f'<path fill="{INK}" d="{d}"/>']
    if logo:
        svg.append(f'<rect x="{b0:g}" y="{b0:g}" width="{BOX}" height="{BOX}" fill="{BG}"/>')
        svg.append('<polygon fill="{}" shape-rendering="geometricPrecision" points="{}"/>'.format(EMBER, ' '.join(f'{x:.3f},{y:.3f}' for x, y in mark)))
    svg.append('</svg>')
    open(f'{OUT}/{name}.svg', 'w', encoding='utf-8', newline='\n').write(''.join(svg))
    # PNG, whole pixels per module
    img = Image.new('RGB', (S * PX, S * PX), BG)
    dr = ImageDraw.Draw(img)
    for r, c in zip(*np.where(M)):
        x, y = (c + QUIET) * PX, (r + QUIET) * PX
        dr.rectangle([x, y, x + PX - 1, y + PX - 1], fill=INK)
    if logo:
        dr.rectangle([b0 * PX, b0 * PX, (b0 + BOX) * PX - 1, (b0 + BOX) * PX - 1], fill=BG)
        dr.polygon([(x * PX, y * PX) for x, y in mark], fill=EMBER)
    img.save(f'{OUT}/{name}.png', optimize=True)
    return f'{OUT}/{name}.png'

def read(im):
    # قارئان: الكلاسيكي يتعثر حين تقع الوحدة على نصف بكسل بالضبط في الصور المصطنعة، وAruco أمتن؛ يكفي أحدهما
    return {cv2.QRCodeDetector().detectAndDecode(im)[0], cv2.QRCodeDetectorAruco().detectAndDecode(im)[0]}

def decode(path):
    img = cv2.imread(path)
    out = {}
    for label, scale in [('full', 1.0), ('25%', 0.25), ('10%', 0.10)]:
        im = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale != 1 else img
        out[label] = URL in read(im)
    blur = cv2.GaussianBlur(cv2.resize(img, None, fx=0.25, fy=0.25, interpolation=cv2.INTER_AREA), (5, 5), 0)
    out['25%+blur'] = URL in read(blur)
    # مسح الأحجام من 8% إلى 60% مع تمويه وضغط JPEG (أقرب إلى كاميرا جوال)
    fails = []
    for s in range(8, 61):
        im = cv2.resize(img, None, fx=s / 100, fy=s / 100, interpolation=cv2.INTER_AREA)
        _, enc = cv2.imencode('.jpg', cv2.GaussianBlur(im, (3, 3), 0), [cv2.IMWRITE_JPEG_QUALITY, 60])
        if URL not in read(im) or URL not in read(cv2.imdecode(enc, 1)): fails.append(s)
    out['sweep 8-60%'] = 'all' if not fails else f'fails at {fails}'
    return out

print('modules:', n, 'version:', (n - 17) // 4, 'level: H', 'logo box share: %.1f%%' % (100 * BOX * BOX / (n * n)))
print('url:', URL)
for name, logo in [(BASE, True), (BASE + '-plain', False)]:
    png = write(name, logo)
    print(name, decode(png))
