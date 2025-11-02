import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  username = '';
  password = '';
  confirmPassword = '';
  msg = '';
  loading = false;
  constructor(private auth: AuthService, private router: Router) {}
  submit(): void {
    if (!this.username) { this.msg = 'El usuario es obligatorio.'; return; }
    if (!this.isStrongPassword(this.password)) { return; }
    if (this.password !== this.confirmPassword) { this.msg = 'Las contraseñas no coinciden.'; return; }
    this.loading = true; this.msg = 'Creando cuenta...';
    this.auth.register(this.username, '', this.password).subscribe({
      next: (data: any) => {
        this.msg = `¡Bienvenido ${data?.username || this.username}! Se creó tu wallet por defecto y acreditamos 5 SIM.`;
        this.password = '';
        this.confirmPassword = '';
        // Flag para mostrar aviso post-login
        try { localStorage.setItem('welcomeCredit', '1'); } catch {}
        // Enviar al login con redirect a dashboard y marca de bienvenida
        setTimeout(() => this.router.navigate(['/auth/login'], { queryParams: { next: 'dashboard', welcome: 1 } }), 600);
      },
      error: (e: any) => {
        this.loading = false;
        this.msg = 'Error al registrar: ' + ((e?.error && typeof e.error === 'object') ? JSON.stringify(e.error) : 'Intenta de nuevo.');
      }
    });
  }

  private isStrongPassword(value: string): boolean {
    if (!value) {
      this.msg = 'La contraseña es obligatoria.';
      return false;
    }
    const hasMinLength = value.length >= 8;
    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasNumber = /\d/.test(value);
    const hasSymbol = /[^\w\s]/.test(value);
    if (!(hasMinLength && hasUpper && hasLower && hasNumber && hasSymbol)) {
      this.msg = 'La contraseña debe tener al menos 8 caracteres e incluir mayúsculas, minúsculas, números y símbolos.';
      return false;
    }
    return true;
  }
}
