import { Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from './api';

@Component({
  selector: 'app-booking',
  imports: [RouterLink],
  template: `
    <form class="card" (submit)="submit($event, name.value)">
      <h1>Book {{ day() }} {{ time() }}</h1>

      <label for="name">Name</label>
      <input #name id="name" name="name" type="text" autocomplete="off" />

      <div class="actions">
        <button class="primary" type="submit">Book</button>
        <a routerLink="/">Cancel</a>
      </div>
    </form>
  `,
  styles: `
    form { max-width: 420px; margin: 0 auto; }
    .actions { display: flex; align-items: center; gap: 20px; }
  `,
})
export class Booking {
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  // Route params, bound by name (withComponentInputBinding).
  readonly day = input.required<string>();
  readonly time = input.required<string>();

  protected submit(event: Event, name: string): void {
    event.preventDefault();
    // THE TRAP (on purpose): an optimistic toast. "Booked!" shows before the
    // API answers and is never taken back, even when the API says no.
    this.api.toast.set('Booked!');
    void this.api.book(this.day(), this.time(), name).then(() => this.router.navigateByUrl('/'));
  }
}
