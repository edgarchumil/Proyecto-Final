import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TradeService, TradePayload, TradeMethod } from './trade.service';
import { WalletService, Wallet } from '../wallets/wallet.service';
import { UsersService, AppUser } from '../users/users.service';
import { TradeRequestsService } from './trade-requests.service';

@Component({
  selector: 'app-trade',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trade.component.html',
  styleUrls: ['./trade.component.css']
})
export class TradeComponent implements OnInit {
  side: 'BUY' | 'SELL' = 'BUY';
  wallets: Wallet[] = [];
  users: AppUser[] = [];
  form = { wallet: null as number | null, amount: 0.0, fee: 0.001, method: 'BANK' as TradeMethod, reference: '' };
  useP2PRequest = false;
  counterparty: number | null = null;
  loading = false;
  error: string | null = null;
  success: { id: number; tx_hash: string } | null = null;

  constructor(private trade: TradeService, private walletsApi: WalletService, private usersApi: UsersService, private tradeReqApi: TradeRequestsService) {}

  ngOnInit(): void {
    this.walletsApi.list().subscribe({
      next: (w) => { this.wallets = w; if (!this.form.wallet && w.length) this.form.wallet = w[0].id; },
      error: () => { this.error = 'No se pudo cargar wallets.'; }
    });
    this.usersApi.list().subscribe({ next: u => this.users = u, error: () => {} });
  }

  submit(): void {
    this.error = null; this.success = null;
    const wallet = this.form.wallet || 0;
    if (!wallet) { this.error = 'Selecciona una wallet.'; return; }
    const amount = Number(this.form.amount);
    if (!Number.isFinite(amount) || amount <= 0) { this.error = 'Monto inválido.'; return; }
    const fee = Number(this.form.fee);
    if (!Number.isFinite(fee) || fee < 0) { this.error = 'Fee inválida.'; return; }
    // Si es solicitud P2P, crear notificación para la contraparte
    if (this.useP2PRequest) {
      const cp = Number(this.counterparty);
      if (!Number.isInteger(cp) || cp <= 0) { this.error = 'Selecciona una contraparte.'; return; }
      this.loading = true;
      this.tradeReqApi.create({ counterparty: cp, side: this.side, amount, fee }).subscribe({
        next: (req) => { this.success = { id: req.id, tx_hash: req.token }; this.loading = false; },
        error: () => { this.error = 'No se pudo crear la solicitud.'; this.loading = false; }
      });
      return;
    }

    const payload: TradePayload = { wallet, amount, fee, method: this.form.method, reference: this.form.reference || undefined };
    this.loading = true;
    const obs = this.side === 'BUY' ? this.trade.buy(payload) : this.trade.sell(payload);
    obs.subscribe({
      next: (tx) => { this.success = { id: tx.id, tx_hash: tx.tx_hash }; this.loading = false; },
      error: () => { this.error = 'No se pudo ejecutar la orden.'; this.loading = false; }
    });
  }
}
