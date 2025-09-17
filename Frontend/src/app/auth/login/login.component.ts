import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth.service';

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
  constructor(private auth: AuthService, private router: Router) {}
  submit(): void {
    if (!this.username || !this.password) { this.error = 'Completa usuario y contraseña.'; return; }
    this.loading = true; this.error = '';

  this.auth.login(this.username, this.password).subscribe({
    next: () => this.router.navigate(['/dashboard']),
    error: (e: any) => {
      this.loading = false;
      this.error = (e?.error && typeof e.error === 'object') ? JSON.stringify(e.error) : 'Login fallido';
    }
  });
  }
}
