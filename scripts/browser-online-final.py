"""Independent final online browser checks against one owned fixture.

Real guest redirects, browser keyboard input and native WebSocket/Audio/Canvas
methods are used. The audit wrappers only observe calls or close the observer's
transport; they never create game events, alter scores or replace audio output.
"""
import argparse
import asyncio
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright


AUDIT = r"""(() => {
  const counters = {serverEvents: 0, serverPaddles: 0, whitePaddles: 0,
    trailDraws: 0, audioCreated: 0, audioClosed: 0, oscillatorsStarted: 0,
    activeOscillators: 0, inputPackets: 0, lastInput: null, socketsOpened: 0,
    lastServerPaddleTick: null, lastServerPaddleEpoch: null};
  const contexts = [], activeByContext = new WeakMap(), sockets = new Set(), events = new Set();
  const socketNumbers = new WeakMap(), transportHistory = [], keyDowns = {}, heldKeys = new Set();
  let keySequence = 0;
  const allowedKeys = ['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'KeyD', 'Space'];
  window.addEventListener('keydown', event => {
    if (event.target?.dataset?.testid !== 'online-court' || !allowedKeys.includes(event.code)) return;
    keyDowns[event.code] = ++keySequence; heldKeys.add(event.code);
  }, true);
  window.addEventListener('keyup', event => heldKeys.delete(event.code), true);
  window.addEventListener('blur', () => heldKeys.clear());
  function category(value) {
    const message = typeof value === 'string' ? value : value?.message;
    if (typeof message !== 'string') return 'unclassified';
    if (message.includes('이미 연결된 게임 세션')) return 'active-session-conflict';
    if (message.includes('jwt expired') || message.includes('만료')) return 'expired';
    if (/unauthori[sz]ed|forbidden|인증/i.test(message)) return 'authentication';
    if (/websocket|transport/i.test(message)) return 'transport';
    if (/timeout|시간/i.test(message)) return 'timeout';
    return 'unclassified';
  }
  function record(type, details = {}) {
    transportHistory.push({type, atMs: Math.round(performance.now()), ...details});
    if (transportHistory.length > 64) transportHistory.shift();
  }
  function packet(data, outbound, connection) {
    if (typeof data !== 'string') return;
    if (!outbound && data.startsWith('41/game')) record('namespace-server-disconnect', {connection});
    if (!outbound && data.startsWith('44/game,')) {
      try { record('namespace-connect-error', {connection, category: category(JSON.parse(data.slice(data.indexOf(',') + 1)))}); }
      catch { record('namespace-connect-error', {connection, category: 'unclassified'}); }
    }
    if (!data.startsWith('42/game,')) return;
    try {
      const [name, value] = JSON.parse(data.slice(data.indexOf('[')));
      if (outbound && name === 'keyboardEvent') {
        counters.inputPackets++;
        counters.lastInput = {up: value.up, down: value.down, actionId: value.actionId,
          keySequence, heldKeys: [...heldKeys]};
      }
      if (!outbound && ['error', 'exception'].includes(name))
        record('game-error', {connection, category: category(value)});
      if (outbound || name !== 'snapshot' || !Array.isArray(value.events)) return;
      for (const item of value.events) {
        const key = [value.matchId, value.instanceId, value.clockEpoch, item.id].join(':');
        if (events.has(key)) continue;
        events.add(key); counters.serverEvents++;
        if (item.event?.type === 'paddle') {
          counters.serverPaddles++; counters.lastServerPaddleTick = item.event.tick;
          counters.lastServerPaddleEpoch = value.clockEpoch;
        }
      }
      while (events.size > 2048) events.delete(events.values().next().value);
    } catch { /* Non-event Socket.IO packets are outside this observer. */ }
  }
  const NativeSocket = window.WebSocket;
  window.WebSocket = class extends NativeSocket {
    constructor(...args) {
      super(...args); const connection = ++counters.socketsOpened;
      sockets.add(this); socketNumbers.set(this, connection); record('transport-created', {connection});
      this.addEventListener('open', () => record('transport-open', {connection}));
      this.addEventListener('error', () => record('transport-error', {connection}));
      this.addEventListener('close', event => {
        sockets.delete(this); record('transport-close', {connection, code: event.code,
          wasClean: event.wasClean, category: category(event.reason)});
      });
      this.addEventListener('message', event => packet(event.data, false, connection));
    }
    send(data) { packet(data, true, socketNumbers.get(this)); return super.send(data); }
  };
  const NativeAudio = window.AudioContext;
  if (NativeAudio) window.AudioContext = class extends NativeAudio {
    constructor(...args) { super(...args); contexts.push(this); activeByContext.set(this, new Set()); counters.audioCreated++; }
    createOscillator() {
      const oscillator = super.createOscillator(), start = oscillator.start.bind(oscillator);
      const active = activeByContext.get(this);
      oscillator.start = (...args) => { const result = start(...args);
        counters.oscillatorsStarted++; active.add(oscillator); return result; };
      oscillator.addEventListener('ended', () => active.delete(oscillator), {once: true});
      return oscillator;
    }
    close() { return super.close().then(value => { counters.audioClosed++; return value; }); }
  };
  const fillRect = CanvasRenderingContext2D.prototype.fillRect;
  CanvasRenderingContext2D.prototype.fillRect = function(x, y, width, height) {
    if (this.canvas.dataset.testid === 'online-court' && this.fillStyle === '#ffffff' &&
        width === 30 && (x === 20 || x === 1150)) counters.whitePaddles++;
    return fillRect.call(this, x, y, width, height);
  };
  const fill = CanvasRenderingContext2D.prototype.fill;
  CanvasRenderingContext2D.prototype.fill = function(...args) {
    if (this.canvas.dataset.testid === 'online-court' &&
        /^rgba\(230,\s*237,\s*255,/.test(String(this.fillStyle))) counters.trailDraws++;
    return fill.apply(this, args);
  };
  Object.defineProperty(window, '__FINAL_ONLINE_AUDIT__', {value: Object.freeze({
    read: () => ({...counters, keyDowns: {...keyDowns}, transportHistory: transportHistory.map(entry => ({...entry})), audioStates: contexts.map(context => context.state), openSockets: sockets.size,
      activeOscillators: contexts.reduce((sum, context) => sum + (context.state === 'closed' ? 0 : activeByContext.get(context).size), 0)}),
    closeTransport: () => { for (const socket of sockets) {
      record('controlled-close-requested', {connection: socketNumbers.get(socket)}); socket.close();
    } },
  })});
})();"""


