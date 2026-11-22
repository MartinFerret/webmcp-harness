import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Api } from './api';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  template: `
    <header>
      <a class="brand" routerLink="/">SlotBook</a>
      <nav>
        @if (api.token()) {
          <span>Signed in</span>
          <button type="button" (click)="api.logout()">Log out</button>
        } @else {
          <span>Not signed in</span>
          <a routerLink="/login">Log in</a>
        }
      </nav>
    </header>

    <main>
      <router-outlet />
    </main>

    @if (api.toast(); as message) {
      <div class="toast" role="status">
        {{ message }}
        <button type="button" aria-label="Dismiss" (click)="api.toast.set(null)">×</button>
      </div>
    }
  `,
  styles: `
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 32px;
      background: #fff;
    }
    .brand { font-size: 22px; font-weight: 700; color: var(--text); text-decoration: none; }
    nav { display: flex; align-items: center; gap: 16px; color: var(--muted); }
    main { max-width: 960px; margin: 32px auto; padding: 0 24px; }
    .toast {
      position: fixed;
      right: 24px;
      bottom: 24px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 14px 14px 20px;
      border-radius: 10px;
      background: var(--text);
      color: #fff;
      font-weight: 600;
    }
    .toast button { padding: 2px 10px; background: transparent; color: #fff; border-color: #555; }
  `,
})
export class App {
  protected readonly api = inject(Api);
}
