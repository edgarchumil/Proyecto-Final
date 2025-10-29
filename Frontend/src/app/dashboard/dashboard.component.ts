// src/app/dashboard/dashboard.component.ts
import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  Chart,
  LineController, LineElement, PointElement,
  LinearScale, Title, CategoryScale, Filler, Legend,
} from 'chart.js';

import { AuthService } from '../core/auth.service';
import { WalletService } from '../features/wallets/wallet.service';
import type { Wallet } from '../features/wallets/wallet.service';
import { TransactionsService } from '../features/txs/transactions.service';
import type { Transaction } from '../features/txs/transactions.service';
import { BlocksService } from '../features/blocks/blocks.service';
import { PriceService } from '../features/price/price.service';
import type { PriceTick } from '../features/price/price.service';
import { AuditService } from '../features/audit/audit.service';
import { TradeRequestsService } from '../features/trade/trade-requests.service';
import type { TradeRequest } from '../features/trade/trade-requests.service';
import { PreloaderService } from '../core/preloader.service';

Chart.register(LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, Filler, Legend);

interface WalletSummary {
  wallet: Wallet;
  balance: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private chart?: Chart;
  private metricsSub?: Subscription;
  private priceTimer?: ReturnType<typeof setInterval>;
  private txRotationTimer?: ReturnType<typeof setInterval>;
  private txRotationIndex = 0;
  private readonly txViewportSize = 3;
  walletViewportSize = 3;
  private walletRotationTimer?: ReturnType<typeof setInterval>;
  private walletRotationIndex = 0;
  private meSub?: Subscription;

  walletsCount: number | undefined;
  txCount: number | undefined;
  blockCount: number | undefined;
  auditCount: number | undefined;
  lastPrice: number | null = null;
  priceChangePct: number | null = null;
  holdingsUsd: number | null = null;
  confirmedCount = 0;
  pendingCount = 0;

  walletSummaries: WalletSummary[] = [];
  visibleWallets: WalletSummary[] = [];
  totalBalance = 0;
  recentTransactions: Transaction[] = [];
  visibleTransactions: Transaction[] = [];
  priceSeries: PriceTick[] = [];
  notifications: TradeRequest[] = [];
  currentUsername: string | null = null;

  loadingMetrics = false;
  welcomeBanner = false;

  constructor(
    private route: ActivatedRoute,
    private walletsApi: WalletService,
    private txsApi: TransactionsService,
    private blocksApi: BlocksService,
    private priceApi: PriceService,
    private auditApi: AuditService,
    public tradeReqApi: TradeRequestsService,
    private auth: AuthService,
    private preloader: PreloaderService
  ) {}

