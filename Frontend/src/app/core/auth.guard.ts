import { Injectable } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthGuard {
  constructor(private router: Router) {}
  canActivate: CanActivateFn = () => {
    const ok = !!localStorage.getItem('access');
    if (!ok) { this.router.navigate(['/auth/login']); return false; }
    return true;
  };
}
