import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from './api';

@Component({
  selector: 'app-login',
  template: `
    <form class="card" (submit)="submit($event, email.value, password.value)">
      <h1>Log in</h1>
      <p class="hint">Demo account: demo&#64;slotbook.test / demo</p>

      <label for="email">Email</label>
      <input #email id="email" name="email" type="email" autocomplete="username" />

      <label for="password">Password</label>
      <input #password id="password" name="password" type="password" autocomplete="current-password" />

      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <button class="primary" type="submit">Log in</button>
    </form>
  `,
  styles: `
    form { max-width: 420px; margin: 0 auto; }
    .hint { color: var(--muted); }
    .error { color: var(--accent); font-weight: 600; }
  `,
})
export class Login {
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  protected readonly error = signal('');

  protected async submit(event: Event, email: string, password: string): Promise<void> {
    event.preventDefault();
    if (await this.api.login(email, password)) {
      await this.router.navigateByUrl('/');
    } else {
      this.error.set('Wrong email or password');
    }
  }
}
