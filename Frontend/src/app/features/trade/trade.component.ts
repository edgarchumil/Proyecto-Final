import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TradeService, TradePayload, TradeMethod } from './trade.service';
import { WalletService, Wallet } from '../wallets/wallet.service';
import { UsersService, AppUser } from '../users/users.service';
import { TradeRequestsService } from './trade-requests.service';
import { ActivatedRoute, Router } from '@angular/router';

interface BuyOption {
  id: string;
  label: string;
  description: string;
  icon: string;
  method: TradeMethod;
  enableP2P: boolean;
}

interface TradeFormState {
  wallet: number | null;
  amount: number;
  fee: number;
  method: TradeMethod;
  reference: string;
  currency: 'SIM' | 'USD' | 'BTC';
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
  form: TradeFormState = {
    wallet: null,
    amount: 0,
    fee: 0,
    method: 'BANK',
    reference: '',
    currency: 'SIM'
  };
  useP2PRequest = false;
  counterparty: number | null = null;
  loading = false;
  error: string | null = null;
  success: { id: number; tx_hash: string } | null = null;
  successMessage: string | null = null;
  mode: 'buy' | 'sell' = 'buy';
  buyOptions: BuyOption[] = [
    { id: 'BANK', label: 'Transferencia bancaria (SPEI)', description: 'Compra cripto vía transferencia local.', icon: '🏦', method: 'BANK', enableP2P: false },
    { id: 'P2P', label: 'Comercio P2P', description: 'Transferencia bancaria y más de 100 opciones.', icon: '🤝', method: 'P2P', enableP2P: true }
  ];
  sellOptions: BuyOption[] = [
    { id: 'BANK', label: 'Transferencia bancaria (SPEI)', description: 'Vende cripto y recibe transferencia local.', icon: '🏦', method: 'BANK', enableP2P: false },
    { id: 'P2P', label: 'Comercio P2P', description: 'Encuentra compradores verificados.', icon: '🤝', method: 'P2P', enableP2P: true }
  ];
  selectedOptionId: string | null = null;
  private selectedOption: BuyOption | null = null;
  showBuyModal = false;
  showAuthModal = false;
  authPassword = '';
  authProcessing = false;
  authError: string | null = null;
  pendingMode: 'buy' | 'sell' | null = null;
  private pendingP2pRequest: { counterparty: number; amount: number; fee: number; currency: 'SIM'|'USD'|'BTC'; side: 'buy' | 'sell' } | null = null;

  constructor(
    private trade: TradeService,
    private walletsApi: WalletService,
    private usersApi: UsersService,
    private tradeReqApi: TradeRequestsService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadWallets();
    this.usersApi.list().subscribe({ next: u => this.users = u, error: () => {} });
    this.selectedOptionId = null;
    this.selectedOption = null;
    this.route.queryParamMap.subscribe(params => {
      const side = (params.get('side') || '').toLowerCase();
      this.updateMode(side === 'sell' ? 'sell' : 'buy');
    });
  }

  changeMode(mode: 'buy' | 'sell'): void {
    this.updateMode(mode, true);
  }

  get currentOptions(): BuyOption[] {
    return this.mode === 'sell' ? this.sellOptions : this.buyOptions;
  }

  submit(): void {
    this.error = null; this.success = null; this.successMessage = null;
    const wallet = this.form.wallet || 0;
    if (!wallet) { this.error = 'Selecciona una wallet.'; return; }
    const amount = this.round2(Number(this.form.amount));
    if (!Number.isFinite(amount) || amount <= 0) { this.error = 'Monto inválido.'; return; }
    const fee = this.round2(Number(this.form.fee));
    if (!Number.isFinite(fee) || fee < 0) { this.error = 'Fee inválida.'; return; }
    this.form.amount = amount;
    this.form.fee = fee;
    const converted = this.toSimAmount(amount, fee);
    const currency = this.form.currency;

    // Si es solicitud P2P, abrir confirmación para capturar contraseña
    if (this.useP2PRequest) {
      const cp = Number(this.counterparty);
      if (!Number.isInteger(cp) || cp <= 0) { this.error = 'Selecciona una contraparte.'; return; }
      this.pendingP2pRequest = { counterparty: cp, amount: converted.amount, fee: converted.fee, side: this.mode, currency };
      this.pendingMode = null;
      this.authPassword = '';
      this.authError = null;
      this.authProcessing = false;
      this.showAuthModal = true;
      return;
    }

    this.pendingPayload = {
      wallet,
      amount: converted.amount,
      fee: converted.fee,
      currency,
      reference: this.form.reference || undefined
    };
    this.pendingMode = this.mode;
    this.authPassword = '';
    this.authError = null;
    this.authProcessing = false;
    this.showAuthModal = true;
  }

