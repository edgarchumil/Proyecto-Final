import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Block {
  id: number;
  height: number;
  prev_hash: string;
  merkle_root: string;
  nonce: string;
  mined_at: string;
  current_hash: string;
}

export interface CreateBlockPayload {
  merkle_root: string;
  nonce: string;
}

export interface SimulateMiningResponse {
  success: boolean;
  message: string;
  block_id: number;
  reward_btc?: string;
}

export interface MiningSummary {
  total_btc: string;
  total_attempts: number;
}

@Injectable({ providedIn: 'root' })
export class BlocksService {
  private base = `${environment.apiUrl}/blocks/`;

  constructor(private http: HttpClient) {}

  list(): Observable<Block[]> {
    return this.http.get<Block[]>(this.base);
  }

  create(payload: CreateBlockPayload): Observable<Block> {
    return this.http.post<Block>(this.base, payload);
  }

  simulateMining(blockId: number): Observable<SimulateMiningResponse> {
    return this.http.post<SimulateMiningResponse>(`${this.base}${blockId}/simulate-mining/`, {});
  }

  miningSummary(): Observable<MiningSummary> {
    return this.http.get<MiningSummary>(`${this.base}mining-summary/`);
  }
}
