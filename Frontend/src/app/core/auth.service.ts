import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

interface TokenPair {
  access: string;
  refresh: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private authStatus = new BehaviorSubject<boolean>(this.hasAccess());
  authStatus$ = this.authStatus.asObservable();

  constructor(private http: HttpClient) {}

  private hasAccess(): boolean {
    return !!localStorage.getItem('access');
  }

  isAuthenticated(): boolean {
    return this.hasAccess();
  }

  login(username: string, password: string): Observable<TokenPair> {
    return this.http.post<TokenPair>(`${environment.apiUrl}/auth/token/`, { username, password }).pipe(
      tap(tokens => {
        localStorage.setItem('access', tokens.access);
        localStorage.setItem('refresh', tokens.refresh);
        this.authStatus.next(true);
      })
    );
  }

  register(username: string, email: string | null, password: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/users/register/`, { username, email, password });
  }

  me(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/users/me/`);
  }

  refreshToken(): Observable<{ access: string }> {
    const refresh = localStorage.getItem('refresh');
    return this.http.post<{ access: string }>(`${environment.apiUrl}/auth/token/refresh/`, { refresh }).pipe(
      tap(r => {
        if (r?.access) localStorage.setItem('access', r.access);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    this.authStatus.next(false);
  }
}
