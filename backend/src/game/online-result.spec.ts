import { OnlineResultNotice } from '../../../frontend/src/arcade/online-result';

describe('online result persistence notice', () => {
  let result: OnlineResultNotice;
  beforeEach(() => { result = new OnlineResultNotice(); result.reset('room-1'); });

  it('never infers durable success from a match ending alone', () => {
    expect(result.status).toBe('pending');
    expect(result.message).toBe(
      '경기는 끝났지만 전적 저장 여부를 확인하지 못했습니다.',
    );
  });

  it('retains a failed save when the outcome screen requests its status', () => {
    result.receive({ roomId: 'room-1', status: 'saving' });
    result.receive({ roomId: 'room-1', status: 'retrying' });
    expect(result.message).toContain('재시도');
    result.receive({ roomId: 'room-1', status: 'failed' });
    expect(result.message).toContain('저장에 실패');
    expect(result.message).toContain('반영 여부를 확인할 수 없습니다');
    expect(result.status).toBe('failed');
  });

  it('reports saved only after the matching room receives saved confirmation', () => {
    expect(result.receive({ roomId: 'room-1', status: 'saved' })).toBe(true);
    expect(result.message).toBe('경기 결과가 저장되었습니다.');
  });

  it('ignores stale rooms, missing identity and malformed persistence states', () => {
    for (const value of [null, true, {}, { status: 'saved' },
      { roomId: 'room-old', status: 'saved' }, { roomId: 'room-1', status: 'unknown' }]) {
      expect(result.receive(value)).toBe(false);
    }
    expect(result.status).toBe('pending');
  });

  it.each(['saved', 'failed'])('does not regress terminal %s on late retry events', (status) => {
    result.receive({ roomId: 'room-1', status });
    expect(result.receive({ roomId: 'room-1', status: 'retrying' })).toBe(false);
    expect(result.status).toBe(status);
  });

  it('clears notices for new ready and ignores the previous match thereafter', () => {
    result.receive({ roomId: 'room-1', status: 'failed' });
    result.reset('room-2');
    expect(result.status).toBe('pending');
    expect(result.receive({ roomId: 'room-1', status: 'saved' })).toBe(false);
    expect(result.receive({ roomId: 'room-2', status: 'saved' })).toBe(true);
    result.reset();
    expect(result.receive({ roomId: 'room-2', status: 'saved' })).toBe(false);
  });

  it('accepts only a current-room simulation abort and never turns it into a saved result', () => {
    expect(result.abort({ roomId: 'old-room', status: 'aborted' })).toBe(false);
    expect(result.abort({ roomId: 'room-1', status: 'waiting' })).toBe(false);
    expect(result.abort({ roomId: 'room-1', status: 'aborted' })).toBe(true);
    expect(result.status).toBe('aborted');
    expect(result.message).toContain('승패 결과와 업적은 기록되지');
    expect(result.receive({ roomId: 'room-1', status: 'saved' })).toBe(false);
    result.reset('room-2');
    expect(result.status).toBe('pending');
  });
});
