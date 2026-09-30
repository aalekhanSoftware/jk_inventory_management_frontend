import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink, RouterModule } from '@angular/router';
import { PlanningService } from '../../../services/planning.service';
import { ProductionService } from '../../../services/production.service';
import { PlanDispatchService } from '../../../services/plan-dispatch.service';
import { planningStatusLabel } from '../../../models/planning.model';
import { downloadCsv } from '../../../shared/utils/csv-export.util';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { EncryptionService } from '../../../shared/services/encryption.service';

@Component({
  selector: 'app-planning-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, LoaderComponent, ConfirmModalComponent],
  templateUrl: './planning-detail.component.html',
  styleUrls: ['./planning-detail.component.scss']
})
export class PlanningDetailComponent implements OnInit {
  planning: any = null;
  isLoading = false;
  expandedItemId: number | null = null;
  transactionsByItem: Record<number, any> = {};
  loadingTx: Record<number, boolean> = {};
  statusLabel = planningStatusLabel;

  // QUICK_DISPATCH: bulk one-click Packing → Dispatch selection.
  selectedDispatch = new Set<number>();
  showQuickModal = false;
  isDispatching = false;

  /** Eligible only with packed balance left (Packing > 0 and Dispatch < Packing). */
  isDispatchable(item: any): boolean {
    const packing = Number(item?.packingQty) || 0;
    const dispatch = Number(item?.dispatchQty) || 0;
    return packing > 0 && dispatch < packing;
  }

  dispatchableQty(item: any): number {
    return (Number(item?.packingQty) || 0) - (Number(item?.dispatchQty) || 0);
  }

  dispatchBlockReason(item: any): string {
    const packing = Number(item?.packingQty) || 0;
    const dispatch = Number(item?.dispatchQty) || 0;
    if (packing <= 0) {
      return 'No packed stock';
    }
    if (dispatch >= packing) {
      return 'Fully dispatched';
    }
    return '';
  }

  toggleItemSelection(item: any): void {
    if (!this.isDispatchable(item)) {
      return;
    }
    if (this.selectedDispatch.has(item.id)) {
      this.selectedDispatch.delete(item.id);
    } else {
      this.selectedDispatch.add(item.id);
    }
  }

  eligibleItems(): any[] {
    return (this.planning?.items || []).filter((i: any) => this.isDispatchable(i));
  }

  allEligibleSelected(): boolean {
    const eligible = this.eligibleItems();
    return eligible.length > 0 && eligible.every((i: any) => this.selectedDispatch.has(i.id));
  }

  toggleAllEligible(): void {
    if (this.allEligibleSelected()) {
      this.selectedDispatch.clear();
    } else {
      this.eligibleItems().forEach((i: any) => this.selectedDispatch.add(i.id));
    }
  }

  selectedLines(): string[] {
    return (this.planning?.items || [])
      .filter((i: any) => this.selectedDispatch.has(i.id))
      .map((i: any) => `${i.productName}: ${this.dispatchableQty(i)} pcs`);
  }

  get hasCustomer(): boolean {
    return !!this.planning?.customerId;
  }

  openQuickDispatch(): void {
    if (!this.selectedDispatch.size) {
      this.snackbar.error('Select at least one product to dispatch');
      return;
    }
    if (!this.hasCustomer) {
      this.snackbar.error('Attach a customer to the plan first (Planning Edit)');
      return;
    }
    this.showQuickModal = true;
  }

  cancelQuickDispatch(): void {
    this.showQuickModal = false;
  }

