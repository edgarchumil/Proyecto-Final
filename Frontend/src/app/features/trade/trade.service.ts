import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Transaction } from '../txs/transactions.service';

export type TradeMethod = 'BANK' | 'P2P';
export interface TradePayload { wallet: number; amount: number; fee?: number; currency?: 'SIM'|'USD'|'BTC'; method?: TradeMethod; reference?: string; password?: string; }

@Injectable({ providedIn: 'root' })
export class TradeService {
  private base = `${environment.apiUrl}/tx/`;
  constructor(private http: HttpClient) {}

  buy(p: TradePayload): Observable<Transaction> { return this.http.post<Transaction>(`${this.base}buy/`, p); }
  sell(p: TradePayload): Observable<Transaction> { return this.http.post<Transaction>(`${this.base}sell/`, p); }
}
