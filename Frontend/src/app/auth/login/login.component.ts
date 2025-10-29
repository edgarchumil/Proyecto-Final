import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { PreloaderService } from '../../core/preloader.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  username = '';
  password = '';
  loading = false;
  error = '';
  private nextRoute = '/dashboard';
  private welcome = false;
  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private preloader: PreloaderService
  ) {
    this.route.queryParams.subscribe(q => {
      const next = (q['next'] as string) || '/dashboard';
      // sanitiza: solo rutas internas conocidas
      this.nextRoute = next.startsWith('/') ? next : `/${next}`;
      this.welcome = (q['welcome'] === '1' || q['welcome'] === 1) ? true : false;
    });
  }
  submit(): void {
    if (!this.username || !this.password) { this.error = 'Completa usuario y contraseña.'; return; }
    this.loading = true; this.error = '';

    this.auth.login(this.username, this.password).subscribe({
      next: () => {
        this.preloader.show(5000);
        setTimeout(() => {
          if (this.nextRoute === '/dashboard' && this.welcome) {
            this.router.navigate(['/dashboard'], { queryParams: { welcome: 1 } });
          } else {
            this.router.navigate([this.nextRoute]);
          }
          this.loading = false;
        }, 5000);
      },
      error: (e: any) => {
        this.loading = false;
        this.error = (e?.error && typeof e.error === 'object') ? JSON.stringify(e.error) : 'Login fallido';
      }
    });
  }
}
