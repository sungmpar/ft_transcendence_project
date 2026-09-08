"""Actual UI regression checks for root's service layout repair; loopback fixture only.
No credentials are injected/logged; no chat message, profile submission, or 2FA mail/settings action.
"""
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlparse
import json,sys
from playwright.sync_api import sync_playwright
BASE=sys.argv[1].rstrip('/')
u=urlparse(BASE)
if u.scheme!='http' or u.hostname!='127.0.0.1' or u.path or not u.port:raise SystemExit('Explicit loopback fixture origin required')
OUT=Path(__file__).resolve().parent
R={'status':'FAIL','base':BASE,'startedAt':datetime.now(timezone.utc).isoformat(),'authentication':'Actual guest UI, HTTP cookie/JWT and full document callback; no credential injection','checks':[],'runs':[],'limitations':['Chrome synthetic input; no physical keyboard/touch or production service claim','No send-message, nickname submit, file upload, 2FA toggle or mail','Board wide legacy layout is observed separately; no baseline runtime comparison']}
MEASURE=r'''e=>{const r=e.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,centerReceivesPointer:!!h&&(h===e||e.contains(h)),focused:document.activeElement===e};}'''
STATE=r'''()=>({path:location.pathname,viewport:{width:innerWidth,height:innerHeight},document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},scroll:{x:scrollX,y:scrollY},rail:document.querySelector('nav.service-rail').getBoundingClientRect().width,contentX:document.querySelector('.service-content').getBoundingClientRect().x})'''
def check(name,passed,detail=None):
 R['checks'].append({'name':name,'status':'PASS' if passed else 'FAIL',**({'detail':detail} if detail is not None else {})})
 assert passed,name
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True);R['browser']=b.version
 try:
  for w,h in [(1440,900),(390,844)]:
   c=b.new_context(viewport={'width':w,'height':h});c.route('**/*',lambda q:q.continue_() if q.request.url.startswith(BASE+'/') else q.abort())
   page=c.new_page();page.set_default_timeout(15000)
   run={'viewport':{'width':w,'height':h},'pages':[],'pageErrorCount':0,'mailRequestCount':0};R['runs'].append(run)
   page.on('pageerror',lambda _:run.__setitem__('pageErrorCount',run['pageErrorCount']+1))
   page.on('request',lambda req:run.__setitem__('mailRequestCount',run['mailRequestCount']+1) if urlparse(req.url).path.startswith('/auth/email') else None)
   page.goto(BASE+'/login');page.get_by_test_id('guest-login').click(no_wait_after=True);page.wait_for_url(lambda url:urlparse(str(url)).path=='/')
   page.get_by_role('link',name='프로필 설정',exact=True).wait_for();run['frontendScripts']=page.locator('script[src]').evaluate_all('(es)=>es.map(e=>new URL(e.src).pathname)')
   for name,label,ready in [('chat','채팅','.chat-container'),('info','프로필 설정','#username'),('tfa','2FA 보안 설정','button.sky-button'),('board','전적과 랭킹','table')]:
    page.get_by_role('link',name=label,exact=True).click(no_wait_after=True);page.wait_for_url(lambda url:urlparse(str(url)).path=='/'+name)
    page.locator(ready).first.wait_for(state='visible');page.wait_for_timeout(200)
    item={'name':name,'initial':page.evaluate(STATE),'elements':{}};run['pages'].append(item)
    item['screenshot']=f'home-service-layout-after-{name}-{w}x{h}.png';page.screenshot(path=str(OUT/item['screenshot']),full_page=False)
    prefix=f'{w} {name}'
    if name!='board':
     s=item['initial'];check(prefix+' fits horizontal viewport and 80px rail',s['document']['width']<=w and s['rail']==80 and s['contentX']==80,s)
    if name=='chat':
     inp=page.get_by_placeholder('Enter message...');send=page.get_by_role('button',name='Send',exact=True)
     v=inp.evaluate(MEASURE);item['elements']['messageInput']=v;check(prefix+' input has visible positive width',v['width']>0 and v['x']>=80 and v['right']<=w,v)
     inp.click(no_wait_after=True);inp.fill('layout draft');inp.fill('');v=inp.evaluate(MEASURE);check(prefix+' real input focus and editable draft',v['focused'] and v['centerReceivesPointer'],v)
     send.click(trial=True);v=send.evaluate(MEASURE);item['elements']['send']=v;check(prefix+' native Send actionability without sending',v['width']>0 and v['x']>=80 and v['right']<=w and v['centerReceivesPointer'],v)
     item['messageBubbleCount']=page.locator('#msgContainer > *').count()
    elif name=='info':
     inp=page.locator('#username');inp.click(no_wait_after=True);inp.fill('layout');inp.fill('');v=inp.evaluate(MEASURE);check(prefix+' real nickname input focus',v['focused'] and v['centerReceivesPointer'],v)
     choose=page.get_by_role('button',name='Choose',exact=True);choose.click(trial=True);v=choose.evaluate(MEASURE);check(prefix+' Choose native actionability without submit',v['centerReceivesPointer'],v)
     v=page.locator('#chooseFile').evaluate(MEASURE);item['elements']['fileInput']=v;check(prefix+' file input stays inside content width',v['x']>=80 and v['right']<=w,v)
     main=page.get_by_role('button',name='Go to Main',exact=True);main.scroll_into_view_if_needed();v=main.evaluate(MEASURE);item['elements']['main']=v
     check(prefix+' Main center is not intercepted',v['centerReceivesPointer'],v)
     item['mainScreenshot']=f'home-service-layout-after-info-main-{w}x{h}.png';page.screenshot(path=str(OUT/item['mainScreenshot']),full_page=False)
     main.click(no_wait_after=True);page.wait_for_url(lambda url:urlparse(str(url)).path=='/');check(prefix+' actual Main click returns Home',True)
    elif name=='tfa':
     btn=page.get_by_role('button',name='Turn on 2FA',exact=True);btn.click(trial=True);btn.focus();v=btn.evaluate(MEASURE);item['elements']['turnOn']=v;check(prefix+' native setting button focus/actionability without toggle',v['focused'] and v['centerReceivesPointer'],v)
     page.get_by_role('button',name='Go to Main',exact=True).click(no_wait_after=True);page.wait_for_url(lambda url:urlparse(str(url)).path=='/');check(prefix+' actual Main click returns Home',True)
    else:
     item['elements']['table']=page.locator('table').evaluate(MEASURE);item['elements']['achievements']=page.locator('th').filter(has_text='Achievements').evaluate(MEASURE)
     item['status']='OBSERVED_LEGACY_WIDE_LAYOUT' if item['initial']['document']['width']>w else 'OBSERVED'
   check(f'{w} no runtime errors or mail requests',run['pageErrorCount']==0 and run['mailRequestCount']==0)
   c.close()
  R['status']='PASS_WITH_BOARD_LIMITATION'
 except Exception as e:
  R['failureType']=type(e).__name__;R['failure']=str(e).split('Call log:')[0][:300]
  raise
 finally:
  b.close();R['finishedAt']=datetime.now(timezone.utc).isoformat();(OUT/'home-service-layout-after.json').write_text(json.dumps(R,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'status':R['status'],'checks':len(R['checks']),'passed':sum(x['status']=='PASS' for x in R['checks'])}))
