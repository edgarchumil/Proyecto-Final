// src/app/dashboard/dashboard.component.ts
import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ActivatedRoute, Router } from '@angular/router';
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
import { BlocksService, MiningSummary } from '../features/blocks/blocks.service';
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
  private readonly btcUsdReference = 68000;

  walletsCount: number | undefined;
  txCount: number | undefined;
  blockCount: number | undefined;
  auditCount: number | undefined;
  lastPrice: number | null = null;
  priceChangePct: number | null = null;
  holdingsUsd: number | null = null;
  confirmedCount = 0;
  pendingCount = 0;
  simUsdRate: number | null = null;
  usdSimRate: number | null = null;
  simBtcRate: number | null = null;
  btcSimRate: number | null = null;
  btcUsdRate: number | null = null;
  usdBtcRate: number | null = null;

  walletSummaries: WalletSummary[] = [];
  visibleWallets: WalletSummary[] = [];
  totalBalance = 0;
  totalUsdBalance = 0;
  totalBtcBalance: number | null = null;
  totalHoldingsBtc: number | null = null;
  minedAttempts = 0;
  recentTransactions: Transaction[] = [];
  visibleTransactions: Transaction[] = [];
  priceSeries: PriceTick[] = [];
  notifications: TradeRequest[] = [];
  currentUsername: string | null = null;

  loadingMetrics = false;
  welcomeBanner = false;
  purchaseSuccess = false;
  showTradeModal = false;

  constructor(
    private route: ActivatedRoute,
    private walletsApi: WalletService,
    private txsApi: TransactionsService,
    private blocksApi: BlocksService,
    private priceApi: PriceService,
    private auditApi: AuditService,
    public tradeReqApi: TradeRequestsService,
    private auth: AuthService,
    private preloader: PreloaderService,
    private router: Router
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
      if (p.get('buySuccess') === '1') {
        this.purchaseSuccess = true;
        setTimeout(() => this.purchaseSuccess = false, 6000);
      }
    });
    this.loadMetrics();
    // Auto-refresh de último precio cada 12s
    this.priceTimer = setInterval(() => {
      this.priceApi.latest().subscribe({
        next: (t) => {
          const latest = this.round2(Number(t.price_usd));
          this.lastPrice = latest;
          if (latest != null && latest > 0) {
            this.holdingsUsd = this.round2(this.totalBalance * latest);
            this.simUsdRate = latest;
            this.usdSimRate = this.round2(1 / latest);
            this.simBtcRate = this.round8(latest / this.btcUsdReference);
            this.btcSimRate = this.round2(this.btcUsdReference / latest);
          } else {
            this.holdingsUsd = null;
            this.simUsdRate = null;
            this.usdSimRate = null;
            this.simBtcRate = null;
            this.btcSimRate = null;
          }
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
      mining: this.blocksApi.miningSummary().pipe(catchError(() => of({ total_btc: '0', total_attempts: 0 } as MiningSummary))),
      prices: this.priceApi.list().pipe(catchError(() => of([] as PriceTick[]))),
      audit: this.auditApi.list().pipe(catchError(() => of([]))),
      notices: this.tradeReqApi.list('incoming', 'PENDING').pipe(catchError(() => of([] as TradeRequest[])))
    }).subscribe({
      next: ({ wallets, txs, blocks, mining, prices, audit, notices }) => {
        this.walletsCount = wallets.length;
        this.txsCountFromData(txs);
        this.blockCount = this.resolveBlockCount(blocks.length);
        this.auditCount = audit.length;
        this.notifications = notices;

        this.walletSummaries = this.buildWalletSummaries(wallets, txs);
        const totalSim = wallets.reduce((acc, item) => acc + Math.max(0, Number(item.balance_sim ?? item.balance ?? 0)), 0);
        const totalUsd = wallets.reduce((acc, item) => acc + Math.max(0, Number(item.balance_usd ?? 0)), 0);
        const totalBtc = wallets.reduce((acc, item) => acc + Math.max(0, Number(item.balance_btc ?? 0)), 0);
        const minedBtc = this.roundBtc(mining?.total_btc ?? 0);
        this.totalBalance = this.round2(totalSim);
        this.totalUsdBalance = this.round2(totalUsd);
        this.totalBtcBalance = this.roundBtc(totalBtc);
        this.totalHoldingsBtc = null;
        this.minedAttempts = mining?.total_attempts ?? 0;
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
        this.btcUsdRate = this.round2(this.btcUsdReference);
        this.usdBtcRate = this.round8(1 / this.btcUsdReference);
        if (this.lastPrice != null && this.lastPrice > 0) {
          const usdFromSim = this.round2(totalSim * this.lastPrice);
          const usdFromUsd = this.round2(totalUsd);
          const usdFromBtc = this.round2(totalBtc * this.btcUsdReference);
          const usdFromMined = this.round2(minedBtc * this.btcUsdReference);
          this.holdingsUsd = this.round2(usdFromSim + usdFromUsd + usdFromBtc + usdFromMined);
          const btcFromSim = this.btcUsdReference ? usdFromSim / this.btcUsdReference : 0;
          this.totalHoldingsBtc = this.roundBtc(btcFromSim + totalBtc + minedBtc);
          this.simUsdRate = this.lastPrice;
          this.usdSimRate = this.round2(1 / this.lastPrice);
          this.simBtcRate = this.round8(this.lastPrice / this.btcUsdReference);
          this.btcSimRate = this.round2(this.btcUsdReference / this.lastPrice);
        } else {
          this.holdingsUsd = this.round2(totalUsd + (this.btcUsdReference * (totalBtc + minedBtc)));
          this.totalHoldingsBtc = this.roundBtc(totalBtc + minedBtc);
          this.simUsdRate = null;
          this.usdSimRate = null;
          this.simBtcRate = null;
          this.btcSimRate = null;
        }

        this.loadingMetrics = false;
        this.renderChart();
      },
      error: () => {
        this.loadingMetrics = false;
      }
    });
  }

  openTradePrompt(event: Event): void {
    event.preventDefault();
    this.showTradeModal = true;
  }

  closeTradePrompt(): void {
    this.showTradeModal = false;
  }

  goToTrade(side: 'buy' | 'sell'): void {
    this.showTradeModal = false;
    this.router.navigate(['/trade'], { queryParams: { side } }).catch(() => {});
  }

  private buildWalletSummaries(wallets: Wallet[], txs: Transaction[]): WalletSummary[] {
    this.confirmedCount = 0;
    this.pendingCount = 0;

    txs.forEach(tx => {
      if (tx.status === 'CONFIRMED') {
        this.confirmedCount += 1;
      } else if (tx.status === 'PENDING') {
        this.pendingCount += 1;
      }
    });

    return wallets.map(wallet => ({
      wallet,
      balance: this.round2(Math.max(0, Number(wallet.balance_sim ?? wallet.balance ?? 0)))
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
    const data = this.priceSeries.map(t => this.round2(Number(t.price_usd)));

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
    const password = window.prompt('Ingresa tu contraseña para aprobar la solicitud P2P');
    if (!password || !password.trim()) {
      return;
    }
    this.tradeReqApi.approve(id, password.trim()).subscribe({
      next: () => this.loadMetrics()
    });
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

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private round8(value: number): number {
    return Math.round((value + Number.EPSILON) * 1e8) / 1e8;
  }

  private roundBtc(value: unknown): number {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num)) {
      return 0;
    }
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  private resolveBlockCount(actual: number): number {
    if (actual > 0) {
      this.clearMockBlockCount();
      return actual;
    }
    return this.ensureMockBlockCount();
  }

  private ensureMockBlockCount(): number {
    if (typeof localStorage === 'undefined') {
      return Math.random() < 0.5 ? 2 : 5;
    }
    try {
      const stored = localStorage.getItem('mockBlockCount');
      if (stored) {
        const parsed = Number(stored);
        if (parsed === 2 || parsed === 5) {
          return parsed;
        }
      }
    } catch {}
    const count = Math.random() < 0.5 ? 2 : 5;
    try { localStorage.setItem('mockBlockCount', String(count)); } catch {}
    return count;
  }

  private clearMockBlockCount(): void {
    if (typeof localStorage === 'undefined') { return; }
    try { localStorage.removeItem('mockBlockCount'); } catch {}
  }
}
