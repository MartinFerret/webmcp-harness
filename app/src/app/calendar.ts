import { Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, type Slot } from './api';

@Component({
  selector: 'app-calendar',
  imports: [RouterLink],
  template: `
    <h1>Pick a slot</h1>
    <div class="grid">
      @for (column of columns(); track column.day) {
        <section class="card" [attr.aria-labelledby]="'day-' + column.day">
          <h2 [id]="'day-' + column.day">{{ column.day }}</h2>
          @for (slot of column.slots; track slot.time) {
            @if (slot.bookedBy) {
              <button type="button" disabled>{{ slot.time }} · {{ slot.bookedBy }}</button>
            } @else {
              <button type="button" [routerLink]="['/book', slot.day, slot.time]">{{ slot.time }}</button>
            }
          }
        </section>
      }
    </div>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
    section { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    h2 { margin-bottom: 6px; }
    @media (max-width: 800px) { .grid { grid-template-columns: 1fr; } }
  `,
})
export class Calendar {
  private readonly api = inject(Api);
  private readonly slots = resource({ params: () => this.api.attempts(), loader: () => this.api.slots() });

  /** Slots grouped by day, in API order: one column per day. */
  protected readonly columns = computed(() => {
    const byDay = new Map<string, Slot[]>();
    for (const slot of this.slots.value() ?? []) {
      byDay.set(slot.day, [...(byDay.get(slot.day) ?? []), slot]);
    }
    return [...byDay].map(([day, slots]) => ({ day, slots }));
  });
}
