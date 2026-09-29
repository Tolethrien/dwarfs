export default class Spring {
  private static readonly CRITICAL_BAND = 1e-4;
  public value = 0;
  public velocity = 0;
  private omega = 0;
  private damping = 1;

  constructor(frequency: number, damping: number) {
    this.set(frequency, damping);
  }

  public set(frequency: number, damping: number) {
    this.omega = Math.PI * 2 * frequency;
    this.damping = damping;
  }
  public impulse(velocity: number) {
    this.velocity += velocity;
  }
  public velocityForPeak(peak: number) {
    return peak / this.peakPerVelocity();
  }
  public get isSettled() {
    return this.value === 0 && this.velocity === 0;
  }
  public reset() {
    this.value = this.velocity = 0;
  }

  public update(delta: number, rest: number) {
    if (this.isSettled || delta <= 0) return;
    const omega = this.omega;
    const damping = this.damping;
    const start = this.value;
    const speed = this.velocity;
    if (damping < 1 - Spring.CRITICAL_BAND) {
      const decay = damping * omega;
      const turn = omega * Math.sqrt(1 - damping * damping);
      const fade = Math.exp(-decay * delta);
      const cos = Math.cos(turn * delta);
      const sin = Math.sin(turn * delta);
      const swing = (speed + decay * start) / turn;
      this.value = fade * (start * cos + swing * sin);
      this.velocity =
        fade *
        ((swing * turn - decay * start) * cos -
          (start * turn + decay * swing) * sin);
    } else if (damping > 1 + Spring.CRITICAL_BAND) {
      const root = omega * Math.sqrt(damping * damping - 1);
      const fast = -damping * omega - root;
      const slow = -damping * omega + root;
      const slowPart = (speed - fast * start) / (slow - fast);
      const fastPart = start - slowPart;
      const slowFade = Math.exp(slow * delta);
      const fastFade = Math.exp(fast * delta);
      this.value = slowPart * slowFade + fastPart * fastFade;
      this.velocity = slowPart * slow * slowFade + fastPart * fast * fastFade;
    } else {
      const lean = speed + omega * start;
      const fade = Math.exp(-omega * delta);
      this.value = (start + lean * delta) * fade;
      this.velocity = (speed - omega * lean * delta) * fade;
    }
    if (Math.abs(this.value) < rest && Math.abs(this.velocity) < rest * omega)
      this.reset();
  }

  private peakPerVelocity() {
    const omega = this.omega;
    const damping = this.damping;
    if (damping < 1 - Spring.CRITICAL_BAND) {
      const ratio = Math.sqrt(1 - damping * damping);
      return Math.exp((-damping * Math.atan2(ratio, damping)) / ratio) / omega;
    }
    if (damping > 1 + Spring.CRITICAL_BAND) {
      const root = Math.sqrt(damping * damping - 1);
      const fast = -omega * (damping + root);
      const slow = -omega * (damping - root);
      const time = Math.log(fast / slow) / (slow - fast);
      return (Math.exp(slow * time) - Math.exp(fast * time)) / (slow - fast);
    }
    return 1 / (omega * Math.E);
  }
}
