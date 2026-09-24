/**
 * Sidebar — Encapsulates sidebar DOM logic and state.
 */
export class Sidebar {
  constructor(sidebarId = 'sidebar', toggleId = 'sidebar-toggle') {
    this.sidebarEl = document.getElementById(sidebarId);
    this.toggleEl = document.getElementById(toggleId);

    if (this.toggleEl && this.sidebarEl) {
      this.toggleEl.addEventListener('click', () => this.toggle());
    }
  }

  open() {
    if (this.sidebarEl && this.sidebarEl.classList.contains('sidebar--collapsed')) {
      this.sidebarEl.classList.remove('sidebar--collapsed');
    }
  }

  close() {
    if (this.sidebarEl && !this.sidebarEl.classList.contains('sidebar--collapsed')) {
      this.sidebarEl.classList.add('sidebar--collapsed');
    }
  }

  toggle() {
    if (this.sidebarEl) {
      this.sidebarEl.classList.toggle('sidebar--collapsed');
    }
  }
}
