import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { TradeRequestsService } from '../../features/trade/trade-requests.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.css']
})
export class TopbarComponent implements OnInit, OnDestroy {
  isLoggedIn = false;
  open = false;
  sub?: Subscription;
  onlyDashboard = false;
  isAuthPage = false;
  notifCount = 0;

  constructor(private auth: AuthService, private router: Router, private tradeReq: TradeRequestsService) {}

  ngOnInit(): void {
    this.isLoggedIn = this.auth.isAuthenticated();
    this.sub = this.auth.authStatus$.subscribe((v: boolean) => { this.isLoggedIn = v; if (v) this.loadNotifications(); else this.notifCount = 0; });
    // cerrar menú y evaluar ruta
    this.router.events.subscribe(ev => {
      if (ev instanceof NavigationEnd) {
        this.onlyDashboard = this.router.url.startsWith('/dashboard');
        this.isAuthPage = this.router.url.startsWith('/auth/');
        this.open = false;
        this.loadNotifications();
      }
    });
    // estado inicial
    this.onlyDashboard = this.router.url.startsWith('/dashboard');
    this.isAuthPage = this.router.url.startsWith('/auth/');
  }

  private loadNotifications(): void {
    try {
      this.tradeReq.list('incoming','PENDING').subscribe({ next: (items) => this.notifCount = items.length, error: () => this.notifCount = 0 });
    } catch { this.notifCount = 0; }
  }

  toggle() { this.open = !this.open; }
  close() { this.open = false; }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/auth/login']);
    this.open = false;
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }
}