  private updateMode(mode: 'buy' | 'sell', updateQuery = false): void {
    const changed = this.mode !== mode;
    if (changed) {
      this.mode = mode;
      this.selectedOptionId = null;
      this.selectedOption = null;
      this.useP2PRequest = false;
      this.counterparty = null;
      this.form.method = 'BANK';
      this.form.reference = '';
      this.form.amount = 0;
      this.form.fee = 0;
      this.pendingP2pRequest = null;
      this.pendingPayload = null;
      this.pendingMode = null;
      this.success = null;
      this.successMessage = null;
      this.error = null;
      this.showBuyModal = false;
      this.showAuthModal = false;
      this.authPassword = '';
      this.authProcessing = false;
      this.authError = null;
      this.loading = false;
    }
    if (updateQuery) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { side: mode },
        queryParamsHandling: 'merge'
      }).catch(() => {});
    }
  }

  selectOption(optionId: string, openModal = true): void {
    const option = this.currentOptions.find(o => o.id === optionId);
    if (!option) { return; }
    this.selectedOptionId = option.id;
    this.form.method = option.method;
    this.form.reference = '';
    this.form.amount = 0;
    this.form.fee = 0;
    this.pendingP2pRequest = null;
    this.pendingPayload = null;
    this.counterparty = null;
    if (option.enableP2P) {
      this.useP2PRequest = true;
    } else {
      this.useP2PRequest = false;
      this.pendingP2pRequest = null;
    }
    this.selectedOption = option;
    this.error = null;
    this.success = null;
    this.successMessage = null;
    if (openModal) {
      this.showBuyModal = true;
    }
  }

  get selectedOptionLabel(): string {
    if (!this.selectedOptionId) { return 'Selecciona un método'; }
    if (this.selectedOption && this.selectedOption.id === this.selectedOptionId) {
      return this.selectedOption.label;
    }
    const fallback = this.currentOptions.find(o => o.id === this.selectedOptionId);
    if (!fallback) { return 'Selecciona un método'; }
    return fallback.label;
  }

  closeBuyModal(): void {
    this.showBuyModal = false;
    this.pendingP2pRequest = null;
    this.pendingPayload = null;
    this.pendingMode = null;
    this.success = null;
    this.successMessage = null;
    this.error = null;
  }

  closeAuthModal(): void {
    this.showAuthModal = false;
    this.authPassword = '';
    this.authProcessing = false;
    this.authError = null;
    this.loading = false;
    this.pendingP2pRequest = null;
    this.pendingPayload = null;
    this.pendingMode = null;
  }

  confirmTrade(): void {
    const password = this.authPassword.trim();
    if (!password) {
      this.authError = 'Ingresa tu contraseña para continuar.';
      return;
    }
    if (this.pendingP2pRequest) {
      this.authProcessing = true;
      const { counterparty, amount, fee, currency, side } = this.pendingP2pRequest;
      const p2pSide = side === 'sell' ? 'SELL' : 'BUY';
      this.tradeReqApi.create({ counterparty, side: p2pSide, amount, fee, currency, password }).subscribe({
        next: (req) => {
          this.success = { id: req.id, tx_hash: req.token };
          this.successMessage = side === 'sell'
            ? 'Solicitud de venta enviada con éxito.'
            : 'Solicitud de compra enviada con éxito.';
          this.authProcessing = false;
          this.authError = null;
          this.pendingP2pRequest = null;
          this.closeAuthModal();
          this.loadWallets();
          setTimeout(() => {
            this.showBuyModal = false;
            if (side === 'buy') {
              this.router.navigate(['/dashboard'], { queryParams: { buySuccess: '1' } }).catch(() => {});
            }
          }, 3000);
        },
        error: (err) => {
          const errorDetail = err?.error;
          if (typeof errorDetail?.detail === 'string') {
            this.authError = errorDetail.detail;
          } else if (Array.isArray(errorDetail?.password) && errorDetail.password.length) {
            this.authError = String(errorDetail.password[0]);
          } else if (typeof errorDetail?.password === 'string') {
            this.authError = errorDetail.password;
          } else if (Array.isArray(errorDetail?.non_field_errors) && errorDetail.non_field_errors.length) {
            this.authError = String(errorDetail.non_field_errors[0]);
          } else {
            this.authError = 'No se pudo crear la solicitud.';
          }
          this.authProcessing = false;
        }
      });
      return;
    }
    if (!this.pendingPayload || !this.pendingMode) {
      this.authError = 'No hay datos de operación pendientes.';
      return;
    }
    this.authProcessing = true;
    const actionMode = this.pendingMode;
    const payload: TradePayload = {
      wallet: this.pendingPayload.wallet,
      amount: this.pendingPayload.amount,
      fee: this.pendingPayload.fee,
      currency: this.pendingPayload.currency,
      method: this.form.method,
      reference: this.pendingPayload.reference,
      password
    };
    const action$ = actionMode === 'sell' ? this.trade.sell(payload) : this.trade.buy(payload);
    action$.subscribe({
      next: (tx) => {
        this.success = { id: tx.id, tx_hash: tx.tx_hash };
        this.successMessage = actionMode === 'sell'
          ? 'Venta completada con éxito.'
          : 'Compra completada con éxito.';
        this.authProcessing = false;
        this.authError = null;
        setTimeout(() => {
          this.closeAuthModal();
          this.loading = false;
          this.showBuyModal = false;
          this.loadWallets();
          if (actionMode === 'buy') {
            this.router.navigate(['/dashboard'], { queryParams: { buySuccess: '1' } }).catch(() => {});
          }
        }, 3000);
      },
      error: (err) => {
        this.authProcessing = false;
        const defaultMsg = actionMode === 'sell'
          ? 'No se pudo ejecutar la orden de venta.'
          : 'No se pudo ejecutar la orden de compra.';
        this.authError = typeof err?.error?.detail === 'string' ? err.error.detail : defaultMsg;
      }
    });
  }

  private round2(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private pendingPayload: { wallet: number; amount: number; fee: number; currency: 'SIM'|'USD'|'BTC'; reference?: string } | null = null;

  private toSimAmount(amount: number, fee: number): { amount: number; fee: number } {
    return {
      amount: this.round2(amount),
      fee: this.round2(fee)
    };
  }

  private loadWallets(): void {
    this.walletsApi.list().subscribe({
      next: (w) => {
        this.wallets = w;
        if (!this.form.wallet && w.length) {
          this.form.wallet = w[0].id;
        }
      },
      error: (err) => {
        this.error = typeof err?.error?.detail === 'string' ? err.error.detail : 'No se pudo cargar wallets.';
      }
    });
  }

}
