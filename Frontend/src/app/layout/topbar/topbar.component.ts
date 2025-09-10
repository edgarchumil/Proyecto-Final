import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.css']
})
export class TopbarComponent implements OnInit, OnDestroy {
  isLoggedIn = false;
  sub?: Subscription;
  constructor(private auth: AuthService, private router: Router) {}
  ngOnInit(): void {
    this.isLoggedIn = this.auth.isAuthenticated();
    this.sub = this.auth.authStatus$.subscribe(v => this.isLoggedIn = v);
  }
  logout(): void { this.auth.logout(); this.router.navigate(['/auth/login']); }
  ngOnDestroy(): void { this.sub?.unsubscribe(); }
}
