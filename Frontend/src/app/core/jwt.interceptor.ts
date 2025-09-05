import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const jwtInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const access = localStorage.getItem('access');
  const authReq = access ? req.clone({ setHeaders: { Authorization: `Bearer ${access}` } }) : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && localStorage.getItem('refresh')) {
        return auth.refreshToken().pipe(
          switchMap(() => {
            const newAccess = localStorage.getItem('access');
            const retryReq = newAccess ? authReq.clone({ setHeaders: { Authorization: `Bearer ${newAccess}` } }) : authReq;
            return next(retryReq);
          }),
          catchError(inner => {
            auth.logout();
            router.navigate(['/auth/login']);
            return throwError(() => inner);
          })
        );
      }
      return throwError(() => err);
    })
  );
};
