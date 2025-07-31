import { MilliToSecondsPipe } from './milli-to-seconds.pipe';

describe('MilliToSecondsPipe', () => {
  it('create an instance', () => {
    const pipe = new MilliToSecondsPipe();
    expect(pipe).toBeTruthy();
  });
});
