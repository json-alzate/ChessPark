import { SecondsToMinutesSecondsPipe } from './seconds-to-minutes-seconds.pipe';

describe('SecondsToMinutesSecondsPipe', () => {
  it('create an instance', () => {
    const pipe = new SecondsToMinutesSecondsPipe();
    expect(pipe).toBeTruthy();
  });
});
