import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuditLog {
  id: number;
  actor: number | null;
  actor_username: string | null;
  action: string;
  payload_json: Record<string, unknown>;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private base = `${environment.apiUrl}/audit-logs/`;

  constructor(private http: HttpClient) {}

  list(): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(this.base);
  }
}
