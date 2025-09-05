import { Routes } from '@angular/router';
import { HomeComponent } from './dashboard/home/home.component';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { AuthGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'auth/login', component: LoginComponent },
  { path: 'auth/register', component: RegisterComponent },
  { path: 'dashboard', component: HomeComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: 'dashboard' }
];
