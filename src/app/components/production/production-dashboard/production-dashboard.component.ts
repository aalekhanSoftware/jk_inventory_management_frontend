import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink, RouterModule } from '@angular/router';
import { ProductionService } from '../../../services/production.service';
import { EmployeeService } from '../../../services/employee.service';
import { DashboardRow } from '../../../models/production.model';
import { downloadCsv } from '../../../shared/utils/csv-export.util';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { PlanSelectComponent } from '../../../shared/components/plan-select/plan-select.component';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { EncryptionService } from '../../../shared/services/encryption.service';
import { DateUtils } from '../../../shared/utils/date-utils';

@Component({
  selector: 'app-production-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, RouterLink, LoaderComponent, PlanSelectComponent, SearchableSelectComponent, PaginationComponent],
  templateUrl: './production-dashboard.component.html',
  styleUrls: ['./production-dashboard.component.scss']
})
export class ProductionDashboardComponent implements OnInit {
  // DASHBOARD_CLIENT_TOTALS: the API returns ONLY the requested page of rows
  // (latest first). Every total below is summed in Angular from these rows,
  // so the cards always reflect exactly the records on screen.
  rows: DashboardRow[] = [];
  employees: any[] = [];
  isLoading = false;
  isExporting = false;
  isLoadingEmployees = false;
  filterForm!: FormGroup;

  // Breakdown pagination (page size 10 like all other lists)
  currentPage = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];
  totalPages = 0;
  totalElements = 0;

  constructor(
    private productionService: ProductionService,
    private employeeService: EmployeeService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private encryptionService: EncryptionService,
    private snackbar: SnackbarService,
    private dateUtils: DateUtils
  ) {
    this.filterForm = this.fb.group({
      planningId: [null],
      employeeId: [null],
      startDate: [null],
      endDate: [null]
    });
  }

  ngOnInit(): void {
    // Encrypted planningId query param (sent encrypted from Planning Detail).
    const rawPlanningId = this.route.snapshot.queryParamMap.get('planningId');
    const qPlanningId = rawPlanningId ? Number(this.encryptionService.decrypt(rawPlanningId)) : NaN;
    if (qPlanningId) {
      this.filterForm.patchValue({ planningId: qPlanningId });
    }
    this.loadEmployees();
    this.loadSummary();
  }

  /** Encrypted id for URLs (medonix pattern); numeric ids stay in POST bodies. */
  encId(id: number | null | undefined): string {
    return this.encryptionService.encrypt(String(id ?? ''));
  }

  loadEmployees(): void {
    this.isLoadingEmployees = true;
    this.employeeService.getAllEmployees().subscribe({
      next: (response) => {
        if (response.success) {
          this.employees = response.data;
        }
        this.isLoadingEmployees = false;
      },
      error: () => {
        this.isLoadingEmployees = false;
      }
    });
  }

  private filterParams() {
    const v = this.filterForm.value;
    return {
      employeeId: v.employeeId || null,
      startDate: v.startDate ? this.dateUtils.formatDateForApi(v.startDate, true) : null,
      endDate: v.endDate ? this.dateUtils.formatDateForApi(v.endDate, false) : null
    };
  }

  loadSummary(): void {
    this.isLoading = true;
    const planningId = this.filterForm.value.planningId || null;
    this.productionService.getDashboardSummary(
      planningId, this.currentPage, this.pageSize, this.filterParams()).subscribe({
      next: (response) => {
        if (response.success) {
          this.rows = response.data.breakdown || [];
          this.totalPages = response.data.totalPages ?? 0;
          this.totalElements = response.data.totalElements ?? this.rows.length;
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.snackbar.error(error?.error?.message || 'Failed to load dashboard');
        this.isLoading = false;
      }
    });
  }

  onFilter(): void {
    this.currentPage = 0;
    this.loadSummary();
  }

  resetFilter(): void {
    this.filterForm.reset({ planningId: null, employeeId: null, startDate: null, endDate: null });
    this.currentPage = 0;
    this.loadSummary();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadSummary();
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize = newSize;
    this.currentPage = 0;
    this.loadSummary();
  }

  rowPercent(row: any): number {
    if (!row?.planned) {
      return 0;
    }
    return Math.min(100, Math.round(((row.dispatch || 0) / row.planned) * 100));
  }

  // ---- Client-side totals: summed from the rows on screen only ----
  private sumOf(pick: (r: DashboardRow) => any): number {
    return this.rows.reduce((total, r) => total + (Number(pick(r)) || 0), 0);
  }

  get totalPlanned(): number { return this.sumOf(r => r.planned); }
  get totalCutting(): number { return this.sumOf(r => r.cutting); }
  get totalEmboss(): number { return this.sumOf(r => r.emboss); }
  get totalCoating(): number { return this.sumOf(r => r.coating); }
  get totalPacking(): number { return this.sumOf(r => r.packing); }
  get totalDispatch(): number { return this.sumOf(r => r.dispatch); }
  // Consistent with progress maths: Remaining = Planned − Cutting.
  get totalRemaining(): number { return this.totalPlanned - this.totalCutting; }

  /** Excel-compatible download of the rows on screen (opens in Excel). */
  exportExcel(): void {
    if (!this.rows.length) {
      this.snackbar.error('No data to export');
      return;
    }
    this.isExporting = true;
    try {
      const headers = ['Planning', 'Product', 'Planned', 'Cutting', 'Emboss', 'Coating', 'Packing', 'Dispatch', 'Remaining', 'Status'];
      const rows = this.rows.map(r => [
        r.planningNumber, r.productName, r.planned, r.cutting, r.emboss,
        r.coatingRequired ? r.coating : 'N/A', r.packing, r.dispatch,
        (Number(r.planned) || 0) - (Number(r.cutting) || 0),
        r.status === 'O' ? 'Not Started' : r.status === 'P' ? 'In Progress' : r.status === 'C' ? 'Completed' : r.status
      ]);
      rows.push(['TOTAL', '', this.totalPlanned, this.totalCutting, this.totalEmboss,
        this.totalCoating, this.totalPacking, this.totalDispatch, this.totalRemaining, '']);
      downloadCsv('production-dashboard', headers, rows);
      this.snackbar.success('Excel sheet downloaded successfully');
    } finally {
      this.isExporting = false;
    }
  }
}
