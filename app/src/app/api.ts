import { Injectable, signal } from '@angular/core';

export interface Slot { day: string; time: string; bookedBy: string | null }

/** Talks to the SlotBook API and holds the session and the toast. */
@Injectable({ providedIn: 'root' })
export class Api {
  readonly token = signal<string | null>(null);
  readonly toast = signal<string | null>(null);
  /** Bumped after every booking attempt, so the calendar reloads. */
  readonly attempts = signal(0);

  async login(email: string, password: string): Promise<boolean> {
    const res = await this.post('/api/login', { email, password });
    if (!res.ok) return false;
    this.token.set(((await res.json()) as { token: string }).token);
    return true;
  }

  logout(): void {
    this.token.set(null);
  }

  async slots(): Promise<Slot[]> {
    return (await fetch('/api/slots')).json() as Promise<Slot[]>;
  }

  /** Resolves to null on success, or to the API's error message. */
  async book(day: string, time: string, name: string): Promise<string | null> {
    const res = await this.post('/api/book', { day, time, name });
    this.attempts.update((n) => n + 1);
    if (res.ok) return null;
    return ((await res.json()) as { error: string }).error;
  }

  private post(url: string, body: unknown): Promise<Response> {
    const token = this.token();
    return fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  }
}
