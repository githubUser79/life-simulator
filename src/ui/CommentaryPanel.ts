import type { Commentator } from '../ai/Commentator';

/**
 * Floating commentary panel — shows sarcastic AI observations.
 * HTML overlay positioned bottom-left above the stats panel.
 */
export class CommentaryPanel {
  private panel: HTMLDivElement;
  private logDiv: HTMLDivElement;
  private commentator: Commentator;
  private lastCount = 0;
  private updateInterval: number;

  constructor(commentator: Commentator) {
    this.commentator = commentator;

    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position: fixed; top: 10px; left: 450px; z-index: 90;
      width: 420px; max-height: 300px;
      background: rgba(10,14,20,0.92);
      border: 1px solid rgba(68,187,221,0.4);
      border-radius: 10px;
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 13px;
      color: #ccd;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 0 15px rgba(68,187,221,0.15);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 8px 12px;
      font-weight: 600;
      color: #44ddee;
      font-size: 13px;
      border-bottom: 1px solid rgba(68,187,221,0.2);
      flex-shrink: 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <span>AI Commentary</span>
      <label style="font-size:10px;color:#778;font-weight:normal;cursor:pointer">
        <input type="checkbox" id="commentary-toggle" checked> on
      </label>
    `;
    this.panel.appendChild(header);

    // Log area
    this.logDiv = document.createElement('div');
    this.logDiv.style.cssText = `
      padding: 8px 12px;
      overflow-y: auto;
      flex: 1;
      max-height: 200px;
    `;
    this.logDiv.innerHTML = '<div style="color:#556;font-style:italic">Waiting for first observation...</div>';
    this.panel.appendChild(this.logDiv);

    document.body.appendChild(this.panel);

    // Toggle
    header.querySelector('#commentary-toggle')!.addEventListener('change', (e) => {
      this.commentator.enabled = (e.target as HTMLInputElement).checked;
    });

    // Poll for new comments
    this.updateInterval = window.setInterval(() => this.refresh(), 3000);
  }

  private refresh(): void {
    const comments = this.commentator.comments;
    if (comments.length === this.lastCount) return;
    this.lastCount = comments.length;

    const visible = comments.slice(-8);
    this.logDiv.innerHTML = visible.map((c, i) => {
      const isLatest = i === visible.length - 1;
      const age = Math.floor((Date.now() - c.timestamp) / 1000);
      const ageStr = age < 60 ? `${age}s ago` : `${Math.floor(age / 60)}m ago`;
      return `<div style="
        margin: 4px 0;
        padding: 6px 8px;
        background: ${isLatest ? 'rgba(68,187,221,0.1)' : 'rgba(30,35,45,0.5)'};
        border-radius: 6px;
        border-left: 3px solid ${isLatest ? '#44ddbb' : '#334'};
        line-height: 1.4;
        ${isLatest ? 'animation: fadeIn 0.5s ease-in;' : ''}
      ">
        <div style="color:${isLatest ? '#dde' : '#99a'}">${escapeHtml(c.text)}</div>
        <div style="color:#556;font-size:9px;margin-top:2px">tick ${c.tick} &middot; ${ageStr}</div>
      </div>`;
    }).join('');

    // Auto-scroll to bottom
    this.logDiv.scrollTop = this.logDiv.scrollHeight;
  }

  destroy(): void {
    clearInterval(this.updateInterval);
    this.panel.remove();
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
