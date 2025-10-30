import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TradeService, TradePayload, TradeMethod } from './trade.service';
import { WalletService, Wallet } from '../wallets/wallet.service';
import { UsersService, AppUser } from '../users/users.service';
import { TradeRequestsService } from './trade-requests.service';
import { PriceService } from '../price/price.service';
import { Router } from '@angular/router';

interface BuyOption {
  id: string;
  label: string;
  description: string;
  icon: string;
  method: TradeMethod;
  enableP2P: boolean;
}

@Component({
  selector: 'app-trade',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trade.component.html',
  styleUrls: ['./trade.component.css']
})
export class TradeComponent implements OnInit {
  wallets: Wallet[] = [];
  users: AppUser[] = [];
  form = { wallet: null as number | null, amount: 0.0, fee: 0.0, method: 'BANK' as TradeMethod, reference: '', currency: 'SIM' as 'SIM' | 'USD' | 'BTC' };
  useP2PRequest = false;
  counterparty: number | null = null;
  loading = false;
  error: string | null = null;
  success: { id: number; tx_hash: string } | null = null;
  buyOptions: BuyOption[] = [
    { id: 'BANK', label: 'Transferencia bancaria (SPEI)', description: 'Compra cripto vía transferencia local.', icon: '🏦', method: 'BANK', enableP2P: false },
    { id: 'CARD', label: 'Tarjeta de crédito/débito', description: 'Paga con tarjeta, Apple Pay o Google Pay.', icon: '💳', method: 'CARD', enableP2P: false },
    { id: 'P2P', label: 'Comercio P2P', description: 'Transferencia bancaria y más de 100 opciones.', icon: '🤝', method: 'P2P', enableP2P: true }
  ];
  selectedBuyOption: string | null = null;
  private selectedOption: BuyOption | null = null;
  showBuyModal = false;
  showAuthModal = false;
  authPassword = '';
  authProcessing = false;
  authError: string | null = null;
  private simUsdPrice: number | null = null;
  private btcUsdReference = 68000;

  constructor(
    private trade: TradeService,
    private walletsApi: WalletService,
    private usersApi: UsersService,
    private tradeReqApi: TradeRequestsService,
    private priceApi: PriceService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.walletsApi.list().subscribe({
      next: (w) => { this.wallets = w; if (!this.form.wallet && w.length) this.form.wallet = w[0].id; },
      error: (err) => { this.error = typeof err?.error?.detail === 'string' ? err.error.detail : 'No se pudo cargar wallets.'; }
    });
    this.usersApi.list().subscribe({ next: u => this.users = u, error: () => {} });
    this.selectedBuyOption = null;
    this.selectedOption = null;
    this.priceApi.latest().subscribe({
      next: (tick) => { this.simUsdPrice = Number(tick.price_usd); },
      error: () => { this.simUsdPrice = null; }
    });
  }

  submit(): void {
    this.error = null; this.success = null;
    const wallet = this.form.wallet || 0;
    if (!wallet) { this.error = 'Selecciona una wallet.'; return; }
    const amount = this.round2(Number(this.form.amount));
    if (!Number.isFinite(amount) || amount <= 0) { this.error = 'Monto inválido.'; return; }
    const fee = this.round2(Number(this.form.fee));
    if (!Number.isFinite(fee) || fee < 0) { this.error = 'Fee inválida.'; return; }
    this.form.amount = amount;
    this.form.fee = fee;
    // Si es solicitud P2P, crear notificación para la contraparte
    if (this.useP2PRequest) {
      const cp = Number(this.counterparty);
      if (!Number.isInteger(cp) || cp <= 0) { this.error = 'Selecciona una contraparte.'; return; }
      this.loading = true;
      this.tradeReqApi.create({ counterparty: cp, side: 'BUY', amount, fee }).subscribe({
        next: (req) => { this.success = { id: req.id, tx_hash: req.token }; this.loading = false; },
        error: (err) => { this.error = typeof err?.error?.detail === 'string' ? err.error.detail : 'No se pudo crear la solicitud.'; this.loading = false; }
      });
      return;
    }

    const converted = this.toSimAmount(amount, fee);
    if (!converted) {
      this.error = 'No se pudo determinar el tipo de cambio para la moneda seleccionada.';
      return;
    }
    this.pendingPayload = {
      wallet,
      amountSim: converted.amount,
      feeSim: converted.fee,
      reference: this.form.reference || undefined
    };
    this.authPassword = '';
    this.authError = null;
    this.authProcessing = false;
    this.showAuthModal = true;
  }

