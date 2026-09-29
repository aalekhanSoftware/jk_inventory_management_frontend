import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink, RouterModule } from '@angular/router';
import { ProductionService } from '../../../services/production.service';
import { DashboardSummary } from '../../../models/production.model';
import { downloadCsv } from '../../../shared/utils/csv-export.util';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { PlanSelectComponent } from '../../../shared/components/plan-select/plan-select.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { EncryptionService } from '../../../shared/services/encryption.service';

@Component({
  selector: 'app-production-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, RouterLink, LoaderComponent, PlanSelectComponent, PaginationComponent],
  templateUrl: './production-dashboard.component.html',
  styleUrls: ['./production-dashboard.component.scss']
})
export class ProductionDashboardComponent implements OnInit {
  summary: DashboardSummary | null = null;
  isLoading = false;
  isExporting = false;
  filterForm!: FormGroup;

  // Breakdown pagination (page size 10 like all other lists)
  currentPage = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];
  totalPages = 0;
  totalElements = 0;

  constructor(
    private productionService: ProductionService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private encryptionService: EncryptionService,
    private snackbar: SnackbarService
  ) {
    this.filterForm = this.fb.group({ planningId: [null] });
  }

  ngOnInit(): void {
    // Encrypted planningId query param (sent encrypted from Planning Detail).
    const rawPlanningId = this.route.snapshot.queryParamMap.get('planningId');
    const qPlanningId = rawPlanningId ? Number(this.encryptionService.decrypt(rawPlanningId)) : NaN;
    if (qPlanningId) {
      this.filterForm.patchValue({ planningId: qPlanningId });
    }
    this.loadSummary();
  }

  /** Encrypted id for URLs (medonix pattern); numeric ids stay in POST bodies. */
  encId(id: number | null | undefined): string {
    return this.encryptionService.encrypt(String(id ?? ''));
  }

  loadSummary(): void {
    this.isLoading = true;
    const planningId = this.filterForm.value.planningId || null;
    this.productionService.getDashboardSummary(planningId, this.currentPage, this.pageSize).subscribe({
      next: (response) => {
        if (response.success) {
          this.summary = response.data;
          this.totalPages = response.data.totalPages ?? 0;
          this.totalElements = response.data.totalElements ?? response.data.breakdown?.length ?? 0;
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
    this.filterForm.reset();
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

  /** Excel-compatible download of the FULL breakdown (all pages, opens in Excel). */
  exportExcel(): void {
    if (!this.summary) {
      this.snackbar.error('No data to export');
      return;
    }
    this.isExporting = true;
    const planningId = this.filterForm.value.planningId || null;
    this.productionService.getDashboardSummary(planningId).subscribe({
      next: (response) => {
        if (response.success) {
          this.writeCsv(response.data);
        }
        this.isExporting = false;
      },
      error: (error) => {
        this.snackbar.error(error?.error?.message || 'Failed to export');
        this.isExporting = false;
      }
    });
  }

  private writeCsv(data: DashboardSummary): void {
    if (!data.breakdown?.length) {
      this.snackbar.error('No data to export');
      return;
    }
    const headers = ['Planning', 'Product', 'Planned', 'Cutting', 'Emboss', 'Coating', 'Packing', 'Dispatch', 'Remaining', 'Status'];
    const rows = data.breakdown.map(r => [
      r.planningNumber, r.productName, r.planned, r.cutting, r.emboss,
      r.coatingRequired ? r.coating : 'N/A', r.packing, r.dispatch, r.remaining,
      r.status === 'O' ? 'Not Started' : r.status === 'P' ? 'In Progress' : r.status === 'C' ? 'Completed' : r.status
    ]);
    rows.push(['TOTAL', '', data.planned, data.cutting, data.emboss,
      data.coating, data.packing, data.dispatch, data.remaining, '']);
    downloadCsv('production-dashboard', headers, rows);
    this.snackbar.success('Excel sheet downloaded successfully');
  }
}
