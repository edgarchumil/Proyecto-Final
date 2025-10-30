import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { TransactionsService, Transaction } from './transactions.service';
import { BlocksService, Block } from '../blocks/blocks.service';

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
  private rotationTimer?: ReturnType<typeof setInterval>;
  private rotationIndex = 0;
  private readonly viewportSize = 7;

  // Selección de bloque por fila (tx.id -> blockId)
  confirmBlockId: Record<number, number | null> = {};

  constructor(
    private route: ActivatedRoute,
    private txs: TransactionsService,
    private blocksApi: BlocksService,
  ) {}

  ngOnInit(): void {
    this.sub = this.route.queryParamMap.subscribe(params => {
      const f = params.get('from');
      const p = params.get('pub');
      this.fromWalletId = f ? Number(f) : undefined;
      this.fromPubKey = p || undefined;
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
}
