import json, time
from playwright.sync_api import sync_playwright
URL='file:///home/claude/matchstick/dist/matchstick.html'; OUT='/home/claude/matchstick/shots/'
def page(p, vp, touch=False):
    b=p.chromium.launch(); ctx=b.new_context(viewport=vp, device_scale_factor=1, has_touch=touch, is_mobile=touch)
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append('PAGE '+str(e))); pg.on('console', lambda m: errs.append('CONSOLE '+m.text) if m.type=='error' else None)
    pg.goto(URL); pg.wait_for_timeout(2000); return b, pg, errs
def wait_state(pg, st, secs):
    t0=time.time()
    while time.time()-t0<secs:
        if pg.evaluate('G.state')==st: return True
        pg.wait_for_timeout(250)
    return False
with sync_playwright() as p:
    # 1 desktop autoplay to the end
    b,pg,errs=page(p,{'width':1366,'height':768})
    before=pg.evaluate('({sp:SV.sparks,xp:SV.xp,lvl:SV.level})')
    pg.evaluate("startMatch({mode:'ffa',map:'depot'}); G.g.R.target=7; G.me.bot=true; G.me.skill=0.95;")
    pg.mouse.move(900,300)
    pg.wait_for_timeout(9000); pg.screenshot(path=OUT+'p_desk_action.png')
    mid=pg.evaluate("({kills:G.me.kills,shots:G.me.st.shots,hits:G.me.st.hits,gun:G.me.gun,pick:G.me.st.pickup, all:G.g.players.map(p=>p.kills)})")
    ok=wait_state(pg,'results',90); pg.wait_for_timeout(1500); pg.screenshot(path=OUT+'p_desk_results.png')
    after=pg.evaluate('({sp:SV.sparks,xp:SV.xp,lvl:SV.level,matches:SV.stats.matches,kills:SV.stats.kills,daily:SV.daily.list})')
    print('autoplay mid', json.dumps(mid)); print('ended', ok, 'before', before, 'after', json.dumps(after))
    # 2 buy flow
    pg.evaluate("overlay('results',false); toMenu(); SV.sparks=5000; UI.locker.tab='head'; UI.locker.sel=null; show('locker')"); pg.wait_for_timeout(400)
    pg.click('.item[data-id="cap"]'); pg.wait_for_timeout(150); t1=pg.inner_text('#lAct')
    pg.click('#lAct'); pg.wait_for_timeout(150); t2=pg.inner_text('#lAct')
    pg.click('#lAct'); pg.wait_for_timeout(300); t3=pg.inner_text('#lAct')
    own=pg.evaluate("({own:owns('head','cap'),eq:SV.eq.head,sp:SV.sparks})")
    print('buy flow:', repr(t1), '->', repr(t2), '->', repr(t3), own)
    pg.screenshot(path=OUT+'p_desk_locker_cap.png')
    # 3 pause
    pg.evaluate("show('home'); startMatch({mode:'tdm',map:'volt'})"); pg.wait_for_timeout(3500); pg.screenshot(path=OUT+'p_desk_volt_tdm.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(500); print('pause state', pg.evaluate('G.state')); pg.screenshot(path=OUT+'p_desk_pause.png')
    pg.click('#pzResume'); pg.wait_for_timeout(300); print('after resume', pg.evaluate('G.state'))
    # persistence
    pg.reload(); pg.wait_for_timeout(2200); print('reload keeps:', pg.evaluate("({own:owns('head','cap'),eq:SV.eq.head,matches:SV.stats.matches})"))
    print('desktop errors:', errs[:6]); b.close()
    # 4 phone landscape touch
    b,pg,errs=page(p,{'width':844,'height':390},True)
    pg.evaluate("startMatch({mode:'ffa',map:'greenhouse'})"); pg.wait_for_timeout(1200)
    x0=pg.evaluate('[G.me.x,G.me.y]')
    def pe(t,id,x,y): pg.evaluate(f"document.getElementById('game').dispatchEvent(new PointerEvent('{t}',{{pointerId:{id},pointerType:'touch',clientX:{x},clientY:{y},bubbles:true,cancelable:true,isPrimary:{'true' if id==11 else 'false'}}}))")
    pe('pointerdown',11,140,300); pe('pointermove',11,200,300)
    pe('pointerdown',12,700,300); pe('pointermove',12,760,290)
    for i in range(14): pg.wait_for_timeout(100); pe('pointermove',11,200,300+(i%2)); pe('pointermove',12,760,290+(i%2))
    x1=pg.evaluate('[G.me.x,G.me.y,G.me.in.fire,G.me.swingT,IN.touch]')
    pg.screenshot(path=OUT+'p_phone_land_touch.png')
    pe('pointerup',11,200,300); pe('pointerup',12,760,290)
    print('touch move', x0, '->', x1)
    pg.evaluate("G.g.R.target=3; G.me.bot=true; G.me.skill=0.95"); wait_state(pg,'results',90); pg.wait_for_timeout(1500); pg.screenshot(path=OUT+'p_phone_land_results.png')
    pg.evaluate("overlay('results',false); toMenu()"); pg.wait_for_timeout(600); pg.screenshot(path=OUT+'p_phone_land_home.png')
    print('phone errors:', errs[:6]); b.close()
