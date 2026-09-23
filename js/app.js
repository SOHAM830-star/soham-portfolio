/**
 * Core Application Controller
 * Handles sound synthesis, scroll tracking, skill filtering, project modals, code lab, and contact interactions
 */

/* --- 1. Web Audio API Sound Synthesizer --- */
class SoundEngine {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.lastHoverAt = 0;
    this.toggleBtn = document.getElementById('sound-toggle');
    this.unlockAudio = this.unlockAudio.bind(this);

    document.addEventListener('pointerdown', this.unlockAudio, { passive: true });
    document.addEventListener('keydown', this.unlockAudio);

    if (this.toggleBtn) {
      this.toggleBtn.classList.add('sound-on');
      this.toggleBtn.addEventListener('click', () => this.toggleSound());
    }
  }

  unlockAudio() {
    if (!this.enabled) return;
    this.ensureContext();
    document.removeEventListener('pointerdown', this.unlockAudio);
    document.removeEventListener('keydown', this.unlockAudio);
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSound() {
    this.ensureContext();
    this.enabled = !this.enabled;

    if (this.toggleBtn) {
      if (this.enabled) {
        this.toggleBtn.classList.add('sound-on');
        this.toggleBtn.querySelector('.sound-status').textContent = 'SFX ON';
        this.playSuccessChime();
      } else {
        this.toggleBtn.classList.remove('sound-on');
        this.toggleBtn.querySelector('.sound-status').textContent = 'SFX OFF';
      }
    }
  }

  playKeyClick() {
    if (!this.enabled) return;
    this.ensureContext();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800 + Math.random() * 400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playHoverBeep() {
    if (!this.enabled) return;
    const nowMs = performance.now();
    if (nowMs - this.lastHoverAt < 90) return;
    this.lastHoverAt = nowMs;
    this.ensureContext();
    const now = this.ctx.currentTime;
    const notes = [
      { frequency: 880, start: 0, duration: 0.08 },
      { frequency: 1320, start: 0.055, duration: 0.12 }
    ];

    notes.forEach(note => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const noteStart = now + note.start;
      const noteEnd = noteStart + note.duration;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.frequency, noteStart);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.035, noteStart + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(noteStart);
      osc.stop(noteEnd);
    });
  }

  playSuccessChime() {
    if (!this.enabled) return;
    this.ensureContext();
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 chord

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.04, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.4);
    });
  }
}

/* --- 2. Canvas Confetti Particle Burst --- */
class ConfettiEffect {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.isAnimating = false;

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  burst(x, y) {
    const colors = ['#00f0ff', '#9d4edd', '#ff007a', '#10b981', '#f59e0b', '#ffffff'];
    const count = 100;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 12 + 4;
      this.particles.push({
        x: x || this.canvas.width / 2,
        y: y || this.canvas.height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        gravity: 0.35,
        alpha: 1
      });
    }

    if (!this.isAnimating) {
      this.isAnimating = true;
      this.render();
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.98;
      p.rotation += p.rotationSpeed;
      p.alpha -= 0.012;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      this.ctx.restore();
    }

    if (this.particles.length > 0) {
      requestAnimationFrame(() => this.render());
    } else {
      this.isAnimating = false;
    }
  }
}

/* --- 3. Scroll Controller & Animations --- */
class ScrollController {
  constructor() {
    this.progressBar = document.getElementById('scroll-progress');
    this.navbar = document.getElementById('main-nav');
    this.navLinks = document.querySelectorAll('.nav-link');
    this.sections = document.querySelectorAll('section[id]');
    this.init();
  }

  init() {
    window.addEventListener('scroll', () => this.handleScroll(), { passive: true });
    this.setupScrollObserver();
    this.setupNavSpy();
  }

  handleScroll() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = docHeight > 0 ? scrollTop / docHeight : 0;

    // Fallback progress bar update if animation-timeline is not supported natively
    if (this.progressBar && !CSS.supports('animation-timeline: scroll()')) {
      this.progressBar.style.transform = `scaleX(${scrollPercent})`;
    }

