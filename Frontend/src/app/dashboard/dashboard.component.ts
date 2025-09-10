import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, Filler, Legend } from 'chart.js';
Chart.register(LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, Filler, Legend);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements AfterViewInit, OnDestroy {
  prices: Record<string, number> = { BTC: 50000, ETH: 3000, DOGE: 0.25 };
  saldo = 1000;
  portfolio: Record<string, number> = { BTC: 0, ETH: 0, DOGE: 0 };
  history: Array<{date:string,type:string,coin:string,amount:number,saldo:number}> = [];
  selected = 'BTC';
  amount: number | null = null;
  chart?: Chart;

  ngAfterViewInit(): void { this.renderChart(); }
  ngOnDestroy(): void { this.chart?.destroy(); }

  buy() {
    const c = this.selected;
    const a = Number(this.amount || 0);
    if (!a || a <= 0) { alert('Ingresa una cantidad válida.'); return; }
    const cost = a * this.prices[c];
    if (this.saldo < cost) { alert('Saldo insuficiente.'); return; }
    this.saldo -= cost;
    this.portfolio[c] += a;
    this.addTx('Compra', c, a);
  }

  sell() {
    const c = this.selected;
    const a = Number(this.amount || 0);
    if (!a || a <= 0) { alert('Ingresa una cantidad válida.'); return; }
    if (this.portfolio[c] < a) { alert('No tienes suficientes monedas.'); return; }
    const gain = a * this.prices[c];
    this.saldo += gain;
    this.portfolio[c] -= a;
    this.addTx('Venta', c, a);
  }

  private addTx(type: string, coin: string, amount: number) {
    this.history.push({ date: new Date().toLocaleTimeString(), type, coin, amount, saldo: this.saldo });
    this.renderChart();
  }

  private renderChart() {
    const canvas = document.getElementById('activityChart') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const labels = this.history.map(h => h.date);
    const data = this.history.map(h => h.saldo);
    this.chart?.destroy();
    this.chart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Saldo', data, fill: true, tension: 0.3 }] },
      options: { responsive: true, plugins: { legend: { display: true } } }
    });
  }
}
