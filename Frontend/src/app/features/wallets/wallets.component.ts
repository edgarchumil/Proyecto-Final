import { Component, OnInit } from '@angular/core';
import { CommonModule, NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { WalletService } from './wallet.service';
import type { Wallet } from './wallet.service';
import { TransactionsService, Transaction } from '../txs/transactions.service';
import { PriceService, PriceTick } from '../price/price.service';

@Component({
  selector: 'app-wallets',
  standalone: true,
  imports: [CommonModule, FormsModule, NgFor, NgIf, DatePipe, RouterLink],
  providers: [WalletService],
  templateUrl: './wallets.component.html',
  styleUrls: ['./wallets.component.css']
})
export class WalletsComponent implements OnInit {
  loading = false;
  error: string | null = null;
  wallets: Wallet[] = [];
  name: string = '';
  showCta = false;
  created?: Wallet;
  createdFirst = false;
  private balanceMap = new Map<number, number>(); // almacena centavos
  private simUsdPrice: number | null = null;
  private btcUsdReference = 68000; // referencia simple para conversión BTC

  constructor(
    private ws: WalletService,
    private txs: TransactionsService,
    private prices: PriceService
  ) {}

  ngOnInit(): void { this.fetch(); }

  fetch() {
    this.loading = true;
    this.error = null;
    forkJoin({
      wallets: this.ws.list(),
      txs: this.txs.list().pipe(catchError(() => of([] as Transaction[]))),
      price: this.prices.latest().pipe(catchError(() => of(null as PriceTick | null)))
    }).subscribe({
      next: ({ wallets, txs, price }) => {
        this.wallets = wallets;
        this.computeBalances(wallets, txs);
        this.simUsdPrice = price ? Number(price.price_usd) : null;
        this.loading = false;
        try {
          const flag = localStorage.getItem('ctaFirstWallet');
          this.showCta = !!flag && (!this.wallets || this.wallets.length === 0);
          if (flag) localStorage.removeItem('ctaFirstWallet');
        } catch {}
      },
      error: () => {
        this.error = 'No se pudo cargar wallets';
        this.loading = false;
      }
    });
  }

  create() {
    if (!this.name.trim()) return;
    this.loading = true;
    const wasEmpty = this.wallets.length === 0;
    this.ws.create(this.name.trim()).subscribe({
      next: (w: Wallet) => {
        this.name = '';
        this.created = w;
        this.createdFirst = wasEmpty;
        this.showCta = false;
        this.fetch();
      },
      error: () => { this.error = 'No se pudo crear la wallet'; this.loading = false; }
    });
  }

  remove(id: number) {
    if (!confirm('¿Eliminar esta wallet?')) return;
    this.loading = true;
    this.ws.remove(id).subscribe({
      next: () => this.fetch(),
      error: () => { this.error = 'No se pudo eliminar'; this.loading = false; }
    });
  }

  balanceSimOf(id: number): number {
    const cents = this.balanceMap.get(id) ?? 0;
    if (cents < 0) { return 0; }
    return this.round2(cents / 100);
  }

  balanceUsdOf(id: number): number | null {
    if (this.simUsdPrice == null) { return null; }
    return this.round2(this.balanceSimOf(id) * this.simUsdPrice);
  }

  balanceBtcOf(id: number): number | null {
    const usd = this.balanceUsdOf(id);
    if (usd == null) { return null; }
    if (!this.btcUsdReference) { return null; }
    return this.round8(usd / this.btcUsdReference);
  }

  private computeBalances(wallets: Wallet[], txs: Transaction[]): void {
    this.balanceMap.clear();
    wallets.forEach(w => this.balanceMap.set(w.id, 0));
    txs.filter(tx => tx.status === 'CONFIRMED').forEach(tx => {
      const amountCents = this.toCents(tx.amount);
      const feeCents = this.toCents(tx.fee);
      const from = this.balanceMap.get(tx.from_wallet);
      if (from !== undefined) {
        this.balanceMap.set(tx.from_wallet, from - amountCents - feeCents);
      }
      const to = this.balanceMap.get(tx.to_wallet);
      if (to !== undefined) {
        this.balanceMap.set(tx.to_wallet, to + amountCents);
      }
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

  private round8(value: number): number {
    return Math.round((value + Number.EPSILON) * 1e8) / 1e8;
  }
}
