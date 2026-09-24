import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ProductionService } from '../../../services/production.service';
import { StockMovement } from '../../../models/production.model';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { DateUtils } from '../../../shared/utils/date-utils';

@Component({
  selector: 'app-stock-movement-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, LoaderComponent, PaginationComponent],
  templateUrl: './stock-movement-list.component.html',
  styleUrls: ['./stock-movement-list.component.scss']
})
export class StockMovementListComponent implements OnInit {
  movements: StockMovement[] = [];
  searchForm!: FormGroup;
  isLoading = false;
  currentPage = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];
  totalPages = 0;
  totalElements = 0;

  constructor(
    private productionService: ProductionService,
    private fb: FormBuilder,
    private snackbar: SnackbarService,
    private dateUtils: DateUtils
  ) {
    this.searchForm = this.fb.group({
      search: [''],
      startDate: [null],
      endDate: [null]
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    const fv = this.searchForm.value;
    this.productionService.searchMovements({
      currentPage: this.currentPage,
      perPageRecord: this.pageSize,
      search: fv.search || '',
      startDate: fv.startDate ? this.dateUtils.formatDateForApi(fv.startDate, true) : null,
      endDate: fv.endDate ? this.dateUtils.formatDateForApi(fv.endDate, true) : null
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.movements = response.data.content;
          this.totalPages = response.data.totalPages;
          this.totalElements = response.data.totalElements;
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.snackbar.error(error?.error?.message || 'Failed to load stock movements');
        this.isLoading = false;
      }
    });
  }

  onSearch(): void {
    this.currentPage = 0;
    this.load();
  }

  resetForm(): void {
    this.searchForm.reset();
    this.currentPage = 0;
    this.load();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.load();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 0;
    this.load();
  }
}
