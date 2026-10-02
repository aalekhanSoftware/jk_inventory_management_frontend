import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PlanDispatchService } from '../../../services/plan-dispatch.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { EncryptionService } from '../../../shared/services/encryption.service';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { CanAccessDirective } from '../../../shared/directives/can-access.directive';

/**
 * PLAN_DISPATCH list: manages ALL dispatches (plan-linked + existing
 * unlinked rows). Old Transport list is untouched.
 */
@Component({
  selector: 'app-plan-dispatch-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    LoaderComponent,
    FormsModule,
    ConfirmModalComponent,
    PaginationComponent,
    CanAccessDirective
  ],
  templateUrl: './plan-dispatch-list.component.html',
  styleUrls: ['./plan-dispatch-list.component.scss']
})
export class PlanDispatchListComponent implements OnInit {
  dispatches: any[] = [];
  searchForm!: FormGroup;
  isLoading = false;

  currentPage = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];
  totalPages = 0;
  totalElements = 0;
  startIndex = 0;
  endIndex = 0;

  showDeleteModal = false;
  dispatchToDelete: number | null = null;

  constructor(
    private planDispatchService: PlanDispatchService,
    private fb: FormBuilder,
    private snackbar: SnackbarService,
    private encryptionService: EncryptionService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadDispatches();
  }

  /** Encrypted id for URLs (medonix pattern); numeric ids stay in POST bodies. */
  encId(id: number | null | undefined): string {
    return this.encryptionService.encrypt(String(id ?? ''));
  }

  private initializeForm(): void {
    this.searchForm = this.fb.group({
      search: [''],
      startDate: [null],
      endDate: [null]
    });
  }

  private formatDateForApi(dateStr: string, isStartDate: boolean): string {
    if (!dateStr) return '';

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const time = isStartDate ? '00:00:00' : '23:59:59';

    return `${day}-${month}-${year} ${time}`;
  }

  loadDispatches(): void {
    this.isLoading = true;
    const formValues = this.searchForm.value;

    const params = {
      currentPage: this.currentPage,
      perPageRecord: this.pageSize,
      startDate: formValues.startDate ? this.formatDateForApi(formValues.startDate, true) : null,
      endDate: formValues.endDate ? this.formatDateForApi(formValues.endDate, false) : null,
      search: formValues.search?.trim() || '',
      sortBy: 'id',
      sortDir: 'desc'
    };

    this.planDispatchService.searchDispatches(params).subscribe({
      next: (response) => {
        if (response.success) {
          this.dispatches = response.data.content;
          this.totalPages = response.data.totalPages;
          this.totalElements = response.data.totalElements;
          this.updatePaginationIndexes();
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.snackbar.error(error?.error?.message || 'Failed to load dispatches');
        this.isLoading = false;
      }
    });
  }

  onSearch(): void {
    this.currentPage = 0;
    this.loadDispatches();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadDispatches();
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize = newSize;
    this.currentPage = 0;
    this.loadDispatches();
  }

  private updatePaginationIndexes(): void {
    this.startIndex = this.currentPage * this.pageSize;
    this.endIndex = Math.min(this.startIndex + this.pageSize, this.totalElements);
  }

  resetForm(): void {
    this.searchForm.reset();
    this.currentPage = 0;
    this.loadDispatches();
  }

  onDeleteDispatch(id: number): void {
    this.dispatchToDelete = id;
    this.showDeleteModal = true;
  }

  confirmDelete(): void {
    if (this.dispatchToDelete) {
      this.isLoading = true;
      this.planDispatchService.deleteDispatch(this.dispatchToDelete).subscribe({
        next: (response) => {
          if (response.success) {
            this.snackbar.success(response.message || 'Dispatch deleted successfully; linked progress reversed');
            this.loadDispatches();
          } else {
            this.snackbar.error(response.message || 'Failed to delete dispatch');
          }
          this.cancelDelete();
          this.isLoading = false;
        },
        error: (error) => {
          this.snackbar.error(error?.error?.message || 'Failed to delete dispatch');
          this.cancelDelete();
          this.isLoading = false;
        }
      });
    }
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.dispatchToDelete = null;
  }

  onPrintDispatch(id: number): void {
    this.planDispatchService.generatePdf(id).subscribe({
      next: (response) => {
        const url = window.URL.createObjectURL(response.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = response.filename;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.snackbar.error('Failed to generate PDF');
      }
    });
  }
}