  ngOnInit(): void {
    this.loadCurrentUser();
    // Banner de bienvenida: query param o localStorage flag
    this.route.queryParamMap.subscribe(p => {
      const w = p.get('welcome');
      const local = (typeof localStorage !== 'undefined') ? localStorage.getItem('welcomeCredit') : null;
      this.welcomeBanner = w === '1' || !!local;
      if (this.welcomeBanner && typeof localStorage !== 'undefined') {
        localStorage.removeItem('welcomeCredit');
      }
    });
    this.loadMetrics();
    // Auto-refresh de último precio cada 12s
    this.priceTimer = setInterval(() => {
      this.priceApi.latest().subscribe({
        next: (t) => {
          this.lastPrice = this.round2(Number(t.price_usd));
          this.holdingsUsd = this.lastPrice != null ? this.round2(this.totalBalance * this.lastPrice) : null;
        },
        error: () => {}
      });
    }, 12000);
  }

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.metricsSub?.unsubscribe();
    if (this.priceTimer) clearInterval(this.priceTimer);
    if (this.txRotationTimer) clearInterval(this.txRotationTimer);
    if (this.walletRotationTimer) clearInterval(this.walletRotationTimer);
    this.meSub?.unsubscribe();
  }

  loadMetrics(showLoader = false): void {
    if (showLoader) {
      this.preloader.show(5000);
    }
    this.loadingMetrics = true;
    this.metricsSub?.unsubscribe();
    this.metricsSub = forkJoin({
      wallets: this.walletsApi.list().pipe(catchError(() => of([] as Wallet[]))),
      txs: this.txsApi.list().pipe(catchError(() => of([] as Transaction[]))),
      blocks: this.blocksApi.list().pipe(catchError(() => of([]))),
      prices: this.priceApi.list().pipe(catchError(() => of([] as PriceTick[]))),
      audit: this.auditApi.list().pipe(catchError(() => of([]))),
      notices: this.tradeReqApi.list('incoming', 'PENDING').pipe(catchError(() => of([] as TradeRequest[])))
    }).subscribe({
      next: ({ wallets, txs, blocks, prices, audit, notices }) => {
        this.walletsCount = wallets.length;
        this.txsCountFromData(txs);
        this.blockCount = blocks.length;
        this.auditCount = audit.length;
        this.notifications = notices;

        this.walletSummaries = this.buildWalletSummaries(wallets, txs);
        this.totalBalance = this.round2(this.walletSummaries.reduce((acc, item) => acc + item.balance, 0));
        this.setupWalletViewport();

        this.recentTransactions = [...txs]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        this.setupTransactionViewport();

        this.priceSeries = [...prices]
          .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
          .slice(-20);
        // Mostrar último precio y cambio respecto al primero del rango cargado
        const latest = prices[prices.length - 1];
        const first = prices[0];
        const latestPrice = latest ? this.round2(Number(latest.price_usd)) : null;
        const firstPrice = first ? this.round2(Number(first.price_usd)) : null;
        this.lastPrice = latestPrice;
        this.priceChangePct = (latestPrice !== null && firstPrice && firstPrice !== 0)
          ? this.round2(((latestPrice - firstPrice) / firstPrice) * 100)
          : null;
        this.holdingsUsd = this.lastPrice != null ? this.round2(this.totalBalance * this.lastPrice) : null;

        this.loadingMetrics = false;
        this.renderChart();
      },
      error: () => {
        this.loadingMetrics = false;
      }
    });
  }

  private buildWalletSummaries(wallets: Wallet[], txs: Transaction[]): WalletSummary[] {
    const balances = new Map<number, number>();
    wallets.forEach(w => balances.set(w.id, 0));

    this.confirmedCount = 0;
    this.pendingCount = 0;

    txs.forEach(tx => {
      if (tx.status === 'CONFIRMED') {
        this.confirmedCount += 1;
        const amountCents = this.toCents(tx.amount);
        const feeCents = this.toCents(tx.fee);
        const fromBalance = balances.get(tx.from_wallet) ?? 0;
        balances.set(tx.from_wallet, fromBalance - (amountCents + feeCents));
        const toBalance = balances.get(tx.to_wallet) ?? 0;
        balances.set(tx.to_wallet, toBalance + amountCents);
      } else if (tx.status === 'PENDING') {
        this.pendingCount += 1;
      }
    });

    return wallets.map(wallet => ({
      wallet,
      balance: this.round2((balances.get(wallet.id) ?? 0) / 100)
    }));
  }

  private txsCountFromData(txs: Transaction[]): void {
    this.txCount = txs.length;
  }

  private setupWalletViewport(): void {
    if (!this.walletSummaries.length) {
      this.visibleWallets = [];
      return;
    }
    const windowSize = Math.min(this.walletViewportSize, this.walletSummaries.length);
    this.walletRotationIndex = 0;
    this.applyWalletWindow(this.walletRotationIndex, windowSize);

    if (this.walletSummaries.length <= windowSize) {
      if (this.walletRotationTimer) {
        clearInterval(this.walletRotationTimer);
        this.walletRotationTimer = undefined;
      }
      return;
    }

    if (this.walletRotationTimer) {
      clearInterval(this.walletRotationTimer);
    }
    this.walletRotationTimer = setInterval(() => {
      this.walletRotationIndex = (this.walletRotationIndex + 1) % this.walletSummaries.length;
      this.applyWalletWindow(this.walletRotationIndex, windowSize);
    }, 5000);
  }

  private applyWalletWindow(startIndex: number, windowSize: number): void {
    const slice: WalletSummary[] = [];
    for (let offset = 0; offset < windowSize; offset += 1) {
      const idx = (startIndex + offset) % this.walletSummaries.length;
      slice.push(this.walletSummaries[idx]);
    }
    this.visibleWallets = slice;
  }

  private renderChart(): void {
    const canvas = document.getElementById('activityChart') as HTMLCanvasElement | null;
    if (!canvas) { return; }
    const ctx = canvas.getContext('2d');
    if (!ctx) { return; }

    if (!this.priceSeries.length) {
      this.chart?.destroy();
      return;
    }

    const labels = this.priceSeries.map(t => new Date(t.ts).toLocaleString());
    const data = this.priceSeries.map(t => Number(t.price_usd));

    this.chart?.destroy();
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'SIM / USD',
          data,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56,189,248,0.2)',
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true }
        },
        scales: {
          y: { beginAtZero: false }
        }
      }
    });
  }

  // Notificaciones P2P: helpers para botones del template
  approveReq(id: number): void {
    this.tradeReqApi.approve(id).subscribe({ next: () => this.loadMetrics() });
  }

  rejectReq(id: number): void {
    this.tradeReqApi.reject(id).subscribe({ next: () => this.loadMetrics() });
  }

  private setupTransactionViewport(): void {
    if (this.txRotationTimer) {
      clearInterval(this.txRotationTimer);
      this.txRotationTimer = undefined;
    }

    if (!this.recentTransactions.length) {
      this.visibleTransactions = [];
      return;
    }

    const windowSize = Math.min(this.txViewportSize, this.recentTransactions.length);
    this.txRotationIndex = 0;
    this.applyTransactionWindow(this.txRotationIndex, windowSize);

    if (this.recentTransactions.length <= windowSize) {
      return;
    }

    this.txRotationTimer = setInterval(() => {
      this.txRotationIndex = (this.txRotationIndex + 1) % this.recentTransactions.length;
      this.applyTransactionWindow(this.txRotationIndex, windowSize);
    }, 5000);
  }

  private applyTransactionWindow(startIndex: number, windowSize: number): void {
    const slice: Transaction[] = [];
    for (let offset = 0; offset < windowSize; offset += 1) {
      const idx = (startIndex + offset) % this.recentTransactions.length;
      slice.push(this.recentTransactions[idx]);
    }
    this.visibleTransactions = slice;
  }

  private loadCurrentUser(): void {
    this.meSub?.unsubscribe();
    this.meSub = this.auth.me().subscribe({
      next: (me) => { this.currentUsername = me.username; },
      error: () => { this.currentUsername = null; }
    });
  }

  private toCents(value: unknown): number {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num)) {
      return 0;
    }
    return Math.round(num * 100);
  }

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
