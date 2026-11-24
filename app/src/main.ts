// WebMCP polyfill, so document.modelContext exists in browsers without native support.
// https://github.com/w3c-oss/webmcp-polyfill
import '@w3c/webmcp-polyfill/auto';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
