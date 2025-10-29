import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PreloaderService {
  private visibleState = new BehaviorSubject<boolean>(false);
  private timer?: ReturnType<typeof setTimeout>;

  get visible$(): Observable<boolean> {
    return this.visibleState.asObservable();
  }

  show(durationMs = 0): void {
    this.clearTimer();
    this.visibleState.next(true);
    if (durationMs > 0) {
      this.timer = setTimeout(() => this.hide(), durationMs);
    }
  }

  hide(): void {
    this.clearTimer();
    this.visibleState.next(false);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}
