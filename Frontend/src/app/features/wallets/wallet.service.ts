import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Wallet {
  id: number;
  name: string;
  pub_key: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class WalletService {
  private base = `${environment.apiUrl}/wallets/`;

  constructor(private http: HttpClient) {}

  list(): Observable<Wallet[]> {
    return this.http.get<Wallet[]>(this.base);
  }

  create(name: string): Observable<Wallet> {
    return this.http.post<Wallet>(this.base, { name });
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}${id}/`);
  }
}

