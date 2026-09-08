"""Read-only UI observations on the explicitly owned loopback fixture.
Creates real guest accounts through the rendered UI; no message/send/upload/2FA action.
No credentials, account identifiers, response bodies or browser console are logged.
"""
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlparse
import json,sys,time,hashlib
from playwright.sync_api import sync_playwright

BASE=sys.argv[1].rstrip('/')
if BASE != 'http://127.0.0.1:65199': raise SystemExit('Expected explicitly owned fixture origin')
OUT=Path(__file__).resolve().parent
REPORT={'scope':'Existing service UI on fixed N1/N2 build 7ec1f0d3183ec242; actual guest full callback, no credentials injected','base':BASE,'status':'OBSERVED','at':datetime.now(timezone.utc).isoformat(),'selection':'mobile remaining Tfa/Board; prior observations preserved in mobile-chat-failure and mobile-profile-failure JSON','runs':[],'limitations':['Synthetic mouse/keyboard in Chrome, no touch gameplay','No send/message/upload/2FA setting or mail action','Observed current fixed build; no baseline browser rebuild','No console bodies, credentials, or account identifiers recorded']}
MEASURE=r'''e=>{ const r=e.getBoundingClientRect();const cx=r.left+r.width/2,cy=r.top+r.height/2;const hit=document.elementFromPoint(cx,cy);const s=getComputedStyle(e);return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,display:s.display,position:s.position,left:s.left,insideViewport:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,centerReceivesPointer:!!hit&&(hit===e||e.contains(hit)),focused:document.activeElement===e}; }'''
PAGE=r'''()=>({path:location.pathname,viewport:{width:innerWidth,height:innerHeight},document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},scroll:{x:scrollX,y:scrollY},content:{x:document.querySelector('.service-content').getBoundingClientRect().x,width:document.querySelector('.service-content').getBoundingClientRect().width},rail:{x:document.querySelector('nav.service-rail').getBoundingClientRect().x,width:document.querySelector('nav.service-rail').getBoundingClientRect().width}})'''
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
 REPORT['browser']=b.version
 try:
  for width,height in [(390,844)]:
   context=b.new_context(viewport={'width':width,'height':height})
   context.route('**/*',lambda route: route.continue_() if route.request.url.startswith(BASE+'/') else route.abort())
   page=context.new_page(); page.set_default_timeout(15000)
   run={'viewport':{'width':width,'height':height},'pages':[],'pageErrorCount':0,'mailRequestCount':0}
   REPORT['runs'].append(run)
   page.on('pageerror',lambda _:run.__setitem__('pageErrorCount',run['pageErrorCount']+1))
   page.on('request',lambda req:run.__setitem__('mailRequestCount',run['mailRequestCount']+1) if urlparse(req.url).path.startswith('/auth/email') else None)
   page.goto(BASE+'/login'); page.get_by_test_id('guest-login').click();page.wait_for_url(lambda u:urlparse(str(u)).path=='/')
   page.get_by_role('link',name='프로필 설정',exact=True).wait_for()
   run['frontendScripts']=page.locator('script[src]').evaluate_all('(es)=>es.map(e=>new URL(e.src).pathname)')
   for route,label,ready in [('tfa','2FA 보안 설정','button.sky-button'),('board','전적과 랭킹','table')]:
    page.get_by_role('link',name=label,exact=True).click(no_wait_after=True)
    page.wait_for_url(lambda u:urlparse(str(u)).path=='/'+route)
    page.locator(ready).first.wait_for(state='visible')
    page.wait_for_timeout(300)
    item={'name':route,'initial':page.evaluate(PAGE),'elements':{}}
    run['pages'].append(item)
    targets={
      'chat':{'channelBar':page.locator('.channel-bar'),'messageInput':page.get_by_placeholder('Enter message...'),'send':page.get_by_role('button',name='Send',exact=True)},
      'info':{'nicknameInput':page.locator('#username'),'choose':page.get_by_role('button',name='Choose',exact=True),'upload':page.locator('#chooseFile'),'main':page.get_by_role('button',name='Go to Main',exact=True)},
      'tfa':{'turnOn':page.get_by_role('button',name='Turn on 2FA',exact=True),'main':page.get_by_role('button',name='Go to Main',exact=True)},
      'board':{'table':page.locator('table'),'achievements':page.locator('th').filter(has_text='Achievements')}
    }[route]
    for name,loc in targets.items():item['elements'][name]=loc.evaluate(MEASURE)
    item['screenshot']=f'home-service-layout-{route}-{width}x{height}.png'
    page.screenshot(path=str(OUT/item['screenshot']),full_page=False)
    if route=='chat':
     # Open only the Channels list; do not select users or enter any conversation.
     page.get_by_text('Channels',exact=True).filter(visible=True).click()
     item['channelSelectionCount']=page.locator('.channel-bar .dropdown-selection-text').count();item['messageBubbleCount']=page.locator('#msgContainer > *').count()
     field=page.get_by_placeholder('Enter message...')
     try:
      field.click(timeout=2000);field.fill('layout draft');field.fill('');item['realInputFocus']='SUCCESS'
     except Exception as e:
      item['realInputFocus']='FAILED';item['inputFailureType']=type(e).__name__;REPORT['status']='OBSERVED_WITH_ISSUES'
     item['inputAfterRealFocus']=field.evaluate(MEASURE);item['afterFocus']=page.evaluate(PAGE)
    elif route=='info':
     field=page.locator('#username');field.click();field.fill('layout');field.fill('')
     item['inputAfterRealFocus']=field.evaluate(MEASURE)
     page.get_by_role('button',name='Choose',exact=True).click(trial=True)
     item['chooseActionableTrial']=True;item['afterFocus']=page.evaluate(PAGE)
     item['focusScreenshot']=f'home-service-layout-info-focused-{width}x{height}.png'
     page.screenshot(path=str(OUT/item['focusScreenshot']),full_page=False)
     page.get_by_role('button',name='Go to Main',exact=True).click();page.wait_for_url(lambda u:urlparse(str(u)).path=='/')
     item['realMainReturn']=True
    elif route=='tfa':
     page.get_by_role('button',name='Turn on 2FA',exact=True).click(trial=True)
     item['turnOnActionableTrial']=True
     page.get_by_role('button',name='Turn on 2FA',exact=True).focus()
     item['turnOnFocused']=page.get_by_role('button',name='Turn on 2FA',exact=True).evaluate(MEASURE)
     page.get_by_role('button',name='Go to Main',exact=True).click();page.wait_for_url(lambda u:urlparse(str(u)).path=='/')
     item['realMainReturn']=True
    else:item['tableRows']=page.locator('tbody tr').count()
   context.close()
 except Exception as e:
  REPORT['status']='INCOMPLETE';REPORT['failureType']=type(e).__name__;REPORT['failure']=str(e).split('Call log:')[0][:300]
  raise
 finally:
  b.close();REPORT['finishedAt']=datetime.now(timezone.utc).isoformat();(OUT/'home-service-layout.json').write_text(json.dumps(REPORT,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'status':REPORT['status'],'viewports':len(REPORT['runs']),'pages':sum(len(x['pages']) for x in REPORT['runs'])}))
