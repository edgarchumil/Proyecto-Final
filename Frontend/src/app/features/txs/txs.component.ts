import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { TransactionsService, Transaction } from './transactions.service';
import { BlocksService, Block } from '../blocks/blocks.service';
import { TradeRequestsService, TradeRequest, TradeApproveResponse } from '../trade/trade-requests.service';
import { WalletService } from '../wallets/wallet.service';

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

  transactions: Transaction[] = [];
  visibleTransactions: Transaction[] = [];
  blocks: Block[] = [];
  loading = false;
  error: string | null = null;
  sending = false;
  requestError: string | null = null;
  incomingRequests: TradeRequest[] = [];
  requestProcessing = new Set<number>();
  focusRequestId: number | null = null;
  private rotationTimer?: ReturnType<typeof setInterval>;
  private rotationIndex = 0;
  private readonly viewportSize = 7;
  showApproveModal = false;
  approvePassword = '';
  approveError: string | null = null;
  approveProcessing = false;
  pendingApproveRequest: TradeRequest | null = null;

  // Selección de bloque por fila (tx.id -> blockId)
  confirmBlockId: Record<number, number | null> = {};

  constructor(
    private route: ActivatedRoute,
    private txs: TransactionsService,
    private blocksApi: BlocksService,
    private tradeReqApi: TradeRequestsService,
    private walletsApi: WalletService
  ) {}

  ngOnInit(): void {
    this.sub = this.route.queryParamMap.subscribe(params => {
      const f = params.get('from');
      const p = params.get('pub');
      const req = params.get('request');
      this.fromWalletId = f ? Number(f) : undefined;
      this.fromPubKey = p || undefined;
      this.focusRequestId = req ? Number(req) : null;
    });

    this.fetch();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = undefined;
    }
  }

  fetch(): void {
    this.loading = true;
    this.error = null;
    this.txs.list().subscribe({
      next: data => {
        this.transactions = data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        this.setupRotation();
        this.loading = false;
        this.loadBlocks(true);
        this.loadTradeRequests();
      },
      error: (err) => { this.error = typeof err?.error?.detail === 'string' ? err.error.detail : 'No se pudo cargar transacciones.'; this.loading = false; }
    });
  }

  loadBlocks(force = false): void {
    this.blocksApi.list().subscribe({
      next: (data) => {
        const sorted = [...data].sort((a, b) => b.height - a.height);
        this.blocks = sorted;
        const firstId = this.blocks.length ? this.blocks[0].id : null;
        this.transactions
          .filter(t => t.status === 'PENDING')
          .forEach(t => {
            if (force || this.confirmBlockId[t.id] == null) {
              this.confirmBlockId[t.id] = firstId;
            }
          });
      },
      error: () => { /* silencioso en dashboard de txs */ }
    });
  }

  loadTradeRequests(): void {
    this.requestError = null;
    this.tradeReqApi.list('incoming', 'PENDING').subscribe({
      next: (reqs) => {
        this.incomingRequests = reqs;
      },
      error: (err) => {
        this.requestError = typeof err?.error?.detail === 'string' ? err.error.detail : 'No se pudo cargar las solicitudes P2P.';
        this.incomingRequests = [];
      }
    });
  }

  approveRequest(req: TradeRequest): void {
    if (this.requestProcessing.has(req.id)) { return; }
    this.pendingApproveRequest = req;
    this.approvePassword = '';
    this.approveError = null;
    this.showApproveModal = true;
  }

  rejectRequest(req: TradeRequest): void {
    if (this.requestProcessing.has(req.id)) { return; }
    this.requestProcessing.add(req.id);
    this.requestError = null;
    this.tradeReqApi.reject(req.id).subscribe({
      next: () => {
        this.requestProcessing.delete(req.id);
        this.incomingRequests = this.incomingRequests.filter(r => r.id !== req.id);
      },
      error: (err) => {
        this.requestProcessing.delete(req.id);
        this.requestError = typeof err?.error?.detail === 'string' ? err.error.detail : 'No se pudo rechazar la solicitud.';
      }
    });
  }

  confirmTx(tx: Transaction): void {
    this.error = null;
    const blockId = this.confirmBlockId[tx.id];
    this.sending = true;
    this.txs.confirm(tx.id, blockId ?? null).subscribe({
      next: () => { this.fetch(); this.sending = false; },
      error: (err) => {
        this.error = typeof err?.error?.detail === 'string' ? err.error.detail : 'No se pudo confirmar la transacción.';
        this.sending = false;
      }
    });
  }

  failTx(tx: Transaction): void {
    this.error = null;
    this.sending = true;
    this.txs.fail(tx.id).subscribe({
      next: () => { this.fetch(); this.sending = false; },
      error: (err) => {
        this.error = typeof err?.error?.detail === 'string' ? err.error.detail : 'No se pudo marcar como fallida.';
        this.sending = false;
      }
    });
  }

  private setupRotation(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = undefined;
    }
    if (!this.transactions.length) {
      this.visibleTransactions = [];
      return;
    }
    const windowSize = Math.min(this.viewportSize, this.transactions.length);
    this.rotationIndex = 0;
    this.applyWindow(this.rotationIndex, windowSize);
    if (this.transactions.length <= windowSize) {
      return;
    }
    this.rotationTimer = setInterval(() => {
      this.rotationIndex = (this.rotationIndex + windowSize) % this.transactions.length;
      this.applyWindow(this.rotationIndex, windowSize);
    }, 6000);
  }

  private applyWindow(startIndex: number, windowSize: number): void {
    const slice: Transaction[] = [];
    for (let offset = 0; offset < windowSize; offset += 1) {
      const idx = (startIndex + offset) % this.transactions.length;
      slice.push(this.transactions[idx]);
    }
    this.visibleTransactions = slice;
  }

  isProcessingRequest(id: number): boolean {
    return this.requestProcessing.has(id);
  }

  confirmApprove(): void {
    if (!this.pendingApproveRequest) { return; }
    const password = this.approvePassword.trim();
    if (!password) {
      this.approveError = 'Ingresa tu contraseña para continuar.';
      return;
    }
    const req = this.pendingApproveRequest;
    this.approveProcessing = true;
    this.requestProcessing.add(req.id);
    this.requestError = null;
    this.tradeReqApi.approve(req.id, password).subscribe({
      next: (res: TradeApproveResponse) => {
        this.requestProcessing.delete(req.id);
        this.approveProcessing = false;
        this.applyWalletUpdates(res);
        this.walletsApi.list().subscribe({ next: () => {}, error: () => {} });
        this.closeApproveModal();
        this.incomingRequests = this.incomingRequests.filter(r => r.id !== req.id);
        this.fetch();
      },
      error: (err) => {
        this.requestProcessing.delete(req.id);
        this.approveProcessing = false;
        const detail = err?.error?.detail;
        if (typeof detail === 'string') {
          this.approveError = detail;
        } else if (Array.isArray(err?.error?.password) && err.error.password.length) {
          this.approveError = String(err.error.password[0]);
        } else if (typeof err?.error?.password === 'string') {
          this.approveError = err.error.password;
        } else {
          this.approveError = 'No se pudo aprobar la solicitud.';
        }
      }
    });
  }

  closeApproveModal(): void {
    if (this.approveProcessing) { return; }
    this.showApproveModal = false;
    this.pendingApproveRequest = null;
    this.approvePassword = '';
    this.approveError = null;
  }

  private applyWalletUpdates(res: TradeApproveResponse): void {
    if (!res.wallets) { return; }
    const { requester, counterparty } = res.wallets;
    if (requester) {
      this.walletsApi.applyBalancePatch(requester.wallet_id, requester.balances ?? {});
    }
    if (counterparty) {
      this.walletsApi.applyBalancePatch(counterparty.wallet_id, counterparty.balances ?? {});
    }
  }
}
