import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Transaction } from '../txs/transactions.service';

export interface TradeRequest {
  id: number;
  token: string;
  side: 'BUY'|'SELL';
  amount: string;
  fee: string;
  currency: 'SIM'|'USD'|'BTC';
  status: 'PENDING'|'APPROVED'|'REJECTED'|'CANCELLED';
  created_at: string;
  requester: number;
  requester_username: string;
  counterparty: number;
  counterparty_username: string;
}

export interface CreateTradeRequestPayload {
  counterparty: number;
  side: 'BUY'|'SELL';
  amount: number;
  fee?: number;
  currency?: 'SIM'|'USD'|'BTC';
  password: string;
  [extra: string]: any;
}
export interface WalletBalancePatch { wallet_id: number; user_id: number; balances: Record<string, string>; }
export interface TradeApproveResponse { request: TradeRequest; tx: Transaction; wallets?: { requester: WalletBalancePatch; counterparty: WalletBalancePatch; }; }

@Injectable({ providedIn: 'root' })
export class TradeRequestsService {
  private base = `${environment.apiUrl}/tx-requests/`;
  constructor(private http: HttpClient) {}

  list(scope: 'incoming'|'outgoing'|'all' = 'incoming', status?: string): Observable<TradeRequest[]> {
    let params = new HttpParams().set('scope', scope);
    if (status) params = params.set('status', status);
    return this.http.get<TradeRequest[]>(this.base, { params });
  }
  create(p: CreateTradeRequestPayload): Observable<TradeRequest> { return this.http.post<TradeRequest>(this.base, p); }
  approve(id: number, password: string): Observable<TradeApproveResponse> {
    return this.http.post<TradeApproveResponse>(`${this.base}${id}/approve/`, { password });
  }
  reject(id: number): Observable<TradeRequest> { return this.http.post<TradeRequest>(`${this.base}${id}/reject/`, {}); }
}
