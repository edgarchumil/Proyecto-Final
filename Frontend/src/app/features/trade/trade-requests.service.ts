import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TradeRequest {
  id: number;
  token: string;
  side: 'BUY'|'SELL';
  amount: string;
  fee: string;
  status: 'PENDING'|'APPROVED'|'REJECTED'|'CANCELLED';
  created_at: string;
  requester: number;
  requester_username: string;
  counterparty: number;
  counterparty_username: string;
}

export interface CreateTradeRequestPayload { counterparty: number; side: 'BUY'|'SELL'; amount: number; fee?: number; }

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
  approve(id: number): Observable<{request: TradeRequest; tx: any}> { return this.http.post<{request: TradeRequest; tx: any}>(`${this.base}${id}/approve/`, {}); }
  reject(id: number): Observable<TradeRequest> { return this.http.post<TradeRequest>(`${this.base}${id}/reject/`, {}); }
}

