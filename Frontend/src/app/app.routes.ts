import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { AuthGuard } from './core/auth.guard';
import { WalletsComponent } from './features/wallets/wallets.component';
import { TxsComponent }     from './features/txs/txs.component';
import { BlocksComponent }  from './features/blocks/blocks.component';
import { PriceComponent }   from './features/price/price.component';
import { AuditComponent }   from './features/audit/audit.component';


export const routes: Routes = [
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
  { path: 'auth/login', component: LoginComponent },
  { path: 'auth/register', component: RegisterComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: 'wallets', component: WalletsComponent, canActivate: [AuthGuard] },
  { path: 'txs', component: TxsComponent, canActivate: [AuthGuard] },
  { path: 'blocks', component: BlocksComponent, canActivate: [AuthGuard] },
  { path: 'price', component: PriceComponent, canActivate: [AuthGuard] },
  { path: 'audit', component: AuditComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: 'auth/login' }
];