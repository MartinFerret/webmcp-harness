import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { Booking } from './booking';
import { Calendar } from './calendar';
import { Login } from './login';
import { provideBookSlotTool } from './webmcp';

// Angular 22 is zoneless by default: no zone.js, no extra provider needed.
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideBookSlotTool(),
    provideRouter([
      { path: '', component: Calendar, title: 'SlotBook' },
      { path: 'login', component: Login, title: 'Log in · SlotBook' },
      { path: 'book/:day/:time', component: Booking, title: 'Book a slot · SlotBook' },
      { path: '**', redirectTo: '' },
    ], withComponentInputBinding()),
  ],
};