  confirmQuickDispatch(): void {
    if (!this.planning || !this.selectedDispatch.size || this.isDispatching) {
      return;
    }
    this.isDispatching = true;
    this.planDispatchService.quickDispatch(this.planning.id, [...this.selectedDispatch]).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackbar.success(response.message || 'Dispatch created successfully');
          this.selectedDispatch.clear();
          this.showQuickModal = false;
          this.transactionsByItem = {};
          this.expandedItemId = null;
          this.loadDetail(this.planning.id);
        }
        this.isDispatching = false;
      },
      error: (error) => {
        this.snackbar.error(error?.error?.message || 'Failed to create dispatch');
        this.isDispatching = false;
      }
    });
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private planningService: PlanningService,
    private productionService: ProductionService,
    private planDispatchService: PlanDispatchService,
    private encryptionService: EncryptionService,
    private snackbar: SnackbarService
  ) {}

  ngOnInit(): void {
    // Encrypted id in URL (medonix add-sale pattern): decrypt before use.
    const rawId = this.route.snapshot.paramMap.get('id');
    const id = rawId ? Number(this.encryptionService.decrypt(rawId)) : NaN;
    if (rawId && !id) {
      this.snackbar.error('Invalid link');
      this.router.navigate(['/planning']);
      return;
    }
    if (id) {
      this.loadDetail(id);
    }
  }

  /** Encrypted id for URLs (medonix pattern); numeric ids stay in POST bodies. */
  encId(id: number | null | undefined): string {
    return this.encryptionService.encrypt(String(id ?? ''));
  }

  loadDetail(id: number): void {
    this.isLoading = true;
    this.planningService.getPlanningDetail(id).subscribe({
      next: (response) => {
        if (response.success) {
          this.planning = response.data;
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.snackbar.error(error?.error?.message || 'Failed to load planning detail');
        this.isLoading = false;
      }
    });
  }

  toggleTransactions(item: any): void {
    if (this.expandedItemId === item.id) {
      this.expandedItemId = null;
      return;
    }
    this.expandedItemId = item.id;
    if (this.transactionsByItem[item.id]) {
      return;
    }
    this.fetchTransactions(item);
  }

  private fetchTransactions(item: any): void {
    this.loadingTx[item.id] = true;
    this.productionService.getTransactionsByItem(item.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.transactionsByItem[item.id] = response.data;
        }
        this.loadingTx[item.id] = false;
      },
      error: (error) => {
        this.snackbar.error(error?.error?.message || 'Failed to load transactions');
        this.loadingTx[item.id] = false;
      }
    });
  }

  deleteEntry(opId: number, item: any): void {
    if (!confirm('Delete this entry? Its stock effect (minus/add) will be reversed exactly.')) {
      return;
    }
    this.productionService.deleteOperation(opId).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackbar.success(response.message);
          delete this.transactionsByItem[item.id];
          this.loadDetail(this.planning.id);
          if (this.expandedItemId === item.id) {
            this.fetchTransactions(item);
          }
        }
      },
      error: (error) => {
        this.snackbar.error(error?.error?.message || 'Failed to delete entry');
      }
    });
  }

  progressPercent(item: any): number {
    if (!item?.plannedQuantity) {
      return 0;
    }
    const done = (item.dispatchQty || 0);
    return Math.min(100, Math.round((done / item.plannedQuantity) * 100));
  }

  itemStatusLabel(status?: string): string {
    switch (status) {
      case 'O': return 'Not Started';
      case 'P': return 'In Progress';
      case 'C': return 'Completed';
      default: return status || '-';
    }
  }

  /** Excel-compatible download of the product-wise table (opens in Excel). */
  exportExcel(): void {
    if (!this.planning || !this.planning.items?.length) {
      this.snackbar.error('No data to export');
      return;
    }
    const headers = ['Product', 'Planned', 'Bags', 'Cutting', 'Emboss', 'Coating', 'Packing', 'Dispatch', 'Remaining', 'Status'];
    const rows = this.planning.items.map((item: any) => [
      item.productName, item.plannedQuantity, item.totalBags ?? '', item.cuttingQty, item.embossQty,
      item.coatingRequired ? item.coatingQty : 'N/A', item.packingQty, item.dispatchQty,
      item.remainingQty, this.itemStatusLabel(item.itemStatus)
    ]);
    rows.push(['TOTAL', this.planning.totalPlanned, '', this.planning.cuttingQty, this.planning.embossQty,
      this.planning.coatingQty, this.planning.packingQty, this.planning.dispatchQty, this.planning.remainingQty, '']);
    downloadCsv(`planning-${this.planning.planningNumber || this.planning.id}`, headers, rows);
    this.snackbar.success('Excel sheet downloaded successfully');
  }
}
