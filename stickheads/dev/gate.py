"""STICKHEADS release gate — real Chromium, real taps. Exit code 0 only if everything passes."""
import sys, json, asyncio, subprocess, os, time
from playwright.async_api import async_playwright
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+'/'
PASS=[];FAIL=[]
def check(name,cond,info=''):
    (PASS if cond else FAIL).append(name+((' — '+str(info)) if info!='' else ''))
    print(('  ok   ' if cond else '  FAIL ')+name+((' — '+str(info)) if (info!='' and not cond) else ''),flush=True)
VIEWS=[(360,640,'small phone'),(390,844,'phone'),(430,932,'big phone'),(768,1024,'tablet'),(844,390,'phone landscape'),(1366,768,'desktop')]
BAD_ERR=lambda t: not any(x in t for x in ('ERR_TUNNEL','WebSocket connection','Failed to load resource','net::ERR'))
async def newpage(br,w,h,src,touch=None):
    mobile = (w<900 or h<520) if touch is None else touch
    ctx=await br.new_context(viewport={'width':w,'height':h},device_scale_factor=2 if mobile else 1,has_touch=mobile,is_mobile=mobile)
    pg=await ctx.new_page(); pg.errs=[]
    pg.on('console',lambda m: pg.errs.append(m.text) if m.type=='error' and BAD_ERR(m.text) else None)
    pg.on('pageerror',lambda e: pg.errs.append('PAGEERROR '+str(e)))
    await pg.goto('file://'+R+src); await pg.wait_for_timeout(900)
    return ctx,pg
LAYOUT_JS="""()=>{
  const vw=innerWidth, vh=innerHeight, out={over:[],small:[],clip:[]};
  const vis=el=>{ const r=el.getBoundingClientRect(); const cs=getComputedStyle(el); return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&!el.closest('.hidden'); };
  const scr=[...document.querySelectorAll('.scr,.modal')].filter(vis);
  const top=scr[scr.length-1];
  const roots=[top, document.getElementById('topbar'), document.getElementById('navbar')].filter(e=>e&&vis(e));
  for(const root of roots){
    for(const el of root.querySelectorAll('button,.btn,.tile,.nv,.icobtn,.tab,input')){
      if(!vis(el)) continue; const r=el.getBoundingClientRect();
      if((r.left<-1||r.right>vw+1)&&!el.closest('.passstrip')) out.over.push((el.id||el.className)+' x'+Math.round(r.left)+'..'+Math.round(r.right));
      const inScroll=el.closest('.passstrip,.mscroll');
      if(!inScroll&&(r.height<40||r.width<40)&&!el.matches('.seg button,.pp')) out.small.push((el.id||el.className)+' '+Math.round(r.width)+'x'+Math.round(r.height));
    }
    for(const el of root.querySelectorAll('.btn,.tile b,.scr-title,.nv,.tab,.pp,.rk-t,.mode b')){
      if(!vis(el)) continue;
      if(el.scrollWidth>el.clientWidth+2 && getComputedStyle(el).overflow!=='hidden') out.clip.push((el.id||el.className)+' '+el.scrollWidth+'>'+el.clientWidth);
    }
  }
  out.docOver=document.documentElement.scrollWidth>vw+1;
  return out; }"""
