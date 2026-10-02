import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterLink, RouterModule } from '@angular/router';
import { MachineryService } from '../../../services/machinery.service';
import { Machinery, MACHINERY_STATUS_OPTIONS, machineryStatusLabel } from '../../../models/machinery.model';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { EncryptionService } from '../../../shared/services/encryption.service';
import { DateUtils } from '../../../shared/utils/date-utils';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { CanAccessDirective } from '../../../shared/directives/can-access.directive';

@Component({
  selector: 'app-machinery-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    LoaderComponent,
    RouterLink,
    PaginationComponent,
    CanAccessDirective
  ],
  templateUrl: './machinery-list.component.html',
  styleUrls: ['./machinery-list.component.scss']
})
export class MachineryListComponent implements OnInit {
  machineries: Machinery[] = [];
  searchForm!: FormGroup;
  isLoading = false;

  currentPage = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];
  totalPages = 0;
  totalElements = 0;
  startIndex = 0;
  endIndex = 0;

  statusOptions = MACHINERY_STATUS_OPTIONS;
  statusLabel = machineryStatusLabel;

  constructor(
    private machineryService: MachineryService,
    private fb: FormBuilder,
    private snackbar: SnackbarService,
    private encryptionService: EncryptionService,
    private dateUtils: DateUtils
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadMachineries();
  }

  /** Encrypted id for URLs (medonix pattern); numeric ids stay in POST bodies. */
  encId(id: number | null | undefined): string {
    return this.encryptionService.encrypt(String(id ?? ''));
  }

  private initializeForm(): void {
    this.searchForm = this.fb.group({
      search: [''],
      status: [''],
      startDate: [null],
      endDate: [null]
    });
  }

  loadMachineries(): void {
    this.isLoading = true;
    const formValues = this.searchForm.value;
    const params = {
      currentPage: this.currentPage,
      perPageRecord: this.pageSize,
      ...formValues,
      startDate: formValues.startDate ? this.dateUtils.formatDateForApi(formValues.startDate, true) : null,
      endDate: formValues.endDate ? this.dateUtils.formatDateForApi(formValues.endDate, true) : null
    };
    this.machineryService.searchMachineries(params).subscribe({
      next: (response) => {
        if (response.success) {
          this.machineries = response.data.content;
          this.totalPages = response.data.totalPages;
          this.totalElements = response.data.totalElements;
          this.updatePaginationIndexes();
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.snackbar.error(error?.error?.message || 'Failed to load machineries');
        this.isLoading = false;
      }
    });
  }

  private updatePaginationIndexes(): void {
    this.startIndex = this.currentPage * this.pageSize;
    this.endIndex = Math.min((this.currentPage + 1) * this.pageSize, this.totalElements);
  }

  onSearch(): void {
    this.currentPage = 0;
    this.loadMachineries();
  }

  resetForm(): void {
    this.searchForm.reset();
    this.currentPage = 0;
    this.loadMachineries();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadMachineries();
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize = newSize;
    this.currentPage = 0;
    this.loadMachineries();
  }

  deleteMachinery(id: number): void {
    if (confirm('Are you sure you want to delete this machinery?')) {
      this.isLoading = true;
      this.machineryService.deleteMachinery(id).subscribe({
        next: (response) => {
          if (response.success) {
            this.snackbar.success('Machinery deleted successfully');
            this.loadMachineries();
          } else {
            this.isLoading = false;
          }
        },
        error: (error) => {
          this.snackbar.error(error?.error?.message || 'Failed to delete machinery');
          this.isLoading = false;
        }
      });
    }
  }
}