class BrowserChecks:
    def __init__(self, browser, base, output):
        self.browser, self.base, self.output = browser, base, output
        self.contexts = []
        self.page_errors = []
        self.results = []

    async def guest(self, route='/game?debug=1'):
        context = await self.browser.new_context(viewport={'width': 1440, 'height': 900}, reduced_motion='no-preference')
        self.contexts.append(context)
        await context.add_init_script(AUDIT)
        async def allow_owned(request):
            if request.request.url.startswith(self.base + '/'):
                await request.continue_()
            else:
                await request.abort()
        await context.route('**/*', allow_owned)
        page = await context.new_page()
        page.set_default_timeout(20000)
        page.on('pageerror', lambda _: self.page_errors.append('Uncaught browser error'))
        await page.goto(self.base + '/login')
        await page.get_by_role('button', name='게스트로 체험하기', exact=True).click(no_wait_after=True)
        await page.wait_for_url(lambda url: urlparse(str(url)).path != '/login')
        await page.goto(self.base + route)
        await page.get_by_test_id('online-play').wait_for()
        return page

    async def pair(self, observer=False):
        pages = [await self.guest(), await self.guest()]
        watcher = await self.guest('/spectate?debug=1') if observer else None
        await asyncio.gather(*(p.get_by_test_id('online-play').click(no_wait_after=True) for p in pages))
        await asyncio.gather(*(p.wait_for_function('!!window.__ONLINE_DEBUG__') for p in pages))
        identities = [await p.evaluate('window.__ONLINE_DEBUG__.identity()') for p in pages]
        assert identities[0]['matchId'] == identities[1]['matchId']
        assert {identity['side'] for identity in identities} == {'left', 'right'}
        await asyncio.gather(*(p.get_by_test_id('online-court').click(no_wait_after=True) for p in pages))
        return pages, watcher, identities[0]['matchId']

    async def audit(self, page):
        return await page.evaluate('window.__FINAL_ONLINE_AUDIT__.read()')

    async def screenshot(self, page, name):
        await page.screenshot(path=str(self.output / name), full_page=True, timeout=45000)

    async def wait_presented_hit(self, page, before):
        """Require an actually presented new hit in a bounded stable window.

        Old queued point/serve effects can be discarded before the next hit.
        Re-arm after that boundary, retaining the caller's original native
        tone/flash baseline for the entire observation (including re-arms).
        """
        deadline, rearmed = time.monotonic() + 45, 0
        metrics = await page.evaluate('window.__ONLINE_DEBUG__.metrics()')
        identity = await page.evaluate('window.__ONLINE_DEBUG__.identity()')
        paddles = before['serverPaddles']
        boundaries = []
        while time.monotonic() < deadline:
            sample = await page.wait_for_function('''baseline => {
              const d = window.__ONLINE_DEBUG__, a = window.__FINAL_ONLINE_AUDIT__.read(), m = d?.metrics();
              const ready = m && (m.clockEpoch !== baseline.epoch || m.effectsSkipped !== baseline.skipped ||
                (a.serverPaddles > baseline.paddles && a.lastServerPaddleEpoch === m.clockEpoch &&
                 m.presentationTick >= a.lastServerPaddleTick && m.effectsPresented > baseline.presented &&
                 m.serverEventsReceived > baseline.received));
              return ready ? {metrics: m, audit: a, identity: d.identity()} : false;
            }''', arg={'paddles': paddles, 'presented': metrics['effectsPresented'],
                       'received': metrics['serverEventsReceived'], 'epoch': metrics['clockEpoch'],
                       'skipped': metrics['effectsSkipped']}, timeout=max(1, (deadline - time.monotonic()) * 1000))
            observed = await sample.json_value()
            await sample.dispose()
            after, audit = observed['metrics'], observed['audit']
            assert all(observed['identity'][key] == identity[key] for key in ['matchId', 'instanceId', 'generation']), 'Match owner changed during effect observation'
            if after['clockEpoch'] != metrics['clockEpoch'] or after['effectsSkipped'] != metrics['effectsSkipped']:
                boundaries.append({'epochChanged': after['clockEpoch'] != metrics['clockEpoch'],
                                   'additionalSkipped': after['effectsSkipped'] - metrics['effectsSkipped']})
                metrics, paddles = after, audit['serverPaddles']
                rearmed += 1
                continue
            assert audit['serverPaddles'] > paddles and audit['lastServerPaddleEpoch'] == after['clockEpoch']
            assert after['presentationTick'] >= audit['lastServerPaddleTick']
            assert after['effectsPresented'] > metrics['effectsPresented'] and after['serverEventsReceived'] > metrics['serverEventsReceived']
            return {'stableNewHitPresented': True, 'clockEpoch': after['clockEpoch'],
                    'serverHitTick': audit['lastServerPaddleTick'], 'presentationTick': after['presentationTick'],
                    'skippedDuringStableWindow': 0, 'rearmedWindows': rearmed, 'priorBoundaries': boundaries}
        raise AssertionError('No new hit was presented in a stable observation window within 45 seconds')

    async def close_case(self):
        for context in self.contexts:
            await context.close()
        self.contexts = []

    async def match(self):
        row = {'case': 'real-six-point-match-and-mouse-rematch', 'status': 'FAIL'}
        self.results.append(row)
        pages, _, previous_match = await self.pair()
        await asyncio.gather(*(p.keyboard.down('ArrowUp') for p in pages))
        try:
            await asyncio.gather(*(p.get_by_test_id('online-result').wait_for(timeout=110000) for p in pages))
        finally:
            await asyncio.gather(*(p.keyboard.up('ArrowUp') for p in pages))
        scores = []
        for page in pages:
            scores.append([int(await page.get_by_test_id('online-score-left').inner_text()),
                           int(await page.get_by_test_id('online-score-right').inner_text())])
        assert scores[0] == scores[1] and max(scores[0]) == 6
        row['confirmedVisibleScores'] = scores[0]
        await self.screenshot(pages[0], 'final-online-six-point-result.png')
        await asyncio.gather(*(p.get_by_test_id('online-rematch').click(no_wait_after=True) for p in pages))
        await asyncio.gather(*(p.wait_for_function(
            'old => !!window.__ONLINE_DEBUG__ && window.__ONLINE_DEBUG__.identity().matchId !== old && window.__ONLINE_DEBUG__.latest().tick > 5',
            arg=previous_match) for p in pages))
        current = [await p.evaluate('window.__ONLINE_DEBUG__.identity().matchId') for p in pages]
        assert current[0] == current[1]
        row['mouseRematchSameNewMatch'] = True
        await pages[0].get_by_test_id('online-menu').click(no_wait_after=True)
        await pages[0].wait_for_url(self.base + '/')
        await pages[0].wait_for_function('!window.__ONLINE_DEBUG__')
        row.update(menuDisposed=True, status='PASS')

    async def observer(self):
        row = {'case': 'observer-alone-reconnect-with-players-live', 'status': 'FAIL'}
        self.results.append(row)
        pages, watcher, room = await self.pair(observer=True)
        drivers = [PaddleDriver(page) for page in pages]
        for driver in drivers:
            driver.start()
        try:
            await watcher.get_by_test_id('online-play').click(no_wait_after=True)
            await watcher.locator('.spectate-list button').first.click(no_wait_after=True)
            await watcher.get_by_test_id('online-play').click(no_wait_after=True)
            await watcher.wait_for_function('window.__ONLINE_DEBUG__?.identity().side === "spectator"')
            assert await watcher.evaluate('window.__ONLINE_DEBUG__.identity().matchId') == room
            player_before = [await p.evaluate('window.__ONLINE_DEBUG__.latest().tick') for p in pages]
            watcher_before = await watcher.evaluate('({identity: window.__ONLINE_DEBUG__.identity(), tick: window.__ONLINE_DEBUG__.latest().tick})')
            watcher_sockets_before = (await self.audit(watcher))['socketsOpened']
            sockets_before = [(await self.audit(p))['socketsOpened'] for p in pages]
            await watcher.evaluate('window.__FINAL_ONLINE_AUDIT__.closeTransport()')
            await watcher.wait_for_timeout(50)
            await watcher.context.set_offline(True)
            row['faultTiming'] = {'offlineCommandCompletedAtMs': await watcher.evaluate('performance.now()')}
            await watcher.get_by_test_id('online-status').filter(has_text='연결이 끊').wait_for(timeout=20000)
            row['faultTiming']['clientDisconnectedVisibleAtMs'] = await watcher.evaluate('performance.now()')
            await asyncio.sleep(0.8)
            await watcher.context.set_offline(False)
            row['faultTiming']['onlineCommandCompletedAtMs'] = await watcher.evaluate('performance.now()')
            # Recovery status is transient: full ready replaces the old owner.
            # Require the actual new connection and generation before live ticks.
            await watcher.wait_for_function('''old => {
              const a = window.__FINAL_ONLINE_AUDIT__.read(), d = window.__ONLINE_DEBUG__;
              return a.socketsOpened > old.sockets && a.openSockets > 0 && d &&
                d.identity().side === 'spectator' && d.identity().matchId === old.match &&
                d.identity().generation > old.generation && d.latest().tick > old.tick;
            }''', arg={'sockets': watcher_sockets_before, 'match': room,
                       'generation': watcher_before['identity']['generation'], 'tick': watcher_before['tick']}, timeout=20000)
            before = await watcher.evaluate('window.__ONLINE_DEBUG__.latest().tick')
            await watcher.wait_for_function('before => window.__ONLINE_DEBUG__?.latest().tick > before + 6', arg=before)
            assert await watcher.evaluate('window.__ONLINE_DEBUG__.metrics().inputMessages') == 0
            assert (await self.audit(watcher))['inputPackets'] == 0
            for index, page in enumerate(pages):
                assert await page.evaluate('window.__ONLINE_DEBUG__.identity().matchId') == room
                assert await page.evaluate('window.__ONLINE_DEBUG__.latest().tick') > player_before[index]
                assert (await self.audit(page))['socketsOpened'] == sockets_before[index]
                assert not await page.get_by_test_id('online-result').is_visible()
            row.update(observerTickAdvanced=True, observerInputMessages=0,
                       observerNewConnectionAndGeneration=True,
                       playerConnectionsUnchanged=True, sameLiveMatch=True)
            await self.screenshot(watcher, 'final-observer-reconnected.png')
            await self.screenshot(pages[0], 'final-observer-peer-still-playing.png')
            for page in pages:
                assert not await page.get_by_test_id('online-result').is_visible()
                assert await page.evaluate('window.__ONLINE_DEBUG__.identity().matchId') == room
            assert await watcher.evaluate('window.__ONLINE_DEBUG__.metrics().inputMessages') == 0
            assert (await self.audit(watcher))['inputPackets'] == 0
            row['observerInputZeroAfterScreenshots'] = True
            row['observerTransportHistory'] = (await self.audit(watcher))['transportHistory']
            row['status'] = 'PASS'
        except Exception:
            row['failureState'] = []
            for diagnostic_page in [*pages, watcher]:
                try:
                    state = await diagnostic_page.evaluate('''owned => {
                      const d = window.__ONLINE_DEBUG__, a = window.__FINAL_ONLINE_AUDIT__.read();
                      const status = document.querySelector('[data-testid=online-status]')?.textContent || '';
                      return {sameOwnedMatch: d?.identity().matchId === owned, side: d?.identity().side || null,
                        generation: d?.identity().generation || null, tick: d?.latest().tick || null,
                        phase: d?.latest().phase || null, inputMessages: d?.metrics().inputMessages ?? null,
                        socketsOpened: a.socketsOpened, openSockets: a.openSockets, inputPackets: a.inputPackets,
                        statusDisconnected: status.includes('연결이 끊'), statusRecovered: status.includes('복구'),
                        statusWatching: status.includes('관전 중'), statusLookupFailure: status.includes('조회에 실패'),
                        statusUnavailable: status.includes('복구할 수 없습니다'), statusSaved: status.includes('저장되었습니다'),
                        statusActiveSessionConflict: status.includes('이미 연결된 게임 세션'),
                        transportHistory: a.transportHistory,
                        resultVisible: !!document.querySelector('[data-testid=online-result]')};
                    }''', room)
                    row['failureState'].append(state)
                except Exception as error:
                    row['failureState'].append({'diagnosticError': type(error).__name__})
            raise
        finally:
            for driver in drivers:
                await driver.stop()

    async def effects(self):
        row = {'case': 'authoritative-feedback-audio-motion-and-online-keys', 'status': 'FAIL'}
        self.results.append(row)
        pages, _, room = await self.pair()
        page = pages[0]
        drivers = [PaddleDriver(player) for player in pages]
        for driver in drivers:
            driver.start()
        try:
            await page.get_by_test_id('online-sound').wait_for()
            await page.get_by_test_id('online-key-hint').wait_for()
            await drivers[0].stop()
            layout = page.get_by_test_id('online-key-layout')
            await layout.select_option('wasd')
            await page.get_by_test_id('online-court').click(no_wait_after=True)
            hint = await page.get_by_test_id('online-key-hint').inner_text()
            assert all(key in hint for key in ['W', 'S', 'D'])
            await asyncio.sleep(0.2)
            before_keys = await self.audit(page)
            await page.keyboard.down('w')
            try:
                native_key = (await self.audit(page))['keyDowns']['KeyW']
                await page.wait_for_function('baseline => { const a = window.__FINAL_ONLINE_AUDIT__.read(); return a.inputPackets > baseline.packets && a.lastInput?.keySequence >= baseline.key && a.lastInput?.heldKeys.includes("KeyW") && a.lastInput?.up === true && a.lastInput?.down === false; }', arg={'packets': before_keys['inputPackets'], 'key': native_key})
            finally:
                await page.keyboard.up('w')
            await page.wait_for_function('window.__FINAL_ONLINE_AUDIT__.read().lastInput?.up === false')
            before_arrow = await self.audit(page)
            await page.keyboard.down('ArrowDown')
            try:
                native_key = (await self.audit(page))['keyDowns']['ArrowDown']
                await page.wait_for_function('baseline => { const a = window.__FINAL_ONLINE_AUDIT__.read(); return a.inputPackets > baseline.packets && a.lastInput?.keySequence >= baseline.key && a.lastInput?.heldKeys.includes("ArrowDown"); }', arg={'packets': before_arrow['inputPackets'], 'key': native_key})
                inactive_arrow = await self.audit(page)
                assert not inactive_arrow['lastInput']['up'] and not inactive_arrow['lastInput']['down']
            finally:
                await page.keyboard.up('ArrowDown')
            row['wasdPresetMatchesHudAndOutgoingDirection'] = True
            row['arrowsDoNotMoveTheWasdPlayer'] = True
            row['nativeInputCausality'] = 'Observed outgoing packet carries the actual canvas keydown sequence and held key'
            drivers[0].layout = 'wasd'
            drivers[0].start()


            await page.wait_for_function('''() => {
              const a = window.__FINAL_ONLINE_AUDIT__.read(), m = window.__ONLINE_DEBUG__?.metrics();
              return a.serverPaddles > 0 && a.whitePaddles > 0 && m?.effectsPresented > 0;
            }''', timeout=45000)
            initial = await self.audit(page)
            assert initial['audioCreated'] == 0 and initial['oscillatorsStarted'] == 0
            row['defaultMutedWithRealServerHitAndCanvasFlash'] = True

            await page.get_by_test_id('online-sound').click(no_wait_after=True)
            await page.get_by_test_id('online-court').click(no_wait_after=True)
            await page.wait_for_function('''() => {
              const a = window.__FINAL_ONLINE_AUDIT__.read();
              return a.audioCreated === 1 && a.audioStates.includes('running') && a.oscillatorsStarted > 0;
            }''', timeout=45000)
            row['gestureUnlockedNativeAudioAndRealOscillator'] = True
            row['audioStatusWhenEnabled'] = await page.get_by_test_id('online-audio-status').inner_text()

            await page.get_by_test_id('online-sound').click(no_wait_after=True)
            await page.get_by_test_id('online-court').click(no_wait_after=True)
            await asyncio.sleep(0.3)
            muted = await self.audit(page)
            row['mutePresentationWindow'] = await self.wait_presented_hit(page, muted)
            after_mute = await self.audit(page)
            assert after_mute['oscillatorsStarted'] == muted['oscillatorsStarted']
            assert after_mute['activeOscillators'] == 0
            row['muteStopsNewNativeTonesWhileServerHitsContinue'] = True

            motion = page.get_by_test_id('online-motion')
            await motion.select_option('system')
            await page.emulate_media(reduced_motion='reduce')
            await page.get_by_test_id('online-court').click(no_wait_after=True)
            await asyncio.sleep(0.3)
            reduced = await self.audit(page)
            row['systemMotionPresentationWindow'] = await self.wait_presented_hit(page, reduced)
            after_reduced = await self.audit(page)
            assert after_reduced['whitePaddles'] == reduced['whitePaddles']
            assert after_reduced['trailDraws'] == reduced['trailDraws']
            row['systemReducedMotionSuppressesRealFlashAndTrail'] = True
            await page.emulate_media(reduced_motion='no-preference')
            await motion.select_option('reduce')
            await page.get_by_test_id('online-court').click(no_wait_after=True)
            await asyncio.sleep(0.3)
            explicit_motion = await self.audit(page)
            row['explicitMotionPresentationWindow'] = await self.wait_presented_hit(page, explicit_motion)
            after_motion = await self.audit(page)
            assert after_motion['whitePaddles'] == explicit_motion['whitePaddles']
            assert after_motion['trailDraws'] == explicit_motion['trailDraws']
            row['motionSelectorSuppressesRealFlashAndTrail'] = True
            await self.screenshot(page, 'final-online-reduced-motion.png')
            await motion.select_option('system')

            # Preserve an unmuted preference, then prove route disposal closes
            # its real native audio context and back navigation requires a new gesture.
            await page.get_by_test_id('online-sound').click(no_wait_after=True)
            await page.wait_for_function("document.querySelector('[data-testid=online-audio-status]')?.dataset.audioStatus === 'ready'")
            await self.screenshot(page, 'final-online-effects-and-key-hint.png')
            await drivers[0].stop()
            await motion.select_option('reduce')
            before_exit = await self.audit(page)
            await page.get_by_test_id('online-menu').click(no_wait_after=True)
            await page.wait_for_url(self.base + '/')
            await page.wait_for_function('''() => {
              const a = window.__FINAL_ONLINE_AUDIT__.read();
              return !window.__ONLINE_DEBUG__ && a.audioStates.every(state => state === 'closed') && a.activeOscillators === 0;
            }''')
            row['routeDisposalClosesNativeAudio'] = True
            await page.go_back()
            await page.get_by_test_id('online-play').wait_for()
            assert await page.get_by_test_id('online-key-layout').input_value() == 'wasd'
            assert await page.get_by_test_id('online-motion').input_value() == 'reduce'
            assert await page.get_by_test_id('online-audio-status').get_attribute('data-audio-status') == 'gesture-required'
            assert (await self.audit(page))['audioCreated'] == before_exit['audioCreated']
            row['onlinePresetPersistedAfterRouteReturn'] = True
            row['restoredUnmutedPreferenceDidNotAutostartAudio'] = True
            row['nativeAudioCalls'] = {key: before_exit[key] for key in ['audioCreated', 'oscillatorsStarted', 'serverPaddles', 'whitePaddles']}
            row['status'] = 'PASS'
        finally:
            for driver in drivers:
                await driver.stop()


