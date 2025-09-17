import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { TopbarComponent } from './layout/topbar/topbar.component';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TopbarComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  private onBeforeUnload = (e: BeforeUnloadEvent) => {
    // cierra sesión al cerrar/recargar la pestaña/ventana
    this.auth.silentLogout();
  };

  private onPageHide = () => {
    // iOS/Safari/Firefox disparan pagehide al cerrar
    this.auth.silentLogout();
  };

  private onStorage = (e: StorageEvent) => {
    // si otra pestaña borra tokens, reflejar aquí
    if (e.storageArea === localStorage && (e.key === 'access' || e.key === 'refresh')) {
      if (!localStorage.getItem('access')) {
        this.auth.silentLogout();
        this.router.navigate(['/auth/login']);
      }
    }
  };

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    // 1) al entrar al sitio, siempre limpiar y exigir login
    this.auth.forceFreshLogin();
    this.router.navigate(['/auth/login']);

    // 2) listeners para cerrar sesión al cerrar/recargar
    window.addEventListener('beforeunload', this.onBeforeUnload);
    window.addEventListener('pagehide', this.onPageHide);

    // 3) sincronizar entre pestañas
    window.addEventListener('storage', this.onStorage);
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('storage', this.onStorage);
  }
}
