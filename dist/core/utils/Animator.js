import { Logger } from './Logger.js';
export class Animator {
    static instance;
    logger;
    constructor() {
        this.logger = new Logger('Animator');
    }
    static getInstance() {
        if (!Animator.instance) {
            Animator.instance = new Animator();
        }
        return Animator.instance;
    }
    // Spinner implementation
    createSpinner() {
        return new Spinner();
    }
    // ProgressBar implementation
    createProgressBar() {
        return new ProgressBar();
    }
    // RealTimeDisplay implementation
    createRealTimeDisplay() {
        return new RealTimeDisplay();
    }
}
class Spinner {
    frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    currentFrame = 0;
    intervalId = null;
    isSpinning = false;
    text = '';
    start(text = '') {
        if (this.isSpinning)
            return;
        this.text = text;
        this.isSpinning = true;
        this.intervalId = setInterval(() => {
            process.stdout.write(`\r${this.frames[this.currentFrame]} ${this.text}`);
            this.currentFrame = (this.currentFrame + 1) % this.frames.length;
        }, 80);
    }
    stop() {
        if (!this.isSpinning)
            return;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        process.stdout.write('\r\x1b[K'); // Clear the line
        this.isSpinning = false;
        this.currentFrame = 0;
    }
    succeed(text = '') {
        this.stop();
        const message = text || this.text;
        process.stdout.write(`\r✓ ${message}\n`);
    }
    fail(text = '') {
        this.stop();
        const message = text || this.text;
        process.stdout.write(`\r✗ ${message}\n`);
    }
}
class ProgressBar {
    render(current, total, label = '') {
        const percentage = Math.round((current / total) * 100);
        const filledLength = Math.round((current / total) * 20);
        const emptyLength = 20 - filledLength;
        const bar = '[' + '='.repeat(filledLength) + (filledLength < 20 ? '>' : '') + ' '.repeat(emptyLength) + ']';
        const labelText = label ? ` ${label}` : '';
        process.stdout.write(`\r${bar} ${percentage}%${labelText}`);
        if (current >= total) {
            process.stdout.write('\n');
        }
    }
}
class RealTimeDisplay {
    sections = [];
    isRunning = false;
    start(sections) {
        this.sections = [...sections];
        this.isRunning = true;
        this.render();
    }
    update(sectionIndex, content) {
        if (sectionIndex >= 0 && sectionIndex < this.sections.length) {
            this.sections[sectionIndex] = content;
            if (this.isRunning) {
                this.render();
            }
        }
    }
    render() {
        // Move cursor to top-left and clear screen
        process.stdout.write('\x1b[H\x1b[J');
        // Render each section
        for (let i = 0; i < this.sections.length; i++) {
            process.stdout.write(this.sections[i] + '\n');
        }
    }
    stop() {
        this.isRunning = false;
        // Clear display
        process.stdout.write('\x1b[H\x1b[J');
    }
}
//# sourceMappingURL=Animator.js.map