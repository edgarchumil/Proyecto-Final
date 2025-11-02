import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TopbarComponent } from './layout/topbar/topbar.component';
import { AuthService } from './core/auth.service';
import { PreloaderService } from './core/preloader.service';
import { Subscription } from 'rxjs';
import { filter, take } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, TopbarComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly tabId: string;
  private navSub?: Subscription;

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

  constructor(
    private auth: AuthService,
    private router: Router,
    private preloader: PreloaderService
  ) {
    this.tabId = this.ensureTabId();
  }

  get preloaderVisible$() {
    return this.preloader.visible$;
  }

  ngOnInit(): void {
    this.preloader.show();
    this.navSub = this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        take(1)
      )
      .subscribe(() => {
        setTimeout(() => this.preloader.hide(), 350);
      });

    const activeOwner = localStorage.getItem('activeTabId');
    const isAuthRoute = this.router.url.startsWith('/auth/');

    if (!this.auth.isAuthenticated()) {
      if (isAuthRoute) {
        this.router.navigateByUrl('/landing', { replaceUrl: true });
        return;
      }
    } else {
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
    this.navSub?.unsubscribe();
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
