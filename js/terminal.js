/**
 * Interactive Developer CLI Terminal Emulator
 * Provides a responsive command-line interface with interactive commands, auto-typing, and quick chips
 */
class DeveloperTerminal {
  constructor() {
    this.outputContainer = document.getElementById('terminal-output');
    this.input = document.getElementById('terminal-input');
    this.chips = document.querySelectorAll('.term-chip');
    this.history = [];
    this.historyIndex = -1;

    this.commands = {
      help: () => `
<span class="term-highlight">Available Commands:</span>
  <span class="term-success">skills</span>    - View engineering proficiency & tech stack
  <span class="term-success">projects</span>  - Inspect flagship engineering builds
  <span class="term-success">stats</span>     - Live system & career metrics
  <span class="term-success">hire</span>      - Current availability & engagement options
  <span class="term-success">bio</span>       - Background & architecture philosophy
  <span class="term-success">socials</span>   - Professional networking handles
  <span class="term-success">clear</span>     - Clear terminal buffer
`,
      skills: () => `
  <span class="term-highlight">Soham's Technical Stack:</span>
  • <span class="term-purple">Programming:</span> C, C++, JavaScript, Python, SQL
  • <span class="term-purple">Frontend:</span> HTML5, CSS3, JavaScript, React
  • <span class="term-purple">Backend:</span> Python, Flask, REST APIs
  • <span class="term-purple">Tools:</span> Git, GitHub, VS Code, GitHub Copilot, Canva, Figma
  • <span class="term-purple">Exploring:</span> AI, Advanced Python, Full-Stack Development
`,
      projects: () => `
  <span class="term-highlight">Current Work & Focus:</span>
  1. <span class="term-highlight">Smart Campus Management System</span> - Classroom, attendance, analytics, and notifications
  2. <span class="term-highlight">AI-Assisted Development</span>         - Learning, debugging, prototyping, and feature development
  3. <span class="term-highlight">Full-Stack Development</span>          - React, Python, Flask, REST APIs, and SQL
  <span class="term-dim">Tip: Explore the Projects and Skills sections for more details.</span>
`,
      stats: () => `
  <span class="term-highlight">Profile Snapshot:</span>
  • Identity: Soham A. Chavan
  • Role: Computer Engineering Student | Full-Stack Developer
  • Location: Pune, India
  • Focus: Full-Stack Development, AI, Automation, Creative Technology
  • Status: Learning + Building
`,
      hire: () => `
<span class="term-success">● STATUS: LEARNING + BUILDING</span>
  • Open to: Project collaboration, learning opportunities, feedback, and developer conversations
  • Interests: Web Development, AI, Automation, Creative Technology
  • Location: Pune, India
  • Want to connect? Scroll to the Contact section or type <span class="term-highlight">'socials'</span>!
`,
      bio: () => `
<span class="term-highlight">About Soham A. Chavan:</span>
  Computer Engineering student and developer focused on building practical, modern digital experiences.
  Currently growing across full-stack development, AI-assisted workflows, modern web technologies,
  and interactive digital experiences through projects and real-world problem solving.
`,
      socials: () => `
<span class="term-highlight">Connect with Soham:</span>
  • GitHub:   github.com/SOHAM830-star
  • LinkedIn: linkedin.com/in/soham-chavan-83034b37a
  • Location: Pune, India
  • Email:    sohamchavan207260@gmail.com
`,
      clear: () => {
        if (this.outputContainer) this.outputContainer.innerHTML = '';
        return null;
      }
    };

    this.init();
  }

  init() {
    if (!this.input || !this.outputContainer) return;

    this.bindEvents();
    this.typeWelcomeSequence();
  }

  typeWelcomeSequence() {
    const lines = [
      "Initializing Soham A. Chavan [Full-Stack Developer]...",
      "Core modules loaded: [Web, Python, Flask, AI-assisted workflows].",
      "System online. Type 'help' or click command chips below:"
    ];

    let delay = 300;
    lines.forEach((line, idx) => {
      setTimeout(() => {
        const div = document.createElement('div');
        div.className = 'term-line';
        if (idx === lines.length - 1) {
          div.innerHTML = `<span class="term-success">✔</span> ${line}`;
        } else {
          div.innerHTML = `<span class="term-prompt">›</span> ${line}`;
        }
        this.outputContainer.appendChild(div);
        this.scrollToBottom();
      }, delay);
      delay += 400;
    });
  }

  bindEvents() {
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const cmd = this.input.value.trim().toLowerCase();
        if (cmd) {
          this.executeCommand(cmd);
          this.history.push(cmd);
          this.historyIndex = this.history.length;
          this.input.value = '';
        }
      } else if (e.key === 'ArrowUp') {
        if (this.historyIndex > 0) {
          this.historyIndex--;
          this.input.value = this.history[this.historyIndex];
        }
      } else if (e.key === 'ArrowDown') {
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
          this.input.value = this.history[this.historyIndex];
        } else {
          this.historyIndex = this.history.length;
          this.input.value = '';
        }
      }
    });

    // Handle Quick Action Chips
    this.chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const cmd = chip.getAttribute('data-cmd');
        if (cmd) {
          // Play click sound if audio engine is loaded
          if (window.soundEngine) window.soundEngine.playKeyClick();
          this.executeCommand(cmd);
        }
      });
    });
  }

  executeCommand(cmd) {
    // Play terminal clack
    if (window.soundEngine) window.soundEngine.playKeyClick();

    // Print command entered
    const cmdLine = document.createElement('div');
    cmdLine.className = 'term-line';
    cmdLine.innerHTML = `<span class="term-prompt">soham@dev-lab:~$</span> <span class="term-command">${cmd}</span>`;
    this.outputContainer.appendChild(cmdLine);

    // Process output
    if (this.commands[cmd]) {
      const output = this.commands[cmd]();
      if (output !== null) {
        const outDiv = document.createElement('div');
        outDiv.className = 'term-output';
        outDiv.innerHTML = output.trim().replace(/\n/g, '<br>');
        this.outputContainer.appendChild(outDiv);
      }
    } else {
      const errDiv = document.createElement('div');
      errDiv.className = 'term-output';
      errDiv.innerHTML = `<span style="color: #ff5f56;">Command not recognized: '${cmd}'. Type <span class="term-highlight">'help'</span> for available commands.</span>`;
      this.outputContainer.appendChild(errDiv);
    }

    this.scrollToBottom();
  }

  scrollToBottom() {
    const body = document.querySelector('.terminal-body');
    if (body) {
      body.scrollTop = body.scrollHeight;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.devTerminal = new DeveloperTerminal();
});
