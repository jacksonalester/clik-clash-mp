#!/usr/bin/env python3
"""Assemble MATCHSTICK into single-file builds.
dist/matchstick.html  full standalone page (open it anywhere, host it anywhere)
dist/artifact.html    the same game as a body fragment for a claude.ai artifact"""
import base64, os, re, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
V = R + 'vendor/node_modules/'
def b64(p): return base64.b64encode(open(p, 'rb').read()).decode()
FONTS = [('Barlow', 400, 'normal', '@fontsource/barlow/files/barlow-latin-400-normal.woff2'),
         ('Barlow', 500, 'normal', '@fontsource/barlow/files/barlow-latin-500-normal.woff2'),
         ('Barlow', 600, 'normal', '@fontsource/barlow/files/barlow-latin-600-normal.woff2'),
         ('Barlow Condensed', 700, 'italic', '@fontsource/barlow-condensed/files/barlow-condensed-latin-700-italic.woff2')]
font_css = ''.join('@font-face{font-family:"%s";font-weight:%d;font-style:%s;font-display:swap;src:url(data:font/woff2;base64,%s) format("woff2")}\n' % (f, w, s, b64(V + p)) for f, w, s, p in FONTS)
ICONS = ['gear-six','user','t-shirt','sliders-horizontal','x','arrow-left','pause','play','lock-simple','check','lightning','arrows-clockwise','hand-grabbing','trophy','crosshair-simple','clock','flame','speaker-high','question','arrow-counter-clockwise','caret-right','users-three','shuffle','calendar-check','medal','pencil-simple','smiley','info']
sym = []
for n in ICONS:
    s = open(V + '@phosphor-icons/core/assets/regular/%s.svg' % n).read()
    inner = re.sub(r'^.*?<svg[^>]*>|</svg>\s*$', '', s, flags=re.S)
    sym.append('<symbol id="i-%s" viewBox="0 0 256 256">%s</symbol>' % (n, inner))
lock_svg = open(V + '@phosphor-icons/core/assets/regular/lock-simple.svg').read().replace('currentColor', '#000')
sprite = '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' + ''.join(sym) + '</svg>'
css = open(R + 'src/style.css').read() + '\n:root{--lock:url("data:image/svg+xml;base64,%s")}\n' % base64.b64encode(lock_svg.encode()).decode()
JS = ['util', 'data', 'sim', 'bots', 'draw', 'render', 'audio', 'input', 'save', 'ui', 'main']
js = '\n'.join(open(R + 'src/js/%s.js' % f).read() for f in JS)
body = open(R + 'src/body.html').read()
head = open(R + 'src/head.html').read()
os.makedirs(R + 'dist', exist_ok=True)
full = '<!doctype html>\n<html lang="en">\n<head>\n' + head + '<style>\n' + font_css + css + '</style>\n</head>\n<body>\n' + sprite + '\n' + body + '\n<script>\n' + js + '\n</script>\n</body>\n</html>\n'
open(R + 'dist/matchstick.html', 'w').write(full)
web_head = head + '<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" type="image/png" href="icon-192.png">\n<link rel="apple-touch-icon" href="icon-180.png">\n'
os.makedirs(R + 'dist/web', exist_ok=True)
open(R + 'dist/web/index.html', 'w').write(full.replace(head, web_head, 1))
frag = '<title>Matchstick</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>\n' + font_css + css + '</style>\n' + sprite + '\n' + body + '\n<script>\n' + js + '\n</script>\n'
open(R + 'dist/artifact.html', 'w').write(frag)
print('built', len(full), 'bytes full,', len(frag), 'bytes artifact, js', len(js))
