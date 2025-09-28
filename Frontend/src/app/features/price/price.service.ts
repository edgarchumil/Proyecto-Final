import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PriceTick {
  id: number;
  ts: string;
  price_usd: string;
}

@Injectable({ providedIn: 'root' })
export class PriceService {
  private base = `${environment.apiUrl}/prices/`;

  constructor(private http: HttpClient) {}

  list(): Observable<PriceTick[]> {
    return this.http.get<PriceTick[]>(this.base);
  }

  latest(): Observable<PriceTick> {
    return this.http.get<PriceTick>(`${this.base}latest/`);
  }

  create(payload: { ts: string; price_usd: number }): Observable<PriceTick> {
    return this.http.post<PriceTick>(this.base, payload);
  }
}
