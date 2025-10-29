import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../core/auth.service';
import { TradeRequestsService, TradeRequest } from '../../features/trade/trade-requests.service';
import { TransactionsService, Transaction } from '../../features/txs/transactions.service';

interface NotificationItem {
  type: 'transaction' | 'trade_request';
  refId: number;
  createdAt: string;
  title: string;
  detail: string;
  statusLabel: string;
  statusClass: 'pending' | 'confirmed' | 'failed' | 'request';
}

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
  private authSub?: Subscription;
  private routerSub?: Subscription;
  private meSub?: Subscription;
  private notifTimer?: ReturnType<typeof setInterval>;
  onlyDashboard = false;
  isAuthPage = false;
  notifOpen = false;
  notifCount = 0;
  notifications: NotificationItem[] = [];
  loadingNotifs = false;
  private currentUserId?: number;

  constructor(
    private auth: AuthService,
    private router: Router,
    private tradeReq: TradeRequestsService,
    private txApi: TransactionsService
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.auth.isAuthenticated();
    if (this.isLoggedIn) {
      this.fetchCurrentUser();
    }
    this.authSub = this.auth.authStatus$.subscribe((v: boolean) => {
      this.isLoggedIn = v;
      if (v) {
        this.fetchCurrentUser(true);
      } else {
        this.resetNotifications();
      }
    });
    // cerrar menú y evaluar ruta
    this.routerSub = this.router.events.subscribe(ev => {
      if (ev instanceof NavigationEnd) {
        this.onlyDashboard = this.router.url.startsWith('/dashboard');
        this.isAuthPage = this.router.url.startsWith('/auth/');
        this.open = false;
        this.notifOpen = false;
        this.refreshNotifications();
      }
    });
    // estado inicial
    this.onlyDashboard = this.router.url.startsWith('/dashboard');
    this.isAuthPage = this.router.url.startsWith('/auth/');
  }

  toggle(): void {
    this.notifOpen = false;
    this.open = !this.open;
  }

  close(): void {
    this.open = false;
    this.notifOpen = false;
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/auth/login']);
    this.open = false;
    this.resetNotifications();
  }

  toggleNotifications(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.isLoggedIn) { return; }
    if (!this.currentUserId) {
      this.fetchCurrentUser(true);
    } else if (!this.notifOpen) {
      this.refreshNotifications(true);
    }
    this.notifOpen = !this.notifOpen;
  }

  @HostListener('document:click', ['$event'])
  handleDocumentClick(ev: Event): void {
    if (!this.notifOpen) { return; }
    const target = ev.target as HTMLElement;
    if (!target.closest('.notif-wrapper')) {
      this.notifOpen = false;
    }
  }

  openNotification(item: NotificationItem, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.notifOpen = false;
    this.open = false;
    const extras = item.type === 'transaction'
      ? { queryParams: { focus: item.refId } }
      : undefined;
    this.router.navigate(['/txs'], extras).catch(() => {});
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    this.routerSub?.unsubscribe();
    this.meSub?.unsubscribe();
    this.stopNotificationPoll();
  }

  private fetchCurrentUser(force = false): void {
    if (!this.isLoggedIn) { return; }
    if (this.currentUserId && !force) {
      this.refreshNotifications(true);
      this.startNotificationPoll();
      return;
    }
    this.meSub?.unsubscribe();
    this.meSub = this.auth.me().subscribe({
      next: (me) => {
        this.currentUserId = me.id;
        this.refreshNotifications(true);
        this.startNotificationPoll();
      },
      error: () => {
        this.resetNotifications();
      }
    });
  }

  private refreshNotifications(force = false): void {
    if (!this.isLoggedIn || !this.currentUserId) {
      this.notifCount = 0;
      this.notifications = [];
      return;
    }
    if (this.loadingNotifs && !force) {
      return;
    }
    this.loadingNotifs = true;
    forkJoin({
      requests: this.tradeReq.list('incoming', 'PENDING').pipe(catchError(() => of([] as TradeRequest[]))),
      txs: this.txApi.list().pipe(catchError(() => of([] as Transaction[])))
    }).subscribe({
      next: ({ requests, txs }) => {
        const incomingTxs = txs.filter(tx => tx.to_user === this.currentUserId);
        const txNotifications: NotificationItem[] = incomingTxs
          .slice(0, 6)
          .map(tx => {
            const status = tx.status === 'PENDING' ? 'pending' : tx.status === 'CONFIRMED' ? 'confirmed' : 'failed';
            const title = tx.status === 'PENDING'
              ? 'Transacción pendiente'
              : tx.status === 'CONFIRMED'
                ? 'Transacción recibida'
                : 'Transacción fallida';
            const fromUser = tx.from_username ? `@${tx.from_username}` : 'Sin remitente';
            return {
              type: 'transaction',
              refId: tx.id,
              createdAt: tx.created_at,
              title,
              detail: `${fromUser} → tú · ${this.formatAmount(tx.amount)} SIM`,
              statusLabel: status === 'pending' ? 'Pendiente' : status === 'confirmed' ? 'Confirmada' : 'Fallida',
              statusClass: status as NotificationItem['statusClass']
            };
          });
        const requestNotifications: NotificationItem[] = requests.map(req => {
          const action = req.side === 'SELL' ? 'quiere venderte' : 'quiere comprarte';
          return {
            type: 'trade_request',
            refId: req.id,
            createdAt: req.created_at,
            title: `Solicitud P2P: @${req.requester_username} ${action}`,
            detail: `${this.formatAmount(req.amount)} SIM · Fee ${this.formatAmount(req.fee)}`,
            statusLabel: 'Solicitud',
            statusClass: 'request'
          };
        });
        const merged = [...txNotifications, ...requestNotifications]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 8);
        this.notifications = merged;
        const pendingCount = requestNotifications.length + incomingTxs.filter(tx => tx.status === 'PENDING').length;
        this.notifCount = pendingCount;
      },
      error: () => {
        this.notifications = [];
        this.notifCount = 0;
        this.loadingNotifs = false;
      },
      complete: () => {
        this.loadingNotifs = false;
      }
    });
  }

  private resetNotifications(): void {
    this.notifications = [];
    this.notifCount = 0;
    this.currentUserId = undefined;
    this.notifOpen = false;
    this.loadingNotifs = false;
    this.stopNotificationPoll();
  }

  private startNotificationPoll(): void {
    if (this.notifTimer || !this.isLoggedIn || !this.currentUserId) {
      return;
    }
    this.notifTimer = setInterval(() => this.refreshNotifications(), 20000);
  }

  private stopNotificationPoll(): void {
    if (this.notifTimer) {
      clearInterval(this.notifTimer);
      this.notifTimer = undefined;
    }
  }

  private formatAmount(value: unknown): string {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num)) {
      return '0.00';
    }
    return (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2);
  }
}
