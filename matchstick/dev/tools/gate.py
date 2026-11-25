# MATCHSTICK release gate: every screen on six devices, gameplay, speed, saves, touch.
import json, time, sys
from playwright.sync_api import sync_playwright
URL='file:///home/claude/matchstick/dist/matchstick.html'; OUT='/home/claude/matchstick/shots/g_'
VPS=[('small phone',360,640,True),('phone',390,844,True),('big phone',430,932,True),('phone landscape',844,390,True),('tablet',768,1024,True),('desktop',1366,768,False)]
results=[]; fails=[]
def check(name, ok, detail=''):
    results.append((name, bool(ok), detail));
    if not ok: fails.append(name+' :: '+str(detail)[:300])
JS_AUDIT = r"""(sel)=>{
  const vw=innerWidth, vh=innerHeight, root=document.querySelector(sel); if(!root) return {missing:true};
  const out={small:[],clip:[],hscroll: document.documentElement.scrollWidth>vw+1};
  for(const el of root.querySelectorAll('button, input, [role=radio], .item, .tab')){
    const r=el.getBoundingClientRect(); if(!r.width||!r.height) continue;
    const st=getComputedStyle(el); if(st.visibility==='hidden'||st.display==='none') continue;
    let p=el.parentElement, hid=false; while(p){ if(p.hidden){hid=true;break;} p=p.parentElement;} if(hid) continue;
    const name=(el.id||el.className||el.tagName)+':'+(el.textContent||'').trim().slice(0,18);
    if(r.height<43.5 || r.width<43.5) out.small.push(name+' '+Math.round(r.width)+'x'+Math.round(r.height));
    const sc=el.closest('.scroll, .tabs, .map-row, .grid, .sheet');
    if(!sc && (r.right>vw+1 || r.left<-1 || r.bottom>vh+1 || r.top<-1)) out.clip.push(name);
    if(sc && (r.right>vw+1 || r.left<-1) && !el.closest('.tabs, .map-row')) out.clip.push('h:'+name);
  }
  return out; }"""
