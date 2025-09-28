import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { TransactionsService, Transaction, CreateTransactionPayload } from './transactions.service';
import { BlocksService, Block } from '../blocks/blocks.service';
import { WalletService, Wallet } from '../wallets/wallet.service';
import { UsersService, AppUser } from '../users/users.service';

@Component({
  selector: 'app-txs',
  standalone: true,
  imports: [CommonModule, FormsModule, NgFor, NgIf, DatePipe],
  templateUrl: './txs.component.html',
  styleUrls: ['./txs.component.css']
})
export class TxsComponent implements OnInit, OnDestroy {
  fromWalletId?: number;
  fromPubKey?: string;
  private sub?: Subscription;

  wallets: Wallet[] = [];
  users: AppUser[] = [];
  transactions: Transaction[] = [];
  blocks: Block[] = [];
  loading = false;
  error: string | null = null;
  sending = false;
  success: Transaction | null = null;

  form = {
    from_wallet: null as number | null,
    to_wallet: null as number | null,
    to_user: null as number | null,
    amount: 0,
    fee: 0.001,
  };

  statusFilter = 'ALL';
  walletFilter: number | null = null;

  // Selección de bloque por fila (tx.id -> blockId)
  confirmBlockId: Record<number, number | null> = {};

  constructor(
    private route: ActivatedRoute,
    private txs: TransactionsService,
    private walletsApi: WalletService,
    private blocksApi: BlocksService,
    private usersApi: UsersService
  ) {}

  ngOnInit(): void {
    this.sub = this.route.queryParamMap.subscribe(params => {
      const f = params.get('from');
      const p = params.get('pub');
      this.fromWalletId = f ? Number(f) : undefined;
      this.fromPubKey = p || undefined;
      if (this.fromWalletId) {
        this.form.from_wallet = this.fromWalletId;
        this.walletFilter = this.fromWalletId;
      }
    });

    this.loadWallets();
    this.loadUsers();
    this.loadBlocks();
    this.fetch();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  loadWallets(): void {
    this.walletsApi.list().subscribe({
      next: (data) => {
        this.wallets = data;
        if (!this.form.from_wallet && this.wallets.length) {
          this.form.from_wallet = this.wallets[0].id;
        }
      },
      error: () => this.error = 'No se pudo cargar tus wallets.'
    });
  }

  loadUsers(): void {
    this.usersApi.list().subscribe({
      next: (data) => this.users = data,
      error: () => {}
    });
  }

  fetch(): void {
    this.loading = true;
    this.error = null;
    const filters: { status?: string; wallet?: number } = {};
    if (this.statusFilter !== 'ALL') filters.status = this.statusFilter;
    if (this.walletFilter) filters.wallet = this.walletFilter;
    this.txs.list(filters).subscribe({
      next: data => { this.transactions = data; this.loading = false; },
      error: () => { this.error = 'No se pudo cargar transacciones.'; this.loading = false; }
    });
  }

  loadBlocks(): void {
    this.blocksApi.list().subscribe({
      next: (data) => {
        this.blocks = data;
        // Preseleccionar el primer bloque para filas pendientes si no hay selección
        const firstId = this.blocks.length ? this.blocks[0].id : null;
        this.transactions
          .filter(t => t.status === 'PENDING')
          .forEach(t => { if (this.confirmBlockId[t.id] == null) this.confirmBlockId[t.id] = firstId; });
      },
      error: () => { /* silencioso en dashboard de txs */ }
    });
  }

  create(): void {
    this.error = null;
    this.success = null;

    if (!this.form.from_wallet) {
      this.error = 'Selecciona la wallet emisora.';
      return;
    }

    let toWallet: number | null = null;
    let toUser: number | null = null;
    if (this.form.to_user) {
      toUser = Number(this.form.to_user);
      if (!Number.isInteger(toUser) || toUser <= 0) { this.error = 'Selecciona un usuario destino válido.'; return; }
    } else {
      const t = Number(this.form.to_wallet);
      if (!Number.isInteger(t) || t <= 0) { this.error = 'Ingresa un ID numérico válido para la wallet destino.'; return; }
      toWallet = t;
      if (toWallet === this.form.from_wallet) { this.error = 'La wallet destino debe ser distinta a la emisora.'; return; }
    }

    const amount = Number(this.form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      this.error = 'El monto debe ser mayor a cero.';
      return;
    }

    const fee = Number(this.form.fee);
    if (!Number.isFinite(fee) || fee < 0) {
      this.error = 'La comisión no puede ser negativa.';
      return;
    }

    this.form.to_wallet = toWallet;
    this.form.to_user = toUser;
    this.form.amount = amount;
    this.form.fee = fee;

    this.sending = true;
    const payload: CreateTransactionPayload = {
      from_wallet: this.form.from_wallet!,
      ...(toUser ? { to_user: toUser } : { to_wallet: toWallet! }),
      amount,
      fee,
    };
    this.txs.create(payload).subscribe({
      next: (tx) => {
        this.form.to_wallet = null;
        this.form.amount = 0;
        this.form.fee = 0.001;
        this.success = tx;
        this.fetch();
        this.sending = false;
      },
      error: () => {
        this.error = 'No se pudo enviar la transacción.';
        this.sending = false;
      }
    });
  }

  confirmTx(tx: Transaction): void {
    this.error = null;
    const blockId = this.confirmBlockId[tx.id] ?? (this.blocks[0]?.id ?? null);
    if (!blockId) { this.error = 'Primero crea/mina un bloque para confirmar.'; return; }
    this.sending = true;
    this.txs.confirm(tx.id, blockId).subscribe({
      next: () => { this.fetch(); this.sending = false; },
      error: () => { this.error = 'No se pudo confirmar la transacción.'; this.sending = false; }
    });
  }

  failTx(tx: Transaction): void {
    this.error = null;
    this.sending = true;
    this.txs.fail(tx.id).subscribe({
      next: () => { this.fetch(); this.sending = false; },
      error: () => { this.error = 'No se pudo marcar como fallida.'; this.sending = false; }
    });
  }

  applyFilters(): void { this.fetch(); }

  dismissSuccess(): void { this.success = null; }
}
