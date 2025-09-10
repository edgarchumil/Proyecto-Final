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
  email = '';
  password = '';
  msg = '';
  loading = false;
  constructor(private auth: AuthService, private router: Router) {}
  submit(): void {
    if (!this.username) { this.msg = 'El usuario es obligatorio.'; return; }
    if (!this.password || this.password.length < 6) { this.msg = 'La contraseña debe tener al menos 6 caracteres.'; return; }
    this.loading = true; this.msg = 'Creando cuenta...';
    this.auth.register(this.username, this.email || null, this.password).subscribe({
      next: (data:any) => { this.msg = `Usuario creado: ${data?.username || this.username}. Ahora inicia sesión.`; setTimeout(() => this.router.navigate(['/auth/login']), 600); },
      error: (e) => { this.loading = false; this.msg = 'Error al registrar: ' + ((e?.error && typeof e.error==='object') ? JSON.stringify(e.error) : 'Intenta de nuevo.'); }
    });
  }
}