async def layout(pg,tag):
    o=await pg.evaluate(LAYOUT_JS)
    bad=o['over'] or o['clip'] or o['docOver']
    return o, (not bad)
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch()
        # ---------------- 1. layout on six device sizes, every screen ----------------
        print('[1] layout: every screen on six device sizes')
        for (w,h,label) in VIEWS:
            ctx,pg=await newpage(br,w,h,'dev/out/dev.html')
            await pg.evaluate("()=>document.getElementById('splash').click()"); await pg.wait_for_timeout(350)
            steps=[('hub',"()=>goHome()"),('modes',"()=>{buildLobby();showScreen('lobby')}"),('shop',"()=>navGo('shop')"),
                   ('trader',"()=>document.getElementById('shopTabB').click()"),('locker',"()=>navGo('locker')"),('ranks',"()=>navGo('ranks')"),
                   ('pass',"()=>navGo('pass')"),('profile',"()=>navGo('profile')"),('settings',"()=>openOptions()"),
                   ('daily',"()=>{goHome();document.getElementById('mChal').click()}"),('online',"()=>{closeModal('daily');openOnline()}"),
                   ('rankroad',"()=>{closeModal('party');document.getElementById('mLvl').click()}"),('howto',"()=>{closeModal('rankroad');openModal('howto')}"),
                   ('legal',"()=>{closeModal('howto');openModal('legal')}"),
                   ('buy',"()=>{closeModal('legal');shopTab='stock';navGo('shop');save.owned=['rookie','pulse','plate'];buildShop();document.querySelector('#shopGrid .item:not([data-bundle])').click()}"),
                   ('pause',"()=>{closeModal('buyModal');_buyCtx=null;save.seen=true;qpStart();togglePause()}"),
                   ('results',"()=>{togglePause();player.frags=15;endMatch(player)}")]
            bad=[]; small=[]
            for name,js in steps:
                await pg.evaluate(js); await pg.wait_for_timeout(260)
                o,ok=await layout(pg,name)
                if not ok: bad.append(name+':'+json.dumps({k:v for k,v in o.items() if v})[:240])
                if o['small']: small.append(name+':'+','.join(o['small'][:4]))
            hub=await pg.evaluate("""()=>{ document.getElementById('btnHome').click(); const vh=innerHeight; const ids=['btnPlay','btnTeams','btnPantheon','btnOnline','btnModes','mChal','mLvl'];
               const cut=ids.filter(i=>{const r=document.getElementById(i).getBoundingClientRect(); const nb=document.getElementById('navbar').getBoundingClientRect(); return r.top<0||r.bottom>nb.top+1;});
               layoutHub(); return {cut, hero:heroRect?Math.round(heroRect.y1-heroRect.y0):-1, scroll:document.getElementById('menu').scrollHeight-document.getElementById('menu').clientHeight}; }""")
            check(f'{label} {w}x{h}: nothing overflows or clips on 17 screens',not bad,bad[:3])
            check(f'{label} {w}x{h}: every tap target is at least 40px',not small,small[:3])
            check(f'{label} {w}x{h}: hub fits with no scrolling, all 7 actions visible',not hub['cut'] and hub['scroll']<=1,hub)
            check(f'{label} {w}x{h}: hero has room on the podium ({hub["hero"]}px)',hub['hero']>=60,hub)
            check(f'{label} {w}x{h}: zero script errors',not pg.errs,pg.errs[:3])
            await ctx.close()
        # ---------------- 2. release build, brand-new player ----------------
        print('[2] release build as a brand-new player')
        ctx,pg=await newpage(br,390,844,'index.html')
        st=await pg.evaluate("()=>({dev:window.__DEV,coins:save.coins,lvl:save.lvl,owned:save.owned.length,title:document.title,splash:!document.getElementById('splash').classList.contains('hidden')})")
        check('release: dev cheats are off, fresh save starts at level 1 with 0 coins',st['dev']==0 and st['coins']==0 and st['lvl']==1 and st['owned']==3,st)
        check('release: page title is clean',st['title']=='STICKHEADS',st['title'])
        check('release: splash shows first',st['splash'])
        await pg.evaluate("()=>document.getElementById('splash').click()"); await pg.wait_for_timeout(300)
        texts={}
        for name,js in [('hub',"()=>goHome()"),('modes',"()=>{buildLobby();showScreen('lobby')}"),('shop',"()=>navGo('shop')"),('trader',"()=>document.getElementById('shopTabB').click()"),
                        ('locker',"()=>navGo('locker')"),('auras',"()=>document.getElementById('tabAuras').click()"),('plates',"()=>document.getElementById('tabEmb').click()"),
                        ('ranks',"()=>navGo('ranks')"),('pass',"()=>navGo('pass')"),('profile',"()=>navGo('profile')"),('settings',"()=>openOptions()")]:
            await pg.evaluate(js); await pg.wait_for_timeout(200)
            texts[name]=await pg.evaluate("()=>[...document.querySelectorAll('.scr:not(.hidden),#topbar,#navbar')].map(e=>e.innerText).join(' | ')")
        for mid in ['daily','party','howto','legal','passModal','rankroad']:
            texts[mid]=await pg.evaluate("(m)=>document.getElementById(m).innerText",mid)
        alltxt=' '.join(texts.values())
        import re
        check('release: no old "CLIK" branding anywhere in the menus',not re.search(r'clik',alltxt,re.I),[k for k,v in texts.items() if re.search(r'clik',v,re.I)])
        check('release: no real-money prices shown (coins only)','$' not in alltxt,[k for k,v in texts.items() if '$' in v])
        check('release: no "undefined", "NaN" or "null" text',not re.search(r'undefined|NaN|\bnull\b',alltxt),[k for k,v in texts.items() if re.search(r'undefined|NaN|\bnull\b',v)])
        check('release: no fake lobby counts or fake player sellers',not re.search(r'IN LOBBY|sold by',alltxt,re.I))
        gods=await pg.evaluate("()=>{lockTab='skins';buildLocker();return document.querySelectorAll('#grid .item').length}")
        check('release: locker hides mode-only god skins a new player cannot own',gods==38,gods)
        # first match: hint -> countdown -> playing
        await pg.evaluate("()=>{goHome();document.getElementById('btnPlay').click()}"); await pg.wait_for_timeout(500)
        h=await pg.evaluate("()=>({hint:!document.getElementById('hint').classList.contains('hidden'),state,mode,map:curMap,ffa:FFA_MAPS.indexOf(curMap)>=0,n:ents.length})")
        check('first match: QUICKPLAY opens a free-for-all with the how-to-fight card',h['hint'] and h['state']=='match' and h['mode']=='ffa' and h['ffa'] and h['n']==6,h)
        await pg.evaluate("()=>document.getElementById('hint').click()"); await pg.wait_for_timeout(4800)
        t0=await pg.evaluate("()=>matchT"); await pg.wait_for_timeout(1200); t1=await pg.evaluate("()=>matchT")
        check('first match: countdown finishes and the clock runs',t1<t0,(t0,t1))
        seen=await pg.evaluate("()=>save.seen")
        check('first match: tutorial card is remembered (shown once)',seen is True)
        # win -> results -> rewards land in the save
        r=await pg.evaluate("""()=>{ const c0=save.coins,x0=save.lvl*1e6+save.xp; player.frags=15; matchBest=5; endMatch(player);
              return {title:document.getElementById('resTitle').textContent,sub:document.getElementById('resSub').textContent,coins:save.coins-c0,xp:(save.lvl*1e6+save.xp)-x0,wins:save.stats.w,scr:curScr,next:!document.getElementById('btnNext').classList.contains('hidden')}; }""")
        check('results: a win says VICTORY and pays coins + XP into the save',r['title']=='VICTORY!' and r['coins']>0 and r['xp']>0 and r['wins']==1 and r['scr']=='results',r)
        check('results: NEXT MAP is offered in free-for-all',r['next'])
        await pg.wait_for_timeout(1500)
        rw=await pg.evaluate("()=>document.getElementById('resRewards').innerText")
        check('results: reward chips count up to the real totals',str(r['coins']) in rw.replace(',',''),rw)
        await pg.evaluate("()=>document.getElementById('btnHome').click()"); await pg.wait_for_timeout(300)
        hb=await pg.evaluate("()=>({scr:curScr,state,coins:document.getElementById('tbCoins').textContent,tr:document.getElementById('tbTr').textContent,demo})")
        check('results: HOME returns to the hub with coins and trophies updated',hb['scr']=='menu' and hb['state']=='menu' and hb['coins']!='0' and hb['tr']!='0',hb)
        # ---------------- 3. shop / economy ----------------
        print('[3] shop, locker, pass and dailies')
        e=await pg.evaluate("""()=>{ save.coins=100; shopTab='stock'; navGo('shop'); const c=document.querySelector('#shopGrid .item:not([data-bundle])'); const id=c.dataset.id; c.click();
              const open=!document.getElementById('buyModal').classList.contains('hidden'); const t=document.getElementById('buyGoT').textContent; return {id,open,t,owned:save.owned.includes(id)}; }""")
        check('shop: tapping an item you cannot afford opens a card that explains how to earn (never a dead button)',e['open'] and e['t']=='PLAY TO EARN' and not e['owned'],e)
        e2=await pg.evaluate("""()=>{ closeModal('buyModal'); _buyCtx=null; save.coins=20000; buildShop(); const c=document.querySelector('#shopGrid .item:not([data-bundle])'); const id=c.dataset.id; const cost=findItem(id).unl.cost; c.click();
              const before=save.coins; const stillLocked=!save.owned.includes(id); document.getElementById('buyGo').click();
              return {id,cost,spent:before-save.coins,owned:save.owned.includes(id),eq:equippedId(itemKind(id))===id,stillLocked,closed:document.getElementById('buyModal').classList.contains('hidden')}; }""")
        check('shop: one tap never spends coins — purchase needs the BUY confirm',e2['stillLocked'])
        check('shop: BUY charges the exact price, unlocks and equips the item',e2['spent']==e2['cost'] and e2['owned'] and e2['eq'] and e2['closed'],e2)
        e3=await pg.evaluate("""()=>{ const c0=save.coins; openBuy(null,true,buildShop); document.getElementById('buyGo').click(); return {spent:c0-save.coins,ok:bundleOwned(),gone:!document.querySelector('[data-bundle]')}; }""")
        check('shop: bundle unlocks all 3 items for 999 and leaves the shelf',e3['spent']==999 and e3['ok'] and e3['gone'],e3)
        l=await pg.evaluate("""()=>{ lockTab='skins'; navGo('locker'); const lock=[...document.querySelectorAll('#grid .item')].find(c=>{const it=findItem(c.dataset.id); return it.unl&&it.unl.lvl&&save.lvl<it.unl.lvl;});
              const id=lock.dataset.id; lock.click(); const own=[...document.querySelectorAll('#grid .item')].find(c=>c.dataset.id==='rookie'); own.click(); return {lockedStill:!itemOwned(findItem(id)),skin:save.skin,toast:document.getElementById('toast').textContent}; }""")
        check('locker: level-locked items explain the level needed; owned items equip in one tap',l['lockedStill'] and l['skin']=='rookie',l)
        pz=await pg.evaluate("""()=>{ save.lvl=6; save.xp=0; save.pass=false; save.passClaims=[]; save.passClaimsP=[]; save.coins=5000; navGo('pass');
              const c0=save.coins; document.querySelector('[data-claim="1"]').click(); const free=save.coins-c0;
              document.querySelector('[data-claim="9"]').click(); const noCheat=save.passClaims.indexOf(9)<0;
              document.querySelector('[data-pclaim="1"]').click(); const modal=!document.getElementById('passModal').classList.contains('hidden');
              const c1=save.coins; document.getElementById('passGo').click(); const paid=c1-save.coins;
              const c2=save.coins; document.getElementById('passBuy').click();
              return {free,noCheat,modal,paid,pass:save.pass,claimedAll:passClaimable().length===0,gained:save.coins-c2,item:save.owned.includes('dogtags')}; }""")
        check('pass: free tier pays real coins; unreached tiers cannot be claimed',pz['free']==44 and pz['noCheat'],pz)
        check('pass: premium costs 2,000 earned coins (no real money) and unlocks the premium row',pz['modal'] and pz['paid']==2000 and pz['pass'],pz)
        check('pass: CLAIM ALL grants every reward incl. the tier-5 item',pz['claimedAll'] and pz['gained']>0 and pz['item'],pz)
        d=await pg.evaluate("""()=>{ goHome(); const D=dailyState(); const id=D.pick[0]; D.prog[id]=CHAL[id].t; refreshMenu(); const badge=!!document.querySelector('#mChal .claim');
              document.getElementById('mChal').click(); const c0=save.coins; document.querySelector('#dailyList [data-claim]').click();
              return {badge,paid:save.coins-c0,want:CHAL[id].coins,streak:save.dstreak,pool:D.pick.every(i=>i!=='raceW'&&i!=='shark0')}; }""")
        check('dailies: finished challenge shows CLAIM on the hub and pays out',d['badge'] and d['paid']==d['want'] and d['streak']>=1,d)
        check('dailies: only challenges the kept modes can complete',d['pool'],d)
        tr=await pg.evaluate("""()=>{ closeModal('daily'); save.coins=9000; shopTab='trade'; navGo('shop'); const b=document.querySelector('[data-mbuy]'); if(!b) return {skip:1};
              const c0=save.coins; b.click(); const asked=!document.getElementById('confirm').classList.contains('hidden'); document.getElementById('cfYes').click(); return {asked,spent:c0-save.coins}; }""")
        check('trader: buying asks for confirmation, then charges',tr.get('skip') or (tr['asked'] and tr['spent']>0),tr)
        # ---------------- 4. settings persist across a reload ----------------
        print('[4] settings + save persistence')
        await pg.evaluate("""()=>{ shopTab='stock'; openOptions(); document.getElementById('optSound').click(); document.getElementById('optLefty').click(); document.querySelector('#optBots [data-v=hard]').click();
              const i=document.getElementById('optName'); i.value='<b>Ace"12345678'; i.oninput({target:i}); }""")
        await pg.wait_for_timeout(700); await pg.reload(); await pg.wait_for_timeout(1100)
        s=await pg.evaluate("()=>({sound:save.sound,lefty:save.lefty,bots:save.botEz,name:save.name,coins:save.coins,pass:save.pass,nick:document.getElementById('tbNick').firstChild.nodeValue,v:save.v})")
        check('save: settings, coins and pass survive a reload',s['sound'] is False and s['lefty'] is True and s['bots'] is False and s['coins']>0 and s['pass'] is True,s)
        check('save: callsign is sanitised (no markup) and shown in the top bar',s['name']=='bAce12345678'[:12] or ('<' not in s['name'] and '"' not in s['name'] and len(s['name'])<=12 and s['nick']==s['name']),s)
        lf=await pg.evaluate("()=>{ const p=padPos(), f=firePos(); return p.x>f.x; }")
        check('settings: left-handed mode swaps the pad and fire button',lf)
        await ctx.close()
        # ---------------- 5. every mode starts and ends correctly ----------------
        print('[5] modes')
        ctx,pg=await newpage(br,390,844,'dev/out/dev.html')
        await pg.evaluate("()=>{document.getElementById('splash').click(); save.seen=true;}")
        seq=await pg.evaluate("()=>{ const out=[]; for(let i=0;i<8;i++){ qpStart(); out.push(curMap+':'+mode); startMatch(true); state='menu'; } return out; }")
        check('quickplay: always free-for-all, rotates maps, never repeats back-to-back',all(x.endswith(':ffa') for x in seq) and all(seq[i]!=seq[i+1] for i in range(7)) and len(set(seq))>=3,seq)
        tm=await pg.evaluate("()=>{ const out=[]; for(let i=0;i<4;i++){ teamsStart(); out.push(curMap+':'+mode+':'+(player&&player.team)); startMatch(true); state='menu'; } return out; }")
        check('teams: alternates Search & Destroy and Capture the Flag, player on a team',set(x.rsplit(':',1)[0] for x in tm)=={'quarry:sd','facility:ctf'} and all(x.endswith(':blue') for x in tm),tm)
        md=await pg.evaluate("()=>{ const out={}; buildLobby(); showScreen('lobby'); for(const id of ['oasis','olympus','quarry','facility']){ document.querySelector('.mode[data-mode='+id+']').click(); out[id]=mode+':'+ents.length+':'+state; startMatch(true); state='menu'; } return out; }")
        check('mode list: battle royale (20), pantheon, S&D (10), CTF (12) all launch',md=={'oasis':'br:20:match','olympus':'gods:6:match','quarry':'sd:10:match','facility':'ctf:12:match'},md)
        tw=await pg.evaluate("""()=>{ startMap('quarry'); const mate=ents.find(e=>e!==player&&e.team===player.team); mate.frags=9; player.frags=1; const w0=save.stats.w; endMatch(mate);
              const a={title:document.getElementById('resTitle').textContent,won:save.stats.w-w0,next:!document.getElementById('btnNext').classList.contains('hidden')};
              document.getElementById('btnAgain').click(); const foe=ents.find(e=>e.team&&e.team!==player.team); foe.frags=9; endMatch(foe);
              const b={title:document.getElementById('resTitle').textContent,sub:document.getElementById('resSub').textContent}; return {a,b}; }""")
        check('teams: your squad winning counts as YOUR win even if a teammate top-fragged',tw['a']['title']=='VICTORY!' and tw['a']['won']==1,tw)
        check('teams: losing says DEFEATED with a clear line',tw['b']['title']=='DEFEATED' and 'undefined' not in tw['b']['sub'],tw['b'])
        nx=await pg.evaluate("()=>{ startMap('olympus'); player.frags=15; endMatch(player); const g=document.getElementById('btnNext').classList.contains('hidden'); startMatch(true); goHome(); return g; }")
        check('results: NEXT MAP hides when a mode has one map',nx)
        pm=await pg.evaluate("()=>{ startMap('office'); togglePause(); const p1=state+':'+curScr; document.getElementById('btnQuit').click(); const armed=state; document.getElementById('btnQuit').click(); return {p1,armed,after:state+':'+curScr}; }")
        check('pause: QUIT needs a second tap, then returns to the hub',pm=={'p1':'pause:pausemenu','armed':'pause','after':'menu:menu'},pm)
        ek=await pg.evaluate("()=>{ startMap('office'); document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true})); const a=state; window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true})); const b=state; startMatch(true); goHome(); return [a,b]; }")
        check('desktop: Escape pauses once and resumes once (no double toggle)',ek==['pause','match'] or ek==['match','pause'],ek)
        # ---------------- 6. performance ----------------
        print('[6] performance')
        pf=await pg.evaluate("""()=>{ const run=(n)=>{ const t0=performance.now(); for(let i=0;i<n;i++){ update(1/60); render(); if(inMenuState()) animShell(); } return (performance.now()-t0)/n; };
              goHome(); run(30); const menu=run(240); navGo('shop'); run(30); const shop=run(240);
              save.seen=true; startMap('office'); matchT=170; run(60); const match=run(240); startMap('oasis'); run(60); const br=run(240); startMatch(true); goHome();
              return {menu:+menu.toFixed(2),shop:+shop.toFixed(2),match:+match.toFixed(2),br:+br.toFixed(2)}; }""")
        check(f'perf: hub frame costs {pf["menu"]}ms and shop {pf["shop"]}ms (budget 16.6ms at 60fps)',pf['menu']<6 and pf['shop']<8,pf)
        check(f'perf: 6-player match frame {pf["match"]}ms, 20-player battle royale {pf["br"]}ms',pf['match']<12 and pf['br']<16,pf)
        dm=await pg.evaluate("()=>{ goHome(); const e0=ents.map(e=>e.x+','+e.y).join(';'); for(let i=0;i<120;i++) update(1/60); return e0===ents.map(e=>e.x+','+e.y).join(';'); }")
        check('perf: no hidden bot match is simulated behind the menus any more',dm)
        fps=await pg.evaluate("()=>new Promise(res=>{ let n=0; const t0=performance.now(); const f=()=>{ n++; if(performance.now()-t0<2000) requestAnimationFrame(f); else res(Math.round(n/2)); }; requestAnimationFrame(f); })")
        check(f'perf: hub holds {fps} fps in the browser',fps>=55,fps)
        # ---------------- 7. resilience + device ----------------
        print('[7] resilience, safe areas, audio rules')
        rc=await pg.evaluate("""()=>new Promise(res=>{ save.seen=true; startMap('office'); const real=render; let n=0; render=function(){ if(n++<45) throw new Error('simulated crash'); return real(); };
              setTimeout(()=>{ render=real; res({state,scr:curScr,toast:document.getElementById('toast').textContent}); },1600); })""")
        await pg.wait_for_timeout(300)
        alive=await pg.evaluate("()=>new Promise(res=>{ const t=T; setTimeout(()=>res(T>t),400); })")
        check('resilience: a crashing frame does not freeze the game — it returns to the hub and keeps running',rc['state']=='menu' and rc['scr']=='menu' and alive,rc)
        pg.errs.clear()
        sa=await pg.evaluate("""()=>{ const r=document.documentElement.style; r.setProperty('--sat','47px'); r.setProperty('--sab','34px'); r.setProperty('--sal','0px'); resize();
              const o={t:SAFE.t,b:SAFE.b,pad:Math.round(H-padPos().y),fire:Math.round(H-firePos().y),tb:Math.round(document.getElementById('topbar').getBoundingClientRect().height),
                       nav:Math.round(innerHeight-document.querySelector('.nv').getBoundingClientRect().bottom)};
              r.removeProperty('--sat'); r.removeProperty('--sab'); r.removeProperty('--sal'); resize(); return o; }""")
        check('notch/home-bar: HUD, sticks, top bar and nav all move inside the safe area',sa['t']==47 and sa['b']==34 and sa['pad']==162 and sa['fire']==162 and sa['tb']==105 and sa['nav']>=34,sa)
        au=await pg.evaluate("""()=>{ const calls=[]; const real=tone; let n=0; tone=function(){ n++; return real.apply(this,arguments); };
              try{ audioInit(); }catch(e){} save.sound=true; goHome(); n=0; sfx('ak'); sfx('boom'); const gun=n; n=0; sfx('ui'); sfx('buy'); sfx('dry'); const ui=n; tone=real; return {gun,ui,ac:!!AC}; }""")
        check('audio: gunfire is silent in menus, button sounds still play',(not au['ac']) or (au['gun']==0 and au['ui']>0),au)
        bn=await pg.evaluate("()=>{ goHome(); const n0=banners.length; banner('TEST TOAST',1,0); return {same:banners.length===n0,toast:document.getElementById('toast').textContent}; }")
        check('feedback: messages in menus appear as on-screen toasts (they used to be invisible)',bn['same'] and bn['toast']=='TEST TOAST',bn)
        check('zero script errors across modes, perf and resilience runs',not pg.errs,pg.errs[:3])
        await ctx.close()
        # desktop: no touch sticks, keyboard hint copy
        ctx,pg=await newpage(br,1366,768,'dev/out/dev.html',touch=False)
        dk=await pg.evaluate("()=>({touch:touchUI(),hint:document.getElementById('hintMove').textContent})")
        check('desktop: touch sticks are hidden and the tutorial names WASD + mouse',dk['touch'] is False and 'WASD' in dk['hint'],dk)
        await ctx.close()
        # ---------------- 8. online: real server, real browser ----------------
        print('[8] online against a local copy of the server')
        env=dict(os.environ,MP_PORT='8098',PORT='8098',NODE_PATH=R+'../node_modules')
        srv=subprocess.Popen(['node','mp_server.js'],cwd=R+'../',env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
        time.sleep(3.5)
        ctx=await br.new_context(viewport={'width':390,'height':844},device_scale_factor=2,has_touch=True,is_mobile=True)
        pg=await ctx.new_page(); pg.errs=[]
        pg.on('pageerror',lambda e: pg.errs.append('PAGEERROR '+str(e)))
        await pg.goto('file://'+R+'dev/out/dev.html?server=ws://127.0.0.1:8098'); await pg.wait_for_timeout(900)
        await pg.evaluate("()=>{document.getElementById('splash').click(); document.getElementById('btnOnline').click();}"); await pg.wait_for_timeout(900)
        stt=await pg.evaluate("()=>document.getElementById('partyStat').textContent")
        check('online: the card shows live server status',stt.startswith('SERVER ONLINE'),stt)
        await pg.evaluate("()=>document.getElementById('partyJoin').click()"); await pg.wait_for_timeout(2200)
        on=await pg.evaluate("()=>({on:NET.on,state,n:ents.length,me:!!(player&&player.name===NET.myId),team:NET.team,mode})")
        check('online: JOIN puts you in the live 5v5 with a team and 10 fighters',on['on'] and on['state']=='match' and on['n']==10 and on['me'] and on['team'] in ('red','blue'),on)
        await pg.wait_for_timeout(1500); await pg.screenshot(path=R+'dev/out/online_live.png')
        x0=await pg.evaluate("()=>player.x"); 
        await pg.evaluate("()=>{ keys.KeyD=true; }"); await pg.wait_for_timeout(1200)
        x1=await pg.evaluate("()=>{ keys.KeyD=false; return player.x; }")
        if abs(x1-x0)<=15:  # spawned against a wall on the right: walk left instead
            x0=await pg.evaluate("()=>player.x"); await pg.evaluate("()=>{ keys.KeyA=true; }"); await pg.wait_for_timeout(1200)
            x1=await pg.evaluate("()=>{ keys.KeyA=false; return player.x; }")
        dead=await pg.evaluate("()=>!!(player&&(player.dead||player.downed))")
        check('online: your input moves your fighter on the server',abs(x1-x0)>15 or dead,(x0,x1,dead))
        await pg.evaluate("()=>togglePause()"); await pg.wait_for_timeout(500)
        pz=await pg.evaluate("()=>({on:NET.on,scr:curScr,label:document.getElementById('btnQuitT').textContent})")
        check('online: pause shows a menu with LEAVE MATCH while the live match keeps running',pz=={'on':True,'scr':'pausemenu','label':'LEAVE MATCH'},pz)
        await pg.evaluate("()=>{document.getElementById('btnQuit').click();document.getElementById('btnQuit').click();}"); await pg.wait_for_timeout(700)
        off=await pg.evaluate("()=>({on:NET.on,state,scr:curScr})")
        check('online: leaving returns cleanly to the hub',off=={'on':False,'state':'menu','scr':'menu'},off)
        check('online: zero script errors',not pg.errs,pg.errs[:3])
        srv.kill(); await ctx.close()
        await br.close()
    print('\nGATE: %d passed, %d failed'%(len(PASS),len(FAIL)))
    for f in FAIL: print('  FAILED: '+f[:600])
    json.dump({'pass':PASS,'fail':FAIL},open(R+'dev/out/gate_report.json','w'),indent=1)
    sys.exit(1 if FAIL else 0)
asyncio.run(main())