with sync_playwright() as p:
    b=p.chromium.launch()
    for (vn,w,h,touch) in VPS:
        ctx=b.new_context(viewport={'width':w,'height':h}, device_scale_factor=2 if touch else 1, has_touch=touch, is_mobile=touch)
        pg=ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e, errs=errs: errs.append(str(e))); pg.on('console', lambda m, errs=errs: errs.append(m.text) if m.type=='error' else None)
        t0=time.time(); pg.goto(URL)
        try: pg.wait_for_function("G.state==='menu' && !document.getElementById('home').hidden", timeout=4000); check(vn+': loading screen hands over to the home screen in under 4s', True, round(time.time()-t0,2))
        except Exception as e: check(vn+': loading screen hands over to the home screen in under 4s', False, str(e))
        pg.wait_for_timeout(300); pg.screenshot(path=OUT+vn.replace(' ','_')+'_home.png')
        # home: every action visible without scrolling
        vis=pg.evaluate("""()=>['hPlay','hModes','hLocker','hProfile','hDaily','hSet','hMe','hFigBtn'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [id, r.top>=0 && r.bottom<=innerHeight+1 && r.left>=0 && r.right<=innerWidth+1, Math.round(r.height)]})""")
        bad=[v for v in vis if not v[1]]; check(vn+': home shows all 8 actions without scrolling', not bad, bad)
        fig=pg.evaluate("document.getElementById('hFig').getBoundingClientRect().height"); check(vn+': home figure gets real space', fig>=100, round(fig))
        screens=[('home','#home',None),('modes','#modes',"show('modes')"),('locker','#locker',"UI.locker.tab='today';UI.locker.sel=null;show('locker')"),
                 ('profile','#profile',"show('profile')"),('settings','#settings',"show('settings')")]
        for cat in ['head','color','melee','pet','trail','fx','emblem']: screens.append(('locker '+cat,'#locker',f"UI.locker.tab='{cat}';UI.locker.sel=null;show('locker')"))
        screens += [('daily sheet','#sheetDaily',"show('home');openDaily()"),('how to play','#sheetHow',"overlay('sheetDaily',false);openHow()")]
        for (sn,sel,js) in screens:
            if js: pg.evaluate(js); pg.wait_for_timeout(260)
            a=pg.evaluate(JS_AUDIT, sel)
            check(f'{vn}: {sn} has no clipped or overflowing controls', not a.get('clip') and not a.get('hscroll'), a.get('clip'))
            if touch: check(f'{vn}: {sn} tap targets are at least 44px', not a.get('small'), a.get('small'))
            if sn in ('modes','locker head','profile','settings') : pg.screenshot(path=OUT+vn.replace(' ','_')+'_'+sn.replace(' ','_')+'.png')
        pg.evaluate("overlay('sheetHow',false); show('home')")
        # a real match, auto-played to the end
        pg.evaluate("startMatch({mode:'ffa',map:'atrium'})"); pg.wait_for_timeout(1500)
        hudshot=OUT+vn.replace(' ','_')+'_match.png'
        pg.evaluate("G.me.bot=true; G.me.skill=0.9; G.g.R.target=6")
        pg.wait_for_timeout(5000); pg.screenshot(path=hudshot)
        if touch:
            hb=pg.evaluate("""()=>['tPause','tDash','tSwap'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [id, r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth, Math.round(r.width), Math.round(r.height)]})""")
            check(vn+': touch buttons sit on screen and are thumb-sized', all(x[1] and x[2]>=44 and x[3]>=44 for x in hb), hb)
        try: pg.wait_for_function("G.state==='results'", timeout=120000); ended=True
        except Exception: ended=False
        check(vn+': auto-played match ends on the results screen', ended)
        pg.wait_for_timeout(1300); pg.screenshot(path=OUT+vn.replace(' ','_')+'_results.png')
        rb=pg.evaluate("""()=>['rAgain','rMenu'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [id, r.top>=0&&r.bottom<=innerHeight+1, Math.round(r.height)]})""")
        check(vn+': results buttons are on screen without scrolling', all(x[1] for x in rb), rb)
        acc=pg.evaluate("G.me.st.shots ? G.me.st.hits/G.me.st.shots : 0"); check(vn+': accuracy stays between 0 and 100%', 0<=acc<=1, acc)
        pg.click('#rAgain'); pg.wait_for_timeout(800); check(vn+': play again starts a new match on a new map', pg.evaluate("G.state==='match' && G.mapId!=='atrium'"), pg.evaluate('G.mapId'))
        # pause and quit
        if touch: pg.evaluate("document.getElementById('tPause').click()")
        else: pg.keyboard.press('Escape')
        pg.wait_for_timeout(300); check(vn+': pause opens', pg.evaluate("G.state==='pause' && !document.getElementById('pause').hidden"))
        pg.screenshot(path=OUT+vn.replace(' ','_')+'_pause.png')
        pg.click('#pzQuit'); pg.wait_for_timeout(100); armed=pg.evaluate("G.state"); pg.click('#pzQuit'); pg.wait_for_timeout(300)
        check(vn+': quitting needs a second tap, then returns home', armed=='pause' and pg.evaluate("G.state==='menu' && !document.getElementById('home').hidden"), armed)
        check(vn+': zero script errors', not errs, errs[:4])
        ctx.close()
    # ---- speed ----
    ctx=b.new_context(viewport={'width':390,'height':844}, device_scale_factor=3, has_touch=True, is_mobile=True); pg=ctx.new_page()
    pg.goto(URL); pg.wait_for_function("G.state==='menu'", timeout=4000)
    menu=pg.evaluate("""()=>new Promise(res=>{let n=0,tot=0;const f=()=>{const a=performance.now();menuFrame(1/60);tot+=performance.now()-a;if(++n<240)requestAnimationFrame(f);else res(tot/n)};requestAnimationFrame(f)})""")
    check('speed: home screen costs %.2f ms per frame (budget 16.6)'%menu, menu<6, menu)
    pg.evaluate("startMatch({mode:'ffa',map:'yard'}); G.me.bot=true; G.me.skill=0.9; SET.bots=7")
    pg.wait_for_timeout(4000)
    m=pg.evaluate("""()=>new Promise(res=>{let n=0,tot=0,mx=0;const f=()=>{const a=performance.now();matchFrame(1/60);const d=performance.now()-a;tot+=d;mx=Math.max(mx,d);if(++n<300)requestAnimationFrame(f);else res([tot/n,mx,RN.fx.length])};requestAnimationFrame(f)})""")
    check('speed: phone match frame %.2f ms average, %.1f ms worst (budget 16.6)'%(m[0],m[1]), m[0]<7, m)
    pg.evaluate("quitMatch(); SET.bots=7; startMatch({mode:'tdm',map:'volt'}); G.me.bot=true")
    pg.wait_for_timeout(4000)
    m2=pg.evaluate("""()=>new Promise(res=>{let n=0,tot=0,mx=0;const f=()=>{const a=performance.now();matchFrame(1/60);const d=performance.now()-a;tot+=d;mx=Math.max(mx,d);if(++n<300)requestAnimationFrame(f);else res([tot/n,mx])};requestAnimationFrame(f)})""")
    check('speed: 8-player team match %.2f ms average on the dark map'%m2[0], m2[0]<8, m2)
    fps=pg.evaluate("""()=>new Promise(res=>{let n=0,t0=performance.now();const f=()=>{if(++n<120)requestAnimationFrame(f);else res(n/((performance.now()-t0)/1000))};requestAnimationFrame(f)})""")
    check('speed: match holds %.0f fps in the browser'%fps, fps>50, fps)
    ctx.close()
    # ---- saves ----
    ctx=b.new_context(viewport={'width':1366,'height':768}); pg=ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_function("G.state==='menu'", timeout=4000)
    pg.evaluate("localStorage.setItem(SAVE_KEY,'{not json'); "); pg.reload(); pg.wait_for_function("G.state==='menu'", timeout=4000)
    check('saves: a corrupted save falls back to a fresh profile', pg.evaluate("SV.level===1 && SV.eq.head==='plain'") and not errs, errs)
    pg.evaluate("localStorage.setItem(SAVE_KEY, JSON.stringify({name:'<img src=x onerror=1>Sneaky', sparks:'lots', eq:{head:'ghost-item'}, owned:{head:['plain','nope']}}))"); pg.reload(); pg.wait_for_function("G.state==='menu'", timeout=4000)
    sv=pg.evaluate("({n:SV.name, sp:SV.sparks, h:SV.eq.head, own:SV.owned.head})")
    check('saves: a tampered save is cleaned (no markup, no fake items)', '<' not in sv['n'] and sv['h']=='plain' and 'nope' not in sv['own'] and isinstance(sv['sp'],(int,float)), sv)
    pg.evaluate("SV.sparks=900; persist(); show('locker')"); pg.reload(); pg.wait_for_function("G.state==='menu'", timeout=4000)
    check('saves: sparks survive a reload', pg.evaluate("SV.sparks")==900)
    ctx.close()
    # ---- touch controls ----
    ctx=b.new_context(viewport={'width':844,'height':390}, device_scale_factor=2, has_touch=True, is_mobile=True); pg=ctx.new_page()
    pg.goto(URL); pg.wait_for_function("G.state==='menu'", timeout=4000)
    pg.evaluate("startMatch({mode:'ffa',map:'yard'})"); pg.wait_for_timeout(800)
    pg.evaluate("G.me.gun='smg'; G.me.ammo=75; G.me.cur='gun'")
    dcd=pg.evaluate("G.me.dashCD"); pg.evaluate("document.getElementById('tDash').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch'}))"); pg.wait_for_timeout(120)
    check('touch: the dash button dashes', pg.evaluate("G.me.dashCD")>dcd+0.5, pg.evaluate("G.me.dashCD"))
    pg.evaluate("document.getElementById('tSwap').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch'}))"); pg.wait_for_timeout(120)
    check('touch: the weapon pill switches gun and melee', pg.evaluate("G.me.cur")=='melee')
    pg.evaluate("G.me.cur='gun'; const k=mkPickup('rifle',G.me.x,G.me.y,false,8); G.g.pickups.push(k)"); pg.wait_for_timeout(200)
    check('touch: standing on a different gun shows the Swap button', pg.evaluate("!document.getElementById('tPick').hidden"), pg.inner_text('#tPick'))
    pg.evaluate("document.getElementById('tPick').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch'}))"); pg.wait_for_timeout(150)
    check('touch: Swap trades your gun for the one underfoot', pg.evaluate("G.me.gun")=='rifle', pg.evaluate("G.me.gun"))
    ctx.close(); b.close()
passed=sum(1 for r in results if r[1])
for r in results:
    if not r[1]: print('FAIL', r[0], '::', str(r[2])[:240])
print(f'GATE: {passed} passed, {len(results)-passed} failed')
json.dump(results, open('/home/claude/matchstick/dist/gate_report.json','w'), indent=1)
