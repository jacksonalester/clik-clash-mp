#!/usr/bin/env python3
"""Build the game page from source.

    python3 dev/build.py

Reads   block1.js (all game code, also run by the server) + dev/src/* (page head, styles, markup, icons, fonts)
Writes  index.html (release, cheats off) and dev/out/dev.html (everything unlocked, for testing only)
"""
import os, subprocess
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd=lambda p: open(os.path.join(ROOT,p),encoding='utf-8').read()
subprocess.run(['node','--check',os.path.join(ROOT,'block1.js')],check=True)
js=rd('block1.js')
css=("@font-face{font-family:'LilitaX';src:url(data:font/ttf;base64,%s) format('truetype');font-display:block}\n"
     "@font-face{font-family:'Nunito';font-weight:700;src:url(data:font/woff2;base64,%s) format('woff2');font-display:swap}\n"
     "@font-face{font-family:'Nunito';font-weight:900;src:url(data:font/woff2;base64,%s) format('woff2');font-display:swap}\n")%(rd('dev/src/lilita.b64'),rd('dev/src/nunito700.b64'),rd('dev/src/nunito900.b64'))
css+=rd('dev/src/shell.css')
sprite=rd('dev/src/icons.svg').replace('<defs>','<defs>'+rd('dev/src/logo.svg').replace('\n',''))
body=rd('dev/src/shell.html').replace('<!--ICONS-->',sprite)
icon=rd('dev/src/icon180.b64')
SW="<script>if('serviceWorker' in navigator&&location.protocol==='https:'){addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{})})}</script>"
def page(dev):
    head=rd('dev/src/head.html').replace('{{DEVTAG}}',' — DEV BUILD' if dev else '').replace('{{ICON180}}','data:image/png;base64,'+icon)
    return (head+'<style>\n'+css+'\n</style>\n</head>\n<body>\n'+body+'\n<script>window.__DEV=%d;</script>\n<script>\n'%(1 if dev else 0)
            +js+'\n</script>\n'+('' if dev else SW+'\n')+'</body>\n</html>\n')
os.makedirs(os.path.join(ROOT,'dev/out'),exist_ok=True)
open(os.path.join(ROOT,'index.html'),'w',encoding='utf-8').write(page(False))
open(os.path.join(ROOT,'dev/out/dev.html'),'w',encoding='utf-8').write(page(True))
print('built index.html (%d bytes) and dev/out/dev.html'%os.path.getsize(os.path.join(ROOT,'index.html')))
