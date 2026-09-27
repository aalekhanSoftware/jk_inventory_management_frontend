import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink, RouterModule } from '@angular/router';
import { PlanningService } from '../../../services/planning.service';
import { ProductionService } from '../../../services/production.service';
import { planningStatusLabel } from '../../../models/planning.model';
import { downloadCsv } from '../../../shared/utils/csv-export.util';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { EncryptionService } from '../../../shared/services/encryption.service';

@Component({
  selector: 'app-planning-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, LoaderComponent],
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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private planningService: PlanningService,
    private productionService: ProductionService,
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
