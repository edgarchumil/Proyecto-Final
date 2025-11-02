import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Wallet {
  id: number;
  name: string;
  pub_key: string;
  created_at: string;
  balance?: string;
  balance_sim?: string;
  balance_usd?: string;
  balance_btc?: string;
}

@Injectable({ providedIn: 'root' })
export class WalletService {
  private base = `${environment.apiUrl}/wallets/`;
  private walletsSubject = new BehaviorSubject<Wallet[] | null>(null);
  readonly wallets$ = this.walletsSubject.asObservable();

  constructor(private http: HttpClient) {}

  list(): Observable<Wallet[]> {
    return this.http.get<Wallet[]>(this.base).pipe(
      tap(list => this.walletsSubject.next(list))
    );
  }

  create(name: string): Observable<Wallet> {
    return this.http.post<Wallet>(this.base, { name });
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}${id}/`);
  }

  applyBalancePatch(walletId: number, balances: Record<string, string>): void {
    const current = this.walletsSubject.value;
    if (!current || !current.length) {
      return;
    }
    const next = current.map(wallet => {
      if (wallet.id !== walletId) {
        return wallet;
      }
      return {
        ...wallet,
        balance: balances['SIM'] ?? wallet.balance,
        balance_sim: balances['SIM'] ?? wallet.balance_sim,
        balance_usd: balances['USD'] ?? wallet.balance_usd,
        balance_btc: balances['BTC'] ?? wallet.balance_btc,
      };
    });
    this.walletsSubject.next(next);
  }
}
