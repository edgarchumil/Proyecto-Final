import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, NgFor, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { BlocksService, Block, MiningSummary } from './blocks.service';

@Component({
  selector: 'app-blocks',
  standalone: true,
  imports: [CommonModule, NgFor, FormsModule, DatePipe],
  templateUrl: './blocks.component.html',
  styleUrls: ['./blocks.component.css']
})
export class BlocksComponent implements OnInit, OnDestroy {
  blocks: Block[] = [];
  loading = false;
  error: string | null = null;
  infoMessage: string | null = null;

  merkle = '';
  nonce = '';
  currentHash = '';
  mining = false;
  rowMiningId: number | null = null;
  totalMinedBtc = 0;
  minedAttempts = 0;
  private summarySub?: Subscription;

  constructor(private service: BlocksService) {}

  ngOnInit(): void {
    this.refresh();
    this.loadMiningSummary();
  }

  ngOnDestroy(): void {
    this.summarySub?.unsubscribe();
  }

  refresh(): void {
    this.loading = true;
    this.error = null;
    this.service.list().subscribe({
      next: (blocks) => {
        if (blocks.length) {
          this.blocks = blocks.sort((a, b) => b.height - a.height);
          this.clearMockBlockCount();
        } else {
          const mockCount = this.ensureMockBlockCount();
          this.blocks = this.buildMockBlocks(mockCount);
        }
        this.currentHash = '';
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudo cargar la cadena de bloques.';
        this.loading = false;
      }
    });
  }

  mine(): void {
    if (!this.merkle.trim() || !this.nonce.trim()) {
      this.error = 'Ingresa merkle_root y nonce.';
      return;
    }
    this.error = null;
    this.infoMessage = null;
    this.mining = true;
    this.service.create({ merkle_root: this.merkle.trim(), nonce: this.nonce.trim() }).subscribe({
      next: (created) => {
        this.merkle = '';
        this.nonce = '';
        this.currentHash = '';
        this.mining = false;
        const message = created?.height !== undefined
          ? `Bloque #${created.height} minado.`
          : 'Bloque minado correctamente.';
        this.refresh();
        this.loadMiningSummary(message);
      },
      error: (err: HttpErrorResponse) => {
        if (err?.status === 401) {
          this.error = 'Debes iniciar sesión para minar un bloque.';
        } else if (err?.status === 400) {
          const detail = typeof err.error === 'string' ? err.error : JSON.stringify(err.error);
          this.error = `Datos inválidos al minar el bloque. ${detail}`;
        } else {
          this.error = 'No se pudo minar el bloque.';
        }
        this.mining = false;
      }
    });
  }

