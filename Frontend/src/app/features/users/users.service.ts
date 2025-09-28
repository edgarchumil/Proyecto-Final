import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AppUser { id: number; username: string; email?: string; }

@Injectable({ providedIn: 'root' })
export class UsersService {
  private base = `${environment.apiUrl}/users/`;
  constructor(private http: HttpClient) {}
  list(): Observable<AppUser[]> { return this.http.get<AppUser[]>(this.base); }
}

