import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterLink, RouterModule } from '@angular/router';
import { PlanningService } from '../../../services/planning.service';
import { Planning, PLANNING_STATUS_OPTIONS, planningStatusLabel } from '../../../models/planning.model';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { EncryptionService } from '../../../shared/services/encryption.service';
import { DateUtils } from '../../../shared/utils/date-utils';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { CanAccessDirective } from '../../../shared/directives/can-access.directive';

@Component({
  selector: 'app-planning-list',
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
  templateUrl: './planning-list.component.html',
  styleUrls: ['./planning-list.component.scss']
})
export class PlanningListComponent implements OnInit {
  plannings: Planning[] = [];
  searchForm!: FormGroup;
  isLoading = false;

  currentPage = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];
  totalPages = 0;
  totalElements = 0;
  startIndex = 0;
  endIndex = 0;

  statusOptions = PLANNING_STATUS_OPTIONS;
  statusLabel = planningStatusLabel;

  /** Encrypted id for URLs (medonix pattern); numeric ids stay in POST bodies. */
  encId(id: number | null | undefined): string {
    return this.encryptionService.encrypt(String(id ?? ''));
  }

  constructor(
    private planningService: PlanningService,
    private fb: FormBuilder,
    private snackbar: SnackbarService,
    private encryptionService: EncryptionService,
    private dateUtils: DateUtils
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadPlannings();
  }

  private initializeForm(): void {
    this.searchForm = this.fb.group({
      search: [''],
      status: [''],
      startDate: [null],
      endDate: [null]
    });
  }

  loadPlannings(): void {
    this.isLoading = true;
    const formValues = this.searchForm.value;
    const params = {
      currentPage: this.currentPage,
      perPageRecord: this.pageSize,
      ...formValues,
      startDate: formValues.startDate ? this.dateUtils.formatDateForApi(formValues.startDate, true) : null,
      endDate: formValues.endDate ? this.dateUtils.formatDateForApi(formValues.endDate, true) : null
    };
    this.planningService.searchPlannings(params).subscribe({
      next: (response) => {
        if (response.success) {
          this.plannings = response.data.content;
          this.totalPages = response.data.totalPages;
          this.totalElements = response.data.totalElements;
          this.updatePaginationIndexes();
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.snackbar.error(error?.error?.message || 'Failed to load plannings');
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
    this.loadPlannings();
  }

  resetForm(): void {
    this.searchForm.reset();
    this.currentPage = 0;
    this.loadPlannings();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadPlannings();
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize = newSize;
    this.currentPage = 0;
    this.loadPlannings();
  }

  deletePlanning(id: number): void {
    if (confirm('Are you sure you want to delete this planning? Production entries must be zero.')) {
      this.isLoading = true;
      this.planningService.deletePlanning(id).subscribe({
        next: (response) => {
          if (response.success) {
            this.snackbar.success('Planning deleted successfully');
            this.loadPlannings();
          } else {
            this.isLoading = false;
          }
        },
        error: (error) => {
          this.snackbar.error(error?.error?.message || 'Failed to delete planning');
          this.isLoading = false;
        }
      });
    }
  }
}