  simulateMining(block: Block): void {
    if (this.rowMiningId !== null) { return; }
    if (block.id < 0) {
      this.mineMockBlock(block);
      return;
    }
    this.error = null;
    this.infoMessage = null;
    this.rowMiningId = block.id;
    this.service.simulateMining(block.id).subscribe({
      next: (res) => {
        this.rowMiningId = null;
        if (res.success) {
          this.blocks = this.blocks.filter(b => b.id !== block.id);
          const baseMessage = res.message || `Bloque #${block.height} minado.`;
          this.infoMessage = baseMessage;
          this.loadMiningSummary(baseMessage);
        } else {
          this.blocks = this.blocks.filter(b => b.id !== block.id);
          this.error = res.message || `Imposible minar el bloque #${block.height}.`;
          this.loadMiningSummary();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.rowMiningId = null;
        if (err?.status === 401) {
          this.error = 'Debes iniciar sesión para minar bloques.';
        } else {
          this.error = 'No se pudo simular el minado.';
        }
      }
    });
  }

  private loadMiningSummary(message?: string): void {
    this.summarySub?.unsubscribe();
    this.summarySub = this.service.miningSummary().subscribe({
      next: (summary: MiningSummary) => {
        this.totalMinedBtc = this.parseBtc(summary.total_btc);
        this.minedAttempts = summary.total_attempts ?? 0;
        if (message) {
          this.infoMessage = `${message} · Total acumulado: ${this.totalMinedBtc.toFixed(2)} BTC`;
        }
      },
      error: () => {
        if (message) {
          this.infoMessage = message;
        }
      }
    });
  }

  private parseBtc(value: unknown): number {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num)) {
      return 0;
    }
    return Math.round(num * 1e2) / 1e2;
  }

  private buildMockBlocks(count: number): Block[] {
    const now = Date.now();
    let previousHash = cryptoRandomHex(64);
    const blocks: Block[] = [];
    for (let i = 0; i < count; i += 1) {
      const height = count - i;
      const currentHash = cryptoRandomHex(64);
      blocks.push({
        id: -(i + 1),
        height,
        prev_hash: previousHash,
        merkle_root: cryptoRandomHex(64),
        nonce: cryptoRandomHex(16),
        mined_at: new Date(now - i * 60000).toISOString(),
        current_hash: currentHash
      });
      previousHash = currentHash;
    }
    return blocks;
  }

  private mineMockBlock(block: Block): void {
    this.error = null;
    this.infoMessage = null;
    this.rowMiningId = block.id;
    this.mining = true;
    const remainingMocks = this.blocks.filter(b => b.id < 0 && b.id !== block.id);
    this.blocks = [...remainingMocks, ...this.blocks.filter(b => b.id >= 0)];
    this.service.create({ merkle_root: block.merkle_root, nonce: block.nonce }).subscribe({
      next: (created) => {
        this.mining = false;
        this.rowMiningId = null;
        const message = `Bloque demo #${block.height} minado.`;
        if (remainingMocks.length) {
          try { localStorage.setItem('mockBlockCount', String(remainingMocks.length)); } catch {}
        } else {
          this.clearMockBlockCount();
        }
        this.service.list().subscribe({
          next: (realBlocks) => {
            const sortedReal = [...realBlocks].sort((a, b) => b.height - a.height);
            this.blocks = [...sortedReal, ...remainingMocks];
          },
          error: () => {
            this.blocks = [...remainingMocks];
          }
        });
        this.loadMiningSummary(message);
      },
      error: (err: HttpErrorResponse) => {
        this.mining = false;
        this.rowMiningId = null;
        if (err?.status === 401) {
          this.error = 'Debes iniciar sesión para minar bloques.';
        } else if (err?.status === 400) {
          this.error = 'Datos inválidos al minar el bloque demo.';
        } else {
          this.error = 'No se pudo minar el bloque demo.';
        }
        if (!this.blocks.some(b => b.id === block.id)) {
          this.blocks = [...this.blocks, block];
        }
      }
    });
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
    const variants = [2, 3, 4, 5];
    const count = variants[Math.floor(Math.random() * variants.length)];
    try { localStorage.setItem('mockBlockCount', String(count)); } catch {}
    return count;
  }

  private clearMockBlockCount(): void {
    if (typeof localStorage === 'undefined') { return; }
    try { localStorage.removeItem('mockBlockCount'); } catch {}
  }

  randomFill(): void {
    if (!this.nonce) {
      this.nonce = cryptoRandomHex(16);
    }
    if (!this.merkle) {
      this.merkle = cryptoRandomHex(64);
    }
    this.currentHash = '';
  }

  handleNonceChange(value: string): void {
    this.nonce = value;
    this.currentHash = '';
  }

  updateNonceDetails(): void {
    if (!this.nonce) {
      this.currentHash = '';
      return;
    }
    const trimmed = this.nonce.trim().toLowerCase();
    const match = this.blocks.find(b => (b.nonce || '').toLowerCase() === trimmed);
    if (match) {
      this.currentHash = match.current_hash;
      this.merkle = match.merkle_root;
    } else {
      this.currentHash = '';
    }
  }

  applyAutofill(): void {
    this.updateNonceDetails();
  }
}

function cryptoRandomHex(len: number): string {
  const bytes = new Uint8Array(len / 2);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
