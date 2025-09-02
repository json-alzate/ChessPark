import { StringToFlagPipe } from './string-to-flag.pipe';

describe('StringToFlagPipe', () => {
  it('create an instance', () => {
    const pipe = new StringToFlagPipe();
    expect(pipe).toBeTruthy();
  });
});
