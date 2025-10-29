import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, NgFor, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { BlocksService, Block } from './blocks.service';

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

  merkle = '';
  nonce = '';
  currentHash = '';
  mining = false;

  constructor(private service: BlocksService) {}

  ngOnInit(): void {
    this.refresh();
  }

  ngOnDestroy(): void {
  }

  refresh(): void {
    this.loading = true;
    this.error = null;
    this.service.list().subscribe({
      next: (blocks) => {
        this.blocks = blocks.sort((a, b) => b.height - a.height);
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
    this.mining = true;
    this.service.create({ merkle_root: this.merkle.trim(), nonce: this.nonce.trim() }).subscribe({
      next: () => {
        this.merkle = '';
        this.nonce = '';
        this.currentHash = '';
        this.mining = false;
        this.refresh();
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
