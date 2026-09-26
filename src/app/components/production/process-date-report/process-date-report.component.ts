import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ProductionService } from '../../../services/production.service';
import { OPERATION_OPTIONS } from '../../../models/production.model';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { DateUtils } from '../../../shared/utils/date-utils';
import { downloadCsv } from '../../../shared/utils/csv-export.util';

/**
 * PROCESS_DATE_REPORT: pick start/end date + multiple processes, preview the
 * matching production rows, and download the Excel sheet for those days only.
 */
@Component({
  selector: 'app-process-date-report',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    LoaderComponent,
    SearchableSelectComponent,
    PaginationComponent
  ],
  templateUrl: './process-date-report.component.html',
  styleUrls: ['./process-date-report.component.scss']
})
export class ProcessDateReportComponent implements OnInit, OnDestroy {
  filterForm!: FormGroup;
  rows: any[] = [];
  isLoading = false;
  isExporting = false;
  hasSearched = false;
  processOptions = OPERATION_OPTIONS;

  currentPage = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];
  totalPages = 0;
  totalElements = 0;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private productionService: ProductionService,
    private snackbar: SnackbarService,
    private dateUtils: DateUtils
  ) {
    this.filterForm = this.fb.group({
      startDate: [null],
      endDate: [null],
      operationTypes: [[]],
      search: ['']
    });
  }

  ngOnInit(): void {
    this.loadReport();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildParams(page: number, size: number): any {
    const v = this.filterForm.value;
    return {
      currentPage: page,
      perPageRecord: size,
      startDate: v.startDate ? this.dateUtils.formatDateForApi(v.startDate, true) : null,
      endDate: v.endDate ? this.dateUtils.formatDateForApi(v.endDate, false) : null,
      operationTypes: (v.operationTypes || []).filter((t: any) => !!t),
      search: (v.search || '').trim()
    };
  }

  loadReport(): void {
    this.isLoading = true;
    this.productionService.getProductionReport(this.buildParams(this.currentPage, this.pageSize))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.rows = response.data.content;
            this.totalPages = response.data.totalPages;
            this.totalElements = response.data.totalElements;
            this.hasSearched = true;
          }
          this.isLoading = false;
        },
        error: (error) => {
          this.snackbar.error(error?.error?.message || 'Failed to load report');
          this.isLoading = false;
        }
      });
  }

  onSearch(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.currentPage = 0;
    this.loadReport();
  }

  resetForm(): void {
    this.filterForm.reset({ startDate: null, endDate: null, operationTypes: [], search: '' });
    this.currentPage = 0;
    this.loadReport();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadReport();
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize = newSize;
    this.currentPage = 0;
    this.loadReport();
  }

  /** Downloads the Excel sheet for exactly the filtered days/processes. */
  exportExcel(): void {
    if (!this.totalElements) {
      this.snackbar.error('No data to export for the selected filters');
      return;
    }
    this.isExporting = true;
    // One full-page fetch (bounded by the date range) for the file.
    this.productionService.getProductionReport(this.buildParams(0, this.totalElements))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.writeCsv(response.data.content || []);
          }
          this.isExporting = false;
        },
        error: (error) => {
          this.snackbar.error(error?.error?.message || 'Failed to export');
          this.isExporting = false;
        }
      });
  }

  private writeCsv(rows: any[]): void {
    if (!rows.length) {
      this.snackbar.error('No data to export for the selected filters');
      return;
    }
    const headers = ['Date', 'Planning No', 'Product', 'Process', 'Input Product', 'Quantity', 'Machine', 'Remarks'];
    const data = rows.map(r => [
      r.operationDate ? new Date(r.operationDate).toLocaleString('en-GB') : '',
      r.planningNumber || '-',
      r.outputProductName || '',
      r.operationType || '',
      r.inputProductName || '-',
      r.quantity ?? '',
      r.machineRemarks || '',
      r.remarks || ''
    ]);
    const v = this.filterForm.value;
    const tag = `${v.startDate || 'all'}_to_${v.endDate || 'all'}`;
    downloadCsv(`process-report_${tag}`, headers, data);
    this.snackbar.success('Excel sheet downloaded successfully');
  }
}