    // Navbar style shift
    if (this.navbar) {
      if (scrollTop > 50) {
        this.navbar.classList.add('scrolled');
      } else {
        this.navbar.classList.remove('scrolled');
      }
    }
  }

  setupScrollObserver() {
    const revealElements = document.querySelectorAll('.reveal-init');
    const skillCards = document.querySelectorAll('.skill-card');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-visible');

          // Animate skill progress bars when entering view
          if (entry.target.classList.contains('skill-card')) {
            const bar = entry.target.querySelector('.skill-fill');
            if (bar) {
              const targetWidth = bar.getAttribute('data-level') || '85%';
              bar.style.width = targetWidth;
            }
          }
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

    revealElements.forEach(el => observer.observe(el));
    skillCards.forEach(card => observer.observe(card));
  }

  setupNavSpy() {
    const updateActiveNav = () => {
      const scrollPos = window.scrollY + 200;
      let currentSectionId = '';

      this.sections.forEach(sec => {
        const top = sec.offsetTop;
        const height = sec.offsetHeight;
        if (scrollPos >= top && scrollPos < top + height) {
          currentSectionId = sec.getAttribute('id');
        }
      });

      if (currentSectionId) {
        this.navLinks.forEach(link => {
          if (link.getAttribute('href') === `#${currentSectionId}`) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }
    };

    window.addEventListener('scroll', updateActiveNav, { passive: true });
    updateActiveNav();
  }
}

/* --- 4. Skills Matrix Filter --- */
class SkillsFilter {
  constructor() {
    this.filterBtns = document.querySelectorAll('.filter-btn');
    this.cards = document.querySelectorAll('.skill-card');
    this.init();
  }

  init() {
    this.filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.soundEngine) window.soundEngine.playKeyClick();
        this.filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const category = btn.getAttribute('data-filter');
        this.filter(category);
      });
    });
  }

  filter(category) {
    this.cards.forEach(card => {
      const cardCat = card.getAttribute('data-category');
      if (category === 'all' || cardCat === category) {
        card.style.display = 'block';
        setTimeout(() => {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        }, 10);
      } else {
        card.style.opacity = '0';
        card.style.transform = 'translateY(15px)';
        setTimeout(() => {
          card.style.display = 'none';
        }, 300);
      }
    });
  }
}

/* --- 5. Interactive Code Lab --- */
class CodeLab {
  constructor() {
    this.tabs = document.querySelectorAll('.code-tab');
    this.blocks = document.querySelectorAll('.code-block');
    this.copyBtn = document.getElementById('copy-code-btn');
    this.runBtn = document.getElementById('run-code-btn');
    this.init();
  }

  init() {
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        if (window.soundEngine) window.soundEngine.playKeyClick();
        const targetId = tab.getAttribute('data-target');

        this.tabs.forEach(t => t.classList.remove('active'));
        this.blocks.forEach(b => b.classList.remove('active'));

        tab.classList.add('active');
        const targetBlock = document.getElementById(targetId);
        if (targetBlock) targetBlock.classList.add('active');
      });
    });

    if (this.copyBtn) {
      this.copyBtn.addEventListener('click', () => {
        const activeBlock = document.querySelector('.code-block.active pre code');
        if (activeBlock) {
          navigator.clipboard.writeText(activeBlock.innerText).then(() => {
            const originalText = this.copyBtn.innerHTML;
            this.copyBtn.innerHTML = '<span>✔ Copied!</span>';
            if (window.soundEngine) window.soundEngine.playSuccessChime();
            setTimeout(() => {
              this.copyBtn.innerHTML = originalText;
            }, 2000);
          });
        }
      });
    }

    if (this.runBtn) {
      this.runBtn.addEventListener('click', () => {
        if (window.soundEngine) window.soundEngine.playSuccessChime();
        const activeBlock = document.querySelector('.code-block.active');
        const runOutput = activeBlock.querySelector('.run-output');
        if (runOutput) {
          runOutput.style.display = 'block';
          runOutput.innerHTML = '<span style="color: #00f0ff;">[Runtime Engine]</span> Compiling AST & executing sandbox... <br><span style="color: #10b981;">✔ Benchmark: 0.18ms latency | 0 memory allocations | Status: OK</span>';
        }
      });
    }
  }
}

/* --- 6. Project Detail Modal Manager --- */
const projectData = {
  1: {
    title: "Smart Campus Management System",
    tag: "Education Technology Project",
    image: "assets/project-1.jpg",
    desc: "A smart campus platform designed to manage classroom occupancy, allocation, attendance, analytics, and notifications for students and teachers.",
    metrics: [
      { label: "User Modules", val: "Teacher + Student" },
      { label: "Focus", val: "Attendance + Analytics" },
      { label: "Integration", val: "Flask + Python" },
      { label: "Status", val: "Learning Project" }
    ],
    stack: ["HTML", "CSS", "JavaScript", "Python", "Flask", "REST APIs"],
    achievements: [
      "Built teacher and student interfaces for campus workflows.",
      "Worked on attendance management, analytics, and notifications.",
      "Contributed frontend development and Flask-based integration."
    ]
  },
  2: {
    title: "AI-Assisted Development",
    tag: "Development Workflow",
    image: "assets/project-2.jpg",
    desc: "An ongoing development practice using GitHub Copilot and AI-assisted workflows to understand code, troubleshoot errors, develop features, and accelerate learning and prototyping.",
    metrics: [
      { label: "Workflow", val: "AI-assisted" },
      { label: "Focus", val: "Learning + Debugging" },
      { label: "Tools", val: "Copilot + VS Code" },
      { label: "Status", val: "Ongoing Practice" }
    ],
    stack: ["GitHub Copilot", "VS Code", "JavaScript", "Python", "Problem Solving"],
    achievements: [
      "Use AI tools to understand unfamiliar code and troubleshoot errors.",
      "Develop features and prototype ideas through assisted workflows.",
      "Learn through experimentation, testing, and iteration."
    ]
  },
  3: {
    title: "Full-Stack Development Journey",
    tag: "Currently Learning",
    image: "assets/project-3.jpg",
    desc: "A learning path from frontend foundations toward complete applications that connect React interfaces with Python, Flask, REST APIs, and SQL-backed data.",
    metrics: [
      { label: "Focus Areas", val: "Frontend + Backend" },
      { label: "Core Tools", val: "React + Flask" },
      { label: "Data", val: "SQL" },
      { label: "Status", val: "In Progress" }
    ],
    stack: ["React", "Python", "Flask", "REST APIs", "SQL"],
    achievements: [
      "Continue building frontend foundations with HTML, CSS, JavaScript, and React.",
      "Practice backend integration with Python, Flask, and REST APIs.",
      "Strengthen database, algorithms, and full-stack development skills."
    ]
  }
};

class ModalManager {
  constructor() {
    this.backdrop = document.getElementById('project-modal');
    this.modalContent = document.getElementById('modal-dynamic-content');
    this.closeBtn = document.getElementById('modal-close');
    this.init();
  }

  init() {
    document.querySelectorAll('.open-modal-trigger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const projId = btn.getAttribute('data-project');
        this.open(projId);
      });
    });

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    if (this.backdrop) {
      this.backdrop.addEventListener('click', (e) => {
        if (e.target === this.backdrop) this.close();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.backdrop.classList.contains('open')) {
        this.close();
      }
    });
  }

  open(id) {
    const data = projectData[id];
    if (!data) return;

    if (window.soundEngine) window.soundEngine.playKeyClick();

    let metricsHtml = data.metrics.map(m => `
      <div style="background: rgba(255,255,255,0.04); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
        <div style="color: #00f0ff; font-family: var(--font-mono); font-weight: 700; font-size: 1.1rem;">${m.val}</div>
        <div style="color: #64748b; font-size: 0.75rem; text-transform: uppercase;">${m.label}</div>
      </div>
    `).join('');

    let stackHtml = data.stack.map(s => `<span class="stack-tag">${s}</span>`).join('');
    let bulletsHtml = data.achievements.map(a => `<li style="margin-bottom: 8px;">▹ ${a}</li>`).join('');

    this.modalContent.innerHTML = `
      <div class="modal-img-wrap">
        <img src="${data.image}" alt="${data.title}">
      </div>
      <div style="color: #00f0ff; font-family: var(--font-mono); font-size: 0.85rem; margin-bottom: 6px;">${data.tag}</div>
      <h2 style="font-family: var(--font-display); font-size: 1.8rem; margin-bottom: 16px;">${data.title}</h2>
      <p style="color: #94a3b8; line-height: 1.7; margin-bottom: 24px;">${data.desc}</p>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px;">
        ${metricsHtml}
      </div>

      <h3 style="font-family: var(--font-display); font-size: 1.15rem; margin-bottom: 12px;">Architecture Highlights</h3>
      <ul style="list-style: none; color: #cbd5e1; line-height: 1.6; margin-bottom: 24px; padding-left: 0;">
        ${bulletsHtml}
      </ul>

      <h3 style="font-family: var(--font-display); font-size: 1.15rem; margin-bottom: 12px;">Technologies Employed</h3>
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px;">
        ${stackHtml}
      </div>

      <div style="display: flex; gap: 14px;">
        <a href="#contact" class="btn btn-primary" onclick="window.modalManager.close()">
          <span>Request Technical Deep Dive</span>
        </a>
      </div>
    `;

    this.backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.backdrop.classList.remove('open');
    document.body.style.overflow = '';
  }
}

/* --- 7. Live Timezone Clock & Contact Manager --- */
class ContactManager {
  constructor() {
    this.clockEl = document.getElementById('utc-clock');
    this.form = document.getElementById('portfolio-contact-form');
    this.successBanner = document.getElementById('form-success-banner');
    this.init();
  }

  init() {
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);

    // Request notification permission if supported
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    if (this.form) {
      this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }
  }

  updateClock() {
    if (!this.clockEl) return;
    const now = new Date();
    const options = {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    };
    const timeStr = now.toLocaleTimeString('en-US', options);
    this.clockEl.textContent = `${timeStr} PST (SF / UTC-8)`;
  }

  async handleSubmit(e) {
    e.preventDefault();
    const btn = this.form.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = `<span>Compiling dossier & transmitting...</span>`;

    const payload = {
      name: document.getElementById('form-name')?.value || '',
      email: document.getElementById('form-email')?.value || '',
      phone: document.getElementById('form-phone')?.value || '',
      role: document.getElementById('form-role')?.value || '',
      portfolio: document.getElementById('form-portfolio')?.value || '',
      budget: document.getElementById('form-budget')?.value || '',
      message: document.getElementById('form-message')?.value || '',
    };

    try {
      const response = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      btn.disabled = false;
      btn.innerHTML = originalText;

      if (result.success) {
        this.form.reset();

        if (this.successBanner) {
          this.successBanner.style.display = 'block';
          this.successBanner.innerHTML = `🎉 <strong>Success!</strong> Application received. Formatted Word dossier <em>${result.docFile}</em> and Excel ledger entry were generated successfully.`;
          this.successBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        // Celebrate with audio chime and confetti burst!
        if (window.soundEngine) window.soundEngine.playSuccessChime();
        if (window.confettiEffect) {
          const rect = btn.getBoundingClientRect();
          window.confettiEffect.burst(rect.left + rect.width / 2, rect.top);
        }

        // Desktop Notification
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("💼 New Collaboration Application!", {
            body: `${payload.name} (${payload.role}) submitted details. Dossier ready in Vault.`,
            icon: 'assets/avatar.jpg'
          });
        }

        // Refresh Vault Counter & List
        if (window.vaultManager) {
          window.vaultManager.fetchInquiries();
        }
      } else {
        alert(result.error || 'Failed to submit application.');
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = originalText;
      alert('Network error connecting to backend API.');
    }
  }
}

/* --- 8. Admin Inquiries & Dossiers Vault Manager --- */
class VaultManager {
  constructor() {
    this.modal = document.getElementById('vault-modal');
    this.openBtn = document.getElementById('open-vault-btn');
    this.closeBtn = document.getElementById('vault-close');
    this.counterBadge = document.getElementById('vault-counter');
    this.table = document.getElementById('vault-table');
    this.tbody = document.getElementById('vault-table-body');
    this.emptyState = document.getElementById('vault-empty-state');

    this.init();
  }

  init() {
    if (this.openBtn) {
      this.openBtn.addEventListener('click', () => this.open());
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.close();
      });
    }

    this.fetchInquiries();
  }

  open() {
    if (window.soundEngine) window.soundEngine.playKeyClick();
    if (this.modal) {
      this.modal.classList.add('open');
      document.body.style.overflow = 'hidden';
      this.fetchInquiries();
    }
  }

  close() {
    if (this.modal) {
      this.modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  async fetchInquiries() {
    try {
      const res = await fetch('/api/inquiries');
      if (!res.ok) return;
      const list = await res.json();

      if (this.counterBadge) {
        this.counterBadge.textContent = list.length;
        if (list.length > 0) {
          this.counterBadge.classList.add('has-items');
        } else {
          this.counterBadge.classList.remove('has-items');
        }
      }

      this.renderTable(list);
    } catch (e) {
      // Backend not yet reachable or offline
    }
  }

  renderTable(list) {
    if (!this.tbody || !this.table || !this.emptyState) return;

    if (!list || list.length === 0) {
      this.emptyState.style.display = 'block';
      this.table.style.display = 'none';
      return;
    }

    this.emptyState.style.display = 'none';
    this.table.style.display = 'table';
    this.tbody.innerHTML = '';

    list.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-family: var(--font-mono); font-size: 0.76rem; color: #94a3b8; white-space: nowrap;">${item.timestamp || 'Recent'}</td>
        <td style="font-weight: 700; color: #fff;">${this.escapeHtml(item.name)}</td>
        <td><span class="vault-role-pill">${this.escapeHtml(item.role || 'Role')}</span></td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 3px; font-size: 0.8rem;">
            <a href="mailto:${item.email}" style="color: var(--accent-cyan); text-decoration: none;">✉ ${this.escapeHtml(item.email)}</a>
            ${item.phone ? `<a href="tel:${item.phone}" style="color: #cbd5e1; text-decoration: none;">📞 ${this.escapeHtml(item.phone)}</a>` : '<span style="color: #64748b;">No phone</span>'}
          </div>
        </td>
        <td>
          ${item.portfolio ? `<a href="${item.portfolio}" target="_blank" rel="noopener" class="vault-link-pill">🔗 Link</a>` : '<span style="color:#64748b;">—</span>'}
        </td>
        <td style="font-size: 0.8rem; color: #94a3b8;">${this.escapeHtml(item.budget || 'Negotiable')}</td>
        <td>
          <a href="/api/export/doc/${item.id}" class="dossier-download-btn" download title="Download Candidate Word Dossier">
            <span>📄 Word .doc</span>
          </a>
        </td>
      `;
      this.tbody.appendChild(tr);
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
}

/* --- Global Audio Hover Effects --- */
function setupGlobalHoverAudio() {
  const interactiveElements = document.querySelectorAll('a, button, .skill-card, .term-chip, .code-tab');
  interactiveElements.forEach(el => {
    el.addEventListener('mouseenter', () => {
      if (window.soundEngine) window.soundEngine.playHoverBeep();
    });
  });
}

// Initialize components when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.soundEngine = new SoundEngine();
  window.confettiEffect = new ConfettiEffect('confetti-canvas');
  window.scrollController = new ScrollController();
  window.skillsFilter = new SkillsFilter();
  window.codeLab = new CodeLab();
  window.modalManager = new ModalManager();
  window.contactManager = new ContactManager();
  window.vaultManager = new VaultManager();
  setupGlobalHoverAudio();

  // Back to top button
  const backToTop = document.getElementById('back-to-top');
  if (backToTop) {
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
});

