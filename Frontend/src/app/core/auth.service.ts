import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

interface TokenPair { access: string; refresh: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private authStatus = new BehaviorSubject<boolean>(!!localStorage.getItem('access'));
  authStatus$ = this.authStatus.asObservable();

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<TokenPair> {
    return this.http.post<TokenPair>(`${environment.apiUrl}/auth/token/`, { username, password }).pipe(
      tap(t => {
        localStorage.setItem('access', t.access);
        localStorage.setItem('refresh', t.refresh);
        this.authStatus.next(true);
      })
    );
  }

  register(username: string, email: string | null, password: string) {
    return this.http.post(`${environment.apiUrl}/users/register/`, { username, email, password });
  }

  me() { return this.http.get(`${environment.apiUrl}/users/me/`); }

  refreshToken() {
    const refresh = localStorage.getItem('refresh');
    return this.http.post<{ access: string }>(`${environment.apiUrl}/auth/token/refresh/`, { refresh }).pipe(
      tap(r => { if (r?.access) localStorage.setItem('access', r.access); })
    );
  }

  logout() {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    this.authStatus.next(false);
  }

  isAuthenticated() { return !!localStorage.getItem('access'); }
}
