import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.css']
})
export class TopbarComponent implements OnInit, OnDestroy {
  isLoggedIn = false;
  open = false;
  sub?: Subscription;

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.isLoggedIn = this.auth.isAuthenticated();
    this.sub = this.auth.authStatus$.subscribe((v: boolean) => this.isLoggedIn = v);
    this.router.events.subscribe(() => this.open = false);
  }

  toggle() { this.open = !this.open; }
  close() { this.open = false; }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/auth/login']);
    this.open = false;
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }
}
