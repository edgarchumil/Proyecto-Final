import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  me: any = null;
  loading = true;
  error = '';

  constructor(private auth: AuthService) {}

  ngOnInit(): void {
    this.auth.me().subscribe({
      next: (data) => {
        this.me = data;
        this.loading = false;
      },
      error: (e) => {
        this.error = (e?.error && typeof e.error === 'object') ? JSON.stringify(e.error) : 'No se pudo cargar el perfil.';
        this.loading = false;
      }
    });
  }
}