class PaddleDriver:
    """A browser test player: reads the real server state, presses real keys.

    It keeps the rally alive during slower observer/UI checks. It never assigns
    position, game state, Socket.IO packets or application state.
    """
    def __init__(self, page):
        self.page = page
        self.task = None
        self.held = None
        self.layout = 'arrows'
        self.last_key_down = 0.0

    def start(self):
        self.task = asyncio.create_task(self.run())

    async def run(self):
        while True:
            value = await self.page.evaluate('''() => {
              const debug = window.__ONLINE_DEBUG__; if (!debug) return null;
              const state = debug.latest(), side = debug.identity().side;
              const player = state.players[side], ball = state.ball;
              const toward = side === 'left' ? ball.vx < 0 : ball.vx > 0;
              let target = state.config.height / 2;
              if (toward) {
                const x = side === 'left' ? player.x + player.width + ball.radius : player.x - ball.radius;
                const future = ball.y + ball.vy * Math.max(0, (x - ball.x) / ball.vx);
                const span = state.config.height - 2 * ball.radius;
                const folded = ((future - ball.radius) % (2 * span) + 2 * span) % (2 * span);
                target = ball.radius + (folded <= span ? folded : 2 * span - folded);
              }
              return {side, ball: target, player, phase: state.phase,
                focused: document.activeElement?.dataset.testid === 'online-court' && !document.hidden};
            }''')
            wanted = None
            if value and value['focused'] and value['phase'] in ['ready', 'rally', 'point']:
                delta = value['ball'] - (value['player']['y'] + value['player']['height'] / 2)
                if abs(delta) > 18:
                    wanted = ('w' if delta < 0 else 's') if self.layout == 'wasd' else ('ArrowUp' if delta < 0 else 'ArrowDown')
            if wanted != self.held:
                if self.held:
                    await self.page.keyboard.up(self.held)
                self.held = wanted
                if wanted:
                    await self.page.keyboard.down(wanted)
                    self.last_key_down = time.monotonic()
            elif wanted and time.monotonic() - self.last_key_down >= 0.12:
                # Native focus/blur clears held input; repeat the real key while
                # the court is focused, never while a settings control owns it.
                await self.page.keyboard.down(wanted)
                self.last_key_down = time.monotonic()
            await asyncio.sleep(0.03)

    async def stop(self):
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
            self.task = None
        if self.held:
            await self.page.keyboard.up(self.held)
            self.held = None


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('base')
    parser.add_argument('--out', required=True)
    parser.add_argument('--case', choices=['all', 'match', 'observer', 'effects'], default='all')
    args = parser.parse_args()
    base = args.base.rstrip('/')
    assert urlparse(base).scheme == 'http' and urlparse(base).hostname == '127.0.0.1'
    output = Path(args.out).resolve()
    output.mkdir(parents=True, exist_ok=True)
    report = {'status': 'FAIL', 'at': datetime.now(timezone.utc).isoformat(),
              'viewport': [1440, 900], 'authentication': 'actual guest HTTP redirects',
              'environment': 'Owned loopback fixture; real headless Chrome, keyboard, Socket.IO and native Canvas/AudioContext',
              'limits': 'Automated keyboard, not physical play; native audio method observations, not human hearing; controlled observer WebSocket closure, not WAN'}
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path=os.environ.get(
            'ARCADE_CHROMIUM_EXECUTABLE', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless=True)
        checks = BrowserChecks(browser, base, output)
        report['browser'] = browser.version
        started = time.monotonic()
        try:
            for case in (['match', 'observer', 'effects'] if args.case == 'all' else [args.case]):
                await getattr(checks, case)()
                await checks.close_case()
            assert not checks.page_errors
            report['status'] = 'PASS'
        except Exception as error:
            report['failure'] = type(error).__name__ + ': ' + str(error).split('\n')[0]
            raise
        finally:
            report.update(cases=checks.results, pageErrors=checks.page_errors,
                          elapsedSeconds=round(time.monotonic() - started, 3))
            try:
                await checks.close_case()
                await browser.close()
            finally:
                (output / 'online-final-browser.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
                print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    asyncio.run(main())
