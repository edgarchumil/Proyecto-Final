import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PriceService, PriceTick } from './price.service';
import {
  Chart, LineController, LineElement, PointElement,
  LinearScale, Tooltip, Legend,
  CategoryScale
} from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);

@Component({
  selector: 'app-price',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './price.component.html',
  styleUrls: ['./price.component.css']
})
export class PriceComponent implements AfterViewInit, OnDestroy {
  ticks: PriceTick[] = [];
  loading = false;
  error: string | null = null;
  chart?: Chart;
  private timer?: any;

  form = {
    price_usd: 1,
    ts: new Date().toISOString().slice(0, 16),
  };
  showAll = false;

  get visibleTicks(): PriceTick[] {
    return this.showAll ? this.ticks : this.ticks.slice(0, 10);
  }

  constructor(private price: PriceService) {}

  ngAfterViewInit(): void {
    this.fetch();
    // Simulación automática permanente
    this.timer = setInterval(() => this.simulateOnce(), 8000);
    // Ejecuta una de inmediato para arrancar la serie
    this.simulateOnce();
  }

  private clearTimer(): void { if (this.timer) { clearInterval(this.timer); this.timer = undefined; } }
  ngOnDestroy(): void { this.clearTimer(); this.chart?.destroy(); }

  fetch(): void {
    this.loading = true;
    this.error = null;
    this.price.list().subscribe({
      next: data => {
        this.ticks = data;
        this.loading = false;
        this.renderChart();
      },
      error: () => {
        this.error = 'No se pudo cargar el histórico de precios.';
        this.loading = false;
      }
    });
  }

  addTick(): void {
    const normalized = this.round2(Number(this.form.price_usd));
    if (!Number.isFinite(normalized) || normalized <= 0) {
      this.error = 'Ingresa un precio válido.';
      return;
    }
    this.error = null;
    const payload = {
      ts: new Date(this.form.ts).toISOString(),
      price_usd: normalized,
    };
    this.price.create(payload).subscribe({
      next: tick => {
        this.ticks = [tick, ...this.ticks];
        this.renderChart();
        this.form.ts = new Date().toISOString().slice(0, 16);
        this.form.price_usd = normalized;
      },
      error: () => this.error = 'No se pudo registrar el precio.'
    });
  }

  private simulateOnce(): void {
    const last = this.ticks[0] ? Number(this.ticks[0].price_usd) : 20;
    // random walk: variación entre -3% y +3%
    const pct = (Math.random() - 0.5) * 0.06;
    const next = Math.max(0.1, this.round2(last * (1 + pct)));
    const ts = new Date().toISOString();
    this.price.create({ ts, price_usd: next }).subscribe({
      next: tick => { this.ticks = [tick, ...this.ticks].slice(0, 100); this.renderChart(); },
      error: () => { /* silencioso: puede fallar si no hay auth */ }
    });
  }

  private renderChart(): void {
    const canvas = document.getElementById('priceChart') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sorted = [...this.ticks].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    const labels = sorted.map(t => new Date(t.ts).toLocaleString());
    const data = sorted.map(t => this.round2(Number(t.price_usd)));

    this.chart?.destroy();
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'SIM / USD',
          data,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56,189,248,0.2)',
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true },
          tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y?.toFixed(2)} USD` } }
        },
        scales: {
          y: { beginAtZero: false }
        }
      }
    });
  }

  private round2(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
