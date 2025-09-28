import { Component, OnInit } from '@angular/core';
import { CommonModule, NgFor, DatePipe, JsonPipe } from '@angular/common';
import { AuditService, AuditLog } from './audit.service';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, NgFor, DatePipe, JsonPipe],
  templateUrl: './audit.component.html',
  styleUrls: ['./audit.component.css']
})
export class AuditComponent implements OnInit {
  logs: AuditLog[] = [];
  loading = false;
  error: string | null = null;

  constructor(private audit: AuditService) {}

  ngOnInit(): void {
    this.loading = true;
    this.error = null;
    this.audit.list().subscribe({
      next: data => { this.logs = data; this.loading = false; },
      error: () => { this.error = 'No se pudo cargar el audit log.'; this.loading = false; }
    });
  }
}
