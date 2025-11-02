import { Component, OnInit } from '@angular/core';
import { CommonModule, NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { WalletService } from './wallet.service';
import type { Wallet } from './wallet.service';
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
  private balances = new Map<number, { SIM: number; USD: number; BTC: number }>();
  private simUsdPrice: number | null = null;
  private btcUsdReference = 68000; // referencia simple para conversión BTC

  constructor(
    private ws: WalletService,
    private prices: PriceService
  ) {}

  ngOnInit(): void { this.fetch(); }

  fetch() {
    this.loading = true;
    this.error = null;
    forkJoin({
      wallets: this.ws.list(),
      price: this.prices.latest().pipe(catchError(() => of(null as PriceTick | null)))
    }).subscribe({
      next: ({ wallets, price }) => {
        this.wallets = wallets;
        this.computeBalances(wallets);
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
    const balances = this.balances.get(id);
    if (!balances) { return 0; }
    return this.round2(balances.SIM);
  }

  balanceUsdOf(id: number): number {
    const balances = this.balances.get(id);
    if (!balances) { return 0; }
    const simPortion = this.simUsdPrice != null ? balances.SIM * this.simUsdPrice : null;
    const btcPortion = this.btcUsdReference ? balances.BTC * this.btcUsdReference : null;
    const usdPortion = balances.USD;
    if (simPortion == null && btcPortion == null) {
      return this.round2(usdPortion);
    }
    return this.round2((simPortion ?? 0) + usdPortion + (btcPortion ?? 0));
  }

  balanceBtcOf(id: number): number {
    const balances = this.balances.get(id);
    if (!balances) { return 0; }
    return this.round8(balances.BTC);
  }

  private computeBalances(wallets: Wallet[]): void {
    this.balances.clear();
    wallets.forEach(wallet => {
      const simRaw = wallet.balance_sim ?? wallet.balance ?? '0';
      const usdRaw = wallet.balance_usd ?? '0';
      const btcRaw = wallet.balance_btc ?? '0';
      this.balances.set(wallet.id, {
        SIM: Number(simRaw) || 0,
        USD: Number(usdRaw) || 0,
        BTC: Number(btcRaw) || 0,
      });
    });
  }

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private round8(value: number): number {
    return Math.round((value + Number.EPSILON) * 1e8) / 1e8;
  }
}
