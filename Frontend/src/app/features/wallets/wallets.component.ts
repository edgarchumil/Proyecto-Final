import { Component } from '@angular/core';
import { CommonModule, NgFor } from '@angular/common';


@Component({
  selector: 'app-wallets',
  standalone: true,
  imports: [CommonModule, NgFor],
  templateUrl: './wallets.component.html',
  styleUrls: ['./wallets.component.css']
})
export class WalletsComponent {}
