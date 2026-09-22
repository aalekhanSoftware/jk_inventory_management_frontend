import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PaginationComponent } from './pagination/pagination.component';
import { LoaderComponent } from './loader/loader.component';
import { SearchableSelectComponent } from './searchable-select/searchable-select.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    // Import standalone components
    PaginationComponent,
    LoaderComponent,
    SearchableSelectComponent
  ],
  exports: [
    // Export standalone components so they can be used in other modules
    PaginationComponent,
    LoaderComponent,
    SearchableSelectComponent
  ]
})
export class SharedComponentsModule { } 