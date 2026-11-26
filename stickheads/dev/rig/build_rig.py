#!/usr/bin/env python3
"""Build the menu fighter's art from the Stickman-Rage-Faces pack.

    python3 dev/rig/build_rig.py <path to Stickman-Rage-Faces>

Writes  dev/src/rig_atlas.b64   one WebP atlas (clean head + eyes/mouth layers for the base face and 10 expressions),
                                inlined into the page by dev/build.py
        block1.js               the atlas map, eyelid outlines and lid colours, between the SH_RIG_DATA markers
"""
import base64, io, json, os, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage
from skimage import measure

PACK = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
A = os.path.join(PACK, 'Animation')
CEL = 512
K = 0.75                      # atlas scale vs the 512 cel: plenty for menu sizes, a third of the bytes
DARK_EYES = {'10-Delighted'}

def layers_of(fid):
    svg = open(os.path.join(A, 'Face-Cels', fid + '.svg')).read()
    out = {}
    for m in re.finditer(r'<g id="([^"]+)"[^>]*>\s*<image x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" (?:xlink:)?href="data:image/png;base64,([^"]+)"', svg):
        gid, x, y, w, h, b64 = m.groups()
        out[gid] = (int(float(x)), int(float(y)), Image.open(io.BytesIO(base64.b64decode(b64))).convert('RGBA'))
    return out

def approved_layers():
    ap = Image.open(os.path.join(A, 'Approved-Face.png')).convert('RGBA')
    a = np.array(ap)
    yy, xx = np.mgrid[0:CEL, 0:CEL]
    parts = {'eyes-left': (yy < 380) & (xx < 256), 'eyes-right': (yy < 380) & (xx >= 256), 'mouth': yy >= 380}
    out = {}
    for k, sel in parts.items():
        m = sel & (a[..., 3] > 0)
        ys, xs = np.where(m)
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        b = a.copy(); b[~sel, 3] = 0
        out[k] = (int(x0), int(y0), Image.fromarray(b[y0:y1, x0:x1]))
    return out

def poly(mask):
    """outline of a mask as a short polygon string (cel units)"""
    c = max(measure.find_contours(np.pad(mask.astype(float), 1), 0.5), key=len)
    c = measure.approximate_polygon(c, tolerance=0.9) - 1
    return 'M' + 'L'.join('%.1f %.1f' % (p[1], p[0]) for p in c[:-1]) + 'Z'

head = Image.open(os.path.join(A, 'Stickman-Clean-Head.png')).convert('RGBA').resize((CEL, CEL), Image.LANCZOS)
head_np = np.array(head).astype(float)
hm = head_np[..., 3] > 128; ys, xs = np.where(hm)
HC = [round((xs.min() + xs.max()) / 2, 1), round((ys.min() + ys.max()) / 2, 1)]
HR = round(((xs.max() - xs.min()) + (ys.max() - ys.min())) / 4, 1)

reg = json.load(open(os.path.join(A, 'Registration.json')))
faces = [('base', approved_layers())] + [(r['file'], layers_of(r['file'])) for r in reg['reference']]

# ---- eyeballs + lid colours (cel units) ----
eyes = {}
for fid, L in faces:
    full = np.zeros((CEL, CEL, 4), np.uint8)
    for k in ('eyes-left', 'eyes-right'):
        x, y, im = L[k]; sub = np.array(im)
        tgt = full[y:y + sub.shape[0], x:x + sub.shape[1]]
        m = sub[..., 3] > 0; tgt[m] = sub[m]
    c = full.astype(int); r, g, b, a = c[..., 0], c[..., 1], c[..., 2], c[..., 3]
    lum = (r + g + b) / 3; sat = c[..., :3].max(-1) - c[..., :3].min(-1)
    white = (a > 200) & (lum > 165) & (sat < 60)
    red = (a > 200) & (r > 110) & (g < 90) & (r - g > 60)
    if fid in DARK_EYES:
        shine = (a > 200) & (r > 150) & (g < 60) & (b < 80)
        dark = ndimage.binary_fill_holes(((a > 200) & (lum < 13)) | shine | white)
        lab, n = ndimage.label(dark)
        hit = set(np.unique(lab[ndimage.binary_dilation(shine, iterations=1) & (lab > 0)])) - {0}
        ball = np.isin(lab, list(hit))
    else:
        ball = ndimage.binary_fill_holes(ndimage.binary_closing(white | red, iterations=4))
    lab, n = ndimage.label(ball)
    sizes = ndimage.sum(ball, lab, range(1, n + 1)) if n else []
    out = []
    for k in [int(i) + 1 for i in np.argsort(sizes)[::-1][:2]]:
        if sizes[k - 1] < 150: continue
        if fid not in DARK_EYES and white[lab == k].sum() < 60: continue
        bm = ndimage.binary_dilation(lab == k, iterations=1)
        if fid not in DARK_EYES:
            bm = ndimage.binary_fill_holes(ndimage.binary_closing(bm | (red & ndimage.binary_dilation(bm, iterations=15)), iterations=4))
        ys, xs = np.where(bm)
        px = head_np[bm]
        out.append({'p': poly(bm), 'l': '#%02x%02x%02x' % tuple(int(v) for v in px[:, :3].mean(0)),
                    't': int(ys.min()), 'b': int(ys.max()), 'x': round(float(xs.mean()), 1)})
    eyes[fid] = out

# ---- atlas (shelf packing) ----
items = [('head', 0, 0, head)]
for fid, L in faces:
    for k in ('eyes-left', 'eyes-right', 'mouth'):
        x, y, im = L[k]; items.append((fid + '/' + k, x, y, im))
W, PAD = 1024, 2
packed = []; cx = cy = shelf = 0
for name, x, y, im in sorted(items, key=lambda t: -t[3].size[1]):
    w, h = max(1, round(im.size[0] * K)), max(1, round(im.size[1] * K))
    if cx + w + PAD > W: cx = 0; cy += shelf + PAD; shelf = 0
    packed.append((name, x, y, im, cx, cy, w, h)); cx += w + PAD; shelf = max(shelf, h)
H = cy + shelf
atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
amap = {}
for name, x, y, im, ax, ay, w, h in packed:
    atlas.paste(im.resize((w, h), Image.LANCZOS), (ax, ay))
    sw, sh = im.size
    amap[name] = [ax, ay, w, h, x, y, sw, sh]              # atlas rect, then where it sits on the 512 cel and its cel size
buf = io.BytesIO(); atlas.save(buf, 'WEBP', quality=90, alpha_quality=100, method=6)
open(os.path.join(ROOT, 'dev/src/rig_atlas.b64'), 'w').write(base64.b64encode(buf.getvalue()).decode())

data = {'hc': HC, 'hr': HR, 'org': reg['full_body_cel_origin'], 'map': amap, 'eyes': eyes,
        'labels': {fid: (r['label'] if fid != 'base' else 'Base') for fid, r in [('base', None)] + [(r['file'], r) for r in reg['reference']]}}
js = '/*SH_RIG_DATA_START*/const SH_RIG=' + json.dumps(data, separators=(',', ':')) + ';/*SH_RIG_DATA_END*/'
p = os.path.join(ROOT, 'block1.js'); src = open(p, encoding='utf-8').read()
if '/*SH_RIG_DATA_START*/' in src:
    src = re.sub(r'/\*SH_RIG_DATA_START\*/.*?/\*SH_RIG_DATA_END\*/', lambda m: js, src, count=1, flags=re.S)
    open(p, 'w', encoding='utf-8').write(src)
else:
    print('markers missing in block1.js; data not written')
print('atlas %dx%d, %d KB webp; data %d KB' % (W, H, len(buf.getvalue()) // 1024, len(js) // 1024))
print({k: len(v) for k, v in eyes.items()})
