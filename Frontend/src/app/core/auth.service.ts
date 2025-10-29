import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

interface TokenPair { access: string; refresh: string; }
interface MeResponse { id: number; username: string; email?: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private authStatus = new BehaviorSubject<boolean>(!!localStorage.getItem('access'));
  /** Observable de estado de sesión */
  authStatus$ = this.authStatus.asObservable();

  constructor(private http: HttpClient) {}

  // ---------- Sesión ----------
  isAuthenticated(): boolean { return !!localStorage.getItem('access'); }

  private currentTabId(): string | null {
    return sessionStorage.getItem('tabId');
  }

  private setActiveOwner(): void {
    const tabId = this.currentTabId();
    if (tabId) {
      localStorage.setItem('activeTabId', tabId);
    }
  }

  private clearActiveOwner(): void {
    const tabId = this.currentTabId();
    if (!tabId) {
      localStorage.removeItem('activeTabId');
      return;
    }
    if (localStorage.getItem('activeTabId') === tabId) {
      localStorage.removeItem('activeTabId');
    }
  }

  private clearTokens(): void {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    this.clearActiveOwner();
    this.authStatus.next(false);
  }

  /** Forzar login fresco al abrir la app (si así lo quieres) */
  forceFreshLogin(): void { this.clearTokens(); }

  /** Logout silencioso (para beforeunload/pagehide) */
  silentLogout(): void { this.clearTokens(); }

  logout(): void { this.clearTokens(); }

  // ---------- Endpoints ----------
  login(username: string, password: string): Observable<TokenPair> {
    return this.http
      .post<TokenPair>(`${environment.apiUrl}/auth/token/`, { username, password })
      .pipe(
        tap(t => {
          localStorage.setItem('access', t.access);
          localStorage.setItem('refresh', t.refresh);
          this.setActiveOwner();
          this.authStatus.next(true);
        })
      );
  }

  register(username: string, email: string | null, password: string): Observable<MeResponse> {
    return this.http.post<MeResponse>(`${environment.apiUrl}/users/register/`, { username, email, password });
  }

  me(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${environment.apiUrl}/users/me/`);
  }

  refreshToken(): Observable<{ access: string }> {
    const refresh = localStorage.getItem('refresh');
    return this.http
      .post<{ access: string }>(`${environment.apiUrl}/auth/token/refresh/`, { refresh })
      .pipe(tap(r => {
        if (r?.access) {
          localStorage.setItem('access', r.access);
          if (!localStorage.getItem('activeTabId')) {
            this.setActiveOwner();
          }
        }
      }));
  }
}
