import { Component, OnInit } from '@angular/core';
import { CommonModule, NgFor, DatePipe } from '@angular/common';
import { AuditService, AuditLog } from './audit.service';

type DetailRow = { label: string; value: string };

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, NgFor, DatePipe],
  templateUrl: './audit.component.html',
  styleUrls: ['./audit.component.css']
})
export class AuditComponent implements OnInit {
  logs: AuditLog[] = [];
  loading = false;
  error: string | null = null;
  private readonly actionDescriptions: Record<string, string> = {
    TX_SEND: 'Envió una transacción',
    TX_CONFIRM: 'Confirmó una transacción',
    TX_FAIL: 'Marcó una transacción como fallida',
    TRADE_BUY: 'Ejecución de compra directa',
    TRADE_SELL: 'Ejecución de venta directa',
    TRADE_REQUEST: 'Creó una solicitud P2P',
    TRADE_REQUEST_APPROVE: 'Aprobó una solicitud P2P',
    TRADE_REQUEST_REJECT: 'Rechazó una solicitud P2P',
    PRICE_SIM: 'Registró un precio de mercado',
    WALLET_CREATE: 'Creó una wallet'
  };

  constructor(private audit: AuditService) {}

  ngOnInit(): void {
    this.loading = true;
    this.error = null;
    this.audit.list().subscribe({
      next: data => { this.logs = data; this.loading = false; },
      error: () => { this.error = 'No se pudo cargar el audit log.'; this.loading = false; }
    });
  }

  readableAction(log: AuditLog): string {
    return this.actionDescriptions[log.action] ?? log.action.replace(/_/g, ' ').toLowerCase();
  }

  describe(log: AuditLog): DetailRow[] {
    const payload = log.payload_json || {};
    if (!payload || Object.keys(payload).length === 0) {
      return [{ label: 'Detalle', value: 'Sin datos adicionales' }];
    }

    if ('tx_id' in payload && 'request_id' in payload) {
      return [
        { label: 'Solicitud', value: `#${payload['request_id']}` },
        { label: 'Transacción', value: `#${payload['tx_id']}` }
      ];
    }

    if ('block' in payload && 'tx_id' in payload) {
      return [
        { label: 'Transacción', value: `#${payload['tx_id']}` },
        { label: 'Bloque', value: payload['block'] ? `#${payload['block']}` : 'Nuevo bloque generado' }
      ];
    }

    if ('amount' in payload) {
      const amount = Number(payload['amount']);
      const formatted = Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(payload['amount']);
      const currency = payload['currency'] ?? 'SIM';
      return [
        { label: 'Orden', value: `#${payload['id'] ?? '—'}` },
        { label: 'Token', value: String(payload['token'] ?? '—') },
        { label: 'Monto', value: `${formatted} ${currency}` },
        { label: 'Contraparte', value: payload['to'] ? `Usuario #${payload['to']}` : '—' },
        { label: 'Lado', value: String(payload['side'] ?? '—') }
      ];
    }

    if ('price_usd' in payload && 'price_btc' in payload) {
      return [
        { label: 'Precio USD', value: String(payload['price_usd']) },
        { label: 'Precio BTC', value: payload['price_btc'] ? String(payload['price_btc']) : '—' },
        { label: 'Volumen SIM', value: payload['vol'] ? String(payload['vol']) : '—' },
        { label: 'Nota', value: String(payload['note'] ?? '—') }
      ];
    }

    if (log.action === 'WALLET_CREATE') {
      return [
        { label: 'Wallet', value: payload['name'] ? String(payload['name']) : `ID #${payload['wallet_id'] ?? '—'}` },
        { label: 'ID', value: `#${payload['wallet_id'] ?? '—'}` }
      ];
    }

    if (log.action === 'TRADE_BUY' || log.action === 'TRADE_SELL') {
      const amount = Number(payload['amount']);
      const formatted = Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(payload['amount']);
      return [
        { label: 'Transacción', value: `#${payload['tx_id'] ?? '—'}` },
        { label: 'Moneda', value: String(payload['currency'] ?? 'SIM') },
        { label: 'Monto', value: formatted },
        { label: 'Origen', value: String(payload['wallet'] ?? '—') }
      ];
    }

    if (log.action === 'TX_CONFIRM' || log.action === 'TX_FAIL' || log.action === 'TX_SEND') {
      const rows: DetailRow[] = [
        { label: 'Transacción', value: `#${payload['tx_id'] ?? '—'}` }
      ];
      if ('block' in payload) {
        rows.push({ label: 'Bloque', value: payload['block'] ? `#${payload['block']}` : 'Nuevo bloque' });
      }
      return rows;
    }

    return Object.entries(payload).map(([key, value]) => ({ label: key, value: String(value) }));
  }
}
