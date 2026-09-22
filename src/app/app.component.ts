import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <app-header></app-header>
    <router-outlet></router-outlet>
    <app-password-validation-modal></app-password-validation-modal>
  `
})
export class AppComponent { }