import { Component, OnInit } from '@angular/core';
import { CommonModule, NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WalletService } from './wallet.service';
import type { Wallet } from './wallet.service';

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

  constructor(private ws: WalletService) {}

  ngOnInit(): void { this.fetch(); }

  fetch() {
    this.loading = true;
    this.error = null;
    this.ws.list().subscribe({
      next: (data: Wallet[]) => {
        this.wallets = data; this.loading = false;
        // Mostrar CTA si venimos de registro y no hay wallets
        try {
          const flag = localStorage.getItem('ctaFirstWallet');
          this.showCta = !!flag && (!this.wallets || this.wallets.length === 0);
          if (flag) localStorage.removeItem('ctaFirstWallet');
        } catch {}
      },
      error: (_e: unknown) => { this.error = 'No se pudo cargar wallets'; this.loading = false; }
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
}