  selectBuyOption(optionId: string, openModal = true): void {
    const option = this.buyOptions.find(o => o.id === optionId);
    if (!option) { return; }
    this.selectedBuyOption = option.id;
    this.form.method = option.method;
    this.form.reference = '';
    this.form.amount = 0;
    this.form.fee = 0;
    if (option.enableP2P) {
      this.useP2PRequest = true;
    } else {
      this.useP2PRequest = false;
      this.counterparty = null;
    }
    this.selectedOption = option;
    this.error = null;
    this.success = null;
    if (openModal) {
      this.showBuyModal = true;
    }
  }

  get selectedBuyOptionLabel(): string {
    if (!this.selectedBuyOption) { return 'Selecciona un método'; }
    if (this.selectedOption && this.selectedOption.id === this.selectedBuyOption) {
      return this.selectedOption.label;
    }
    const fallback = this.buyOptions.find(o => o.id === this.selectedBuyOption);
    return fallback ? fallback.label : 'Selecciona un método';
  }

  closeBuyModal(): void {
    this.showBuyModal = false;
  }

  closeAuthModal(): void {
    this.showAuthModal = false;
    this.authPassword = '';
    this.authProcessing = false;
    this.authError = null;
  }

  confirmPurchase(): void {
    if (!this.pendingPayload) {
      this.authError = 'No hay datos de compra pendientes.';
      return;
    }
    if (!this.authPassword.trim()) {
      this.authError = 'Ingresa tu contraseña para continuar.';
      return;
    }
    this.authProcessing = true;
    const payload: TradePayload = {
      wallet: this.pendingPayload.wallet,
      amount: this.pendingPayload.amountSim,
      fee: this.pendingPayload.feeSim,
      method: this.form.method,
      reference: this.pendingPayload.reference,
      password: this.authPassword
    };
    this.trade.buy(payload).subscribe({
      next: (tx) => {
        this.success = { id: tx.id, tx_hash: tx.tx_hash };
        this.authProcessing = false;
        this.authError = null;
        setTimeout(() => {
          this.closeAuthModal();
          this.loading = false;
          this.pendingPayload = null;
          this.showBuyModal = false;
          this.router.navigate(['/dashboard'], { queryParams: { buySuccess: '1' } }).catch(() => {});
        }, 1500);
      },
      error: (err) => {
        this.authProcessing = false;
        this.authError = typeof err?.error?.detail === 'string' ? err.error.detail : 'No se pudo ejecutar la orden.';
      }
    });
  }

  private round2(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private pendingPayload: { wallet: number; amountSim: number; feeSim: number; reference?: string } | null = null;

  private toSimAmount(amount: number, fee: number): { amount: number; fee: number } | null {
    switch (this.form.currency) {
      case 'SIM':
        return { amount: this.round2(amount), fee: this.round2(fee) };
      case 'USD':
        if (!this.simUsdPrice || this.simUsdPrice <= 0) { return null; }
        return {
          amount: this.round2(amount / this.simUsdPrice),
          fee: this.round2(fee / this.simUsdPrice)
        };
      case 'BTC':
        if (!this.simUsdPrice || this.simUsdPrice <= 0 || !this.btcUsdReference) { return null; }
        const usdAmount = amount * this.btcUsdReference;
        const usdFee = fee * this.btcUsdReference;
        return {
          amount: this.round2(usdAmount / this.simUsdPrice),
          fee: this.round2(usdFee / this.simUsdPrice)
        };
      default:
        return null;
    }
  }
}
