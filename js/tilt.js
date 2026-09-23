/**
 * 3D Card Tilt & Interactive Glare Physics
 * Applies smooth perspective transformation and dynamic spotlight glare to elements with [data-tilt]
 */
class TiltEffect {
  constructor() {
    this.cards = document.querySelectorAll('[data-tilt]');
    this.maxTilt = 8; // degrees
    this.perspective = 1000; // px
    this.scale = 1.02;

    this.init();
  }

  init() {
    this.cards.forEach((card) => {
      card.style.transformStyle = 'preserve-3d';
      card.style.willChange = 'transform';

      card.addEventListener('mousemove', (e) => this.handleMouseMove(e, card));
      card.addEventListener('mouseleave', () => this.handleMouseLeave(card));
    });

    // Global cursor spotlight tracking
    const spotlight = document.querySelector('.cursor-spotlight');
    if (spotlight) {
      window.addEventListener('mousemove', (e) => {
        spotlight.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
      });
    }
  }

  handleMouseMove(e, card) {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -this.maxTilt;
    const rotateY = ((x - centerX) / centerX) * this.maxTilt;

    card.style.transform = `perspective(${this.perspective}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(${this.scale}, ${this.scale}, ${this.scale})`;

    // Update custom properties for spotlight effects inside card
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  }

  handleMouseLeave(card) {
    card.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
    card.style.transform = `perspective(${this.perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;

    setTimeout(() => {
      card.style.transition = '';
    }, 500);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new TiltEffect();
});
