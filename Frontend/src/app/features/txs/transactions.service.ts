import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Transaction {
  id: number;
  from_wallet: number;
  from_wallet_name: string;
  from_user?: number;
  from_username?: string;
  to_wallet: number;
  to_wallet_name: string;
  to_user?: number;
  to_username?: string;
  amount: string;
  fee: string;
  currency: 'SIM' | 'USD' | 'BTC';
  tx_hash: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  block: number | null;
  created_at: string;
}

export interface CreateTransactionPayload {
  from_wallet: number;
  to_wallet?: number;      // opcional si se envía a usuario
  to_user?: number;        // id de usuario destino
  amount: number;
  fee: number;
  currency?: 'SIM' | 'USD' | 'BTC';
}

@Injectable({ providedIn: 'root' })
export class TransactionsService {
  private base = `${environment.apiUrl}/tx/`;

  constructor(private http: HttpClient) {}

  list(filters?: { status?: string; wallet?: number }): Observable<Transaction[]> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.wallet) params = params.set('wallet', filters.wallet);
    return this.http.get<Transaction[]>(this.base, { params });
  }

  create(payload: CreateTransactionPayload): Observable<Transaction> {
    return this.http.post<Transaction>(this.base, payload);
  }

  confirm(id: number, block?: number | null): Observable<Transaction> {
    const body = block ? { block } : {};
    return this.http.post<Transaction>(`${this.base}${id}/confirm/`, body);
  }

  fail(id: number): Observable<Transaction> {
    return this.http.post<Transaction>(`${this.base}${id}/fail/`, {});
  }
}
