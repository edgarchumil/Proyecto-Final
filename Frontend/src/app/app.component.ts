import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { TopbarComponent } from './layout/topbar/topbar.component';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TopbarComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly tabId: string;

  private onStorage = (e: StorageEvent) => {
    if (e.storageArea !== localStorage) {
      return;
    }
    if (e.key === 'activeTabId') {
      if (e.newValue && e.newValue !== this.tabId && this.auth.isAuthenticated()) {
        this.auth.silentLogout();
        this.router.navigate(['/auth/login']);
      }
      return;
    }
    if ((e.key === 'access' || e.key === 'refresh') && !localStorage.getItem('access')) {
      this.auth.silentLogout();
      this.router.navigate(['/auth/login']);
    }
  };

  constructor(private auth: AuthService, private router: Router) {
    this.tabId = this.ensureTabId();
  }

  ngOnInit(): void {
    const activeOwner = localStorage.getItem('activeTabId');
    if (this.auth.isAuthenticated()) {
      if (!activeOwner) {
        localStorage.setItem('activeTabId', this.tabId);
      } else if (activeOwner !== this.tabId) {
        this.auth.forceFreshLogin();
        this.router.navigate(['/auth/login']);
      }
    }
    window.addEventListener('storage', this.onStorage);
  }

  ngOnDestroy(): void {
    window.removeEventListener('storage', this.onStorage);
  }

  private ensureTabId(): string {
    const existing = sessionStorage.getItem('tabId');
    if (existing) {
      return existing;
    }
    const newId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? (crypto.randomUUID as () => string)()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem('tabId', newId);
    return newId;
  }
}
