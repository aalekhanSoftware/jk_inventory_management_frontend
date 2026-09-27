import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PlanCoatingService } from '../../../services/plan-coating.service';
import { PowderCoatingService } from '../../../services/powder-coating.service';
import { CustomerService } from '../../../services/customer.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { EncryptionService } from '../../../shared/services/encryption.service';
import { PlanCoatingProcess } from '../../../models/plan-coating.model';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

/**
 * PLAN_COATING list: shows ALL coating processes (plan-linked + plain), the
 * same records as the old Coating screen, with a Planning badge column.
 * Old powder-coating-process list is untouched; PDF reuses the existing
 * /api/powder-coating/generate-pdf endpoint.
 */
@Component({
  selector: 'app-plan-coating-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LoaderComponent,
    SearchableSelectComponent,
    FormsModule,
    RouterLink,
    PaginationComponent
  ],
  templateUrl: './plan-coating-list.component.html',
  styleUrls: ['./plan-coating-list.component.scss']
})
export class PlanCoatingListComponent implements OnInit {
  processes: PlanCoatingProcess[] = [];
  searchForm!: FormGroup;
  isLoading = false;
  customers: any[] = [];
  isLoadingCustomers = false;
  selectedProcesses: Set<number> = new Set();
  selectedCustomerId?: number;
  isGeneratingPdf = false;

  // Pagination
  currentPage = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];
  totalPages = 0;
  totalElements = 0;
  startIndex = 0;
  endIndex = 0;

  constructor(
    private planCoatingService: PlanCoatingService,
    private powderCoatingService: PowderCoatingService,
    private fb: FormBuilder,
    private snackbar: SnackbarService,
    private customerService: CustomerService,
    private encryptionService: EncryptionService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadProcesses();
    this.loadCustomers();
  }

  /** Encrypted id for URLs (medonix pattern); numeric ids stay in POST bodies. */
  encId(id: number | null | undefined): string {
    return this.encryptionService.encrypt(String(id ?? ''));
  }

  private initializeForm(): void {
    this.searchForm = this.fb.group({
      search: [''],
      customerId: ['']
    });
  }

  loadProcesses(): void {
    this.isLoading = true;
    this.selectedCustomerId = undefined;
    this.selectedProcesses.clear();
    const params = {
      ...this.searchForm.value,
      currentPage: this.currentPage,
      perPageRecord: this.pageSize,
      sortBy: 'id',
      sortDir: 'desc'
    };

    this.planCoatingService.searchProcesses(params).subscribe({
      next: (response) => {
        if (response.success) {
          this.processes = response.data.content;
          this.totalPages = response.data.totalPages;
          this.totalElements = response.data.totalElements;
          this.updatePaginationIndexes();
        }
        this.isLoading = false;
      },
      error: () => {
        this.snackbar.error('Failed to load processes');
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
    this.loadProcesses();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadProcesses();
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize = newSize;
    this.currentPage = 0;
    this.loadProcesses();
  }

  getPageNumbers(): number[] {
    const pageNumbers: number[] = [];
    const totalPages = this.totalPages;
    const currentPage = this.currentPage + 1;

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 5; i++) {
          pageNumbers.push(i);
        }
      } else if (currentPage >= totalPages - 2) {
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pageNumbers.push(i);
        }
      } else {
        for (let i = currentPage - 2; i <= currentPage + 2; i++) {
          pageNumbers.push(i);
        }
      }
    }

    return pageNumbers;
  }

  deleteProcess(id: number): void {
    if (confirm('Are you sure you want to delete this process? Linked plan progress will be reversed.')) {
      this.planCoatingService.deleteProcess(id).subscribe({
        next: (response) => {
          if (response.success) {
            this.snackbar.success('Process deleted successfully');
            this.loadProcesses();
          }
        },
        error: () => {
          this.snackbar.error('Failed to delete process');
        }
      });
    }
  }

  resetForm(): void {
    this.searchForm.reset();
    this.currentPage = 0;
    this.loadProcesses();
  }

  loadCustomers(): void {
    this.isLoadingCustomers = true;
    this.customerService.getCustomers({ status: 'A' }).subscribe({
      next: (response) => {
        if (response.success) {
          this.customers = response.data;
        }
        this.isLoadingCustomers = false;
      },
      error: () => {
        this.snackbar.error('Failed to load customers');
        this.isLoadingCustomers = false;
      }
    });
  }

  refreshCustomers(): void {
    this.isLoadingCustomers = true;
    this.customerService.refreshCustomers().subscribe({
      next: (response) => {
        if (response.success) {
          this.customers = response.data;
          this.snackbar.success('Customers refreshed successfully');
        }
        this.isLoadingCustomers = false;
      },
      error: () => {
        this.snackbar.error('Failed to refresh customers');
        this.isLoadingCustomers = false;
      }
    });
  }

  isCheckboxDisabled(process: PlanCoatingProcess): boolean {
    return this.selectedCustomerId !== undefined &&
           this.selectedCustomerId !== process.customerId;
  }

  getTotalQuantity(process: PlanCoatingProcess): number {
    if (!process.items || process.items.length === 0) return 0;
    return process.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }

  getTotalBags(process: PlanCoatingProcess): number {
    if (!process.items || process.items.length === 0) return 0;
    return process.items.reduce((sum, item) => sum + (item.totalBags || 0), 0);
  }

  getTotalAmount(process: PlanCoatingProcess): number {
    if (!process.items || process.items.length === 0) return 0;
    return process.items.reduce((sum, item) => {
      const itemTotal = item.totalAmount || (item.quantity * item.unitPrice);
      return sum + itemTotal;
    }, 0);
  }

  isProcessCompleted(process: PlanCoatingProcess): boolean {
    if (!process.items || process.items.length === 0) return false;
    return process.items.every(item => (item.remainingQuantity || item.quantity) === 0);
  }

  getItemCount(process: PlanCoatingProcess): number {
    return process.items?.length || 0;
  }

  getItemNames(process: PlanCoatingProcess): string {
    if (!process.items || process.items.length === 0) return '';
    const names = process.items.map(item => item.productName || 'Unknown').filter(Boolean);
    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    if (names.length <= 3) return names.join(', ');
    return `${names.slice(0, 3).join(', ')} +${names.length - 3} more`;
  }

  toggleProcessSelection(process: PlanCoatingProcess, event: Event): void {
    if (this.isCheckboxDisabled(process)) {
      event.preventDefault();
      this.snackbar.error('You can select records of only one customer');
      return;
    }

    if (this.selectedProcesses.size === 0) {
      this.selectedCustomerId = process.customerId;
      this.selectedProcesses.add(process.id);
    } else {
      if (this.selectedProcesses.has(process.id)) {
        this.selectedProcesses.delete(process.id);
        if (this.selectedProcesses.size === 0) {
          this.selectedCustomerId = undefined;
        }
      } else {
        this.selectedProcesses.add(process.id);
      }
    }
  }

  generatePdf(): void {
    if (!this.selectedCustomerId || this.selectedProcesses.size === 0) {
      this.snackbar.error('Please select at least one process');
      return;
    }

    this.isGeneratingPdf = true;
    const data = {
      customerId: this.selectedCustomerId,
      processIds: Array.from(this.selectedProcesses)
    };

    this.powderCoatingService.generatePdf(data).subscribe({
      next: (response) => {
        const url = window.URL.createObjectURL(response.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = response.filename;
        link.click();
        window.URL.revokeObjectURL(url);
        this.isGeneratingPdf = false;
      },
      error: () => {
        this.snackbar.error('Failed to generate PDF');
        this.isGeneratingPdf = false;
      }
    });
  }
}
