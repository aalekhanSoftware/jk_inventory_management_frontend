import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PlanningService } from '../../../services/planning.service';
import { ProductionService } from '../../../services/production.service';
import { ProductService } from '../../../services/product.service';
import { EmployeeService } from '../../../services/employee.service';
import { MachineryService } from '../../../services/machinery.service';
import { OPERATION_OPTIONS } from '../../../models/production.model';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { EncryptionService } from '../../../shared/services/encryption.service';

@Component({
  selector: 'app-production-entry',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, RouterLink, LoaderComponent, SearchableSelectComponent],
  templateUrl: './production-entry.component.html',
  styleUrls: ['./production-entry.component.scss']
})
export class ProductionEntryComponent implements OnInit, OnDestroy {
  entryForm!: FormGroup;
  isLoading = false;
  isSaving = false;
  plannings: any[] = [];
  planningItems: any[] = [];
  products: any[] = [];
  employees: any[] = [];
  machineries: any[] = [];
  isLoadingMachineries = false;
  operationOptions = OPERATION_OPTIONS;
  selectedItem: any = null;
  // Edit mode: type/planning/products are locked (delete + recreate for those);
  // only quantity/date/employees/remarks change, with exact stock reversal.
  isEditMode = false;
  operationId?: number;
  existingOp: any = null;
  private planningReqSeq = 0;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private planningService: PlanningService,
    private productionService: ProductionService,
    private productService: ProductService,
    private employeeService: EmployeeService,
    private machineryService: MachineryService,
    private encryptionService: EncryptionService,
    private snackbar: SnackbarService
  ) {
    this.entryForm = this.fb.group({
      planningId: [null, Validators.required],
      planningItemId: [null, Validators.required],
      operationType: ['CUTTING', Validators.required],
      inputProductId: [null],
      outputProductId: [null, Validators.required],
      quantity: [null, [Validators.required, Validators.min(1)]],
      totalBags: [null, [Validators.min(0)]],
      operationDate: [new Date().toISOString().substring(0, 10)],
      employeeIds: [[]],
      // MACHINERY_MASTER: dropdown-selected machine (optional; replaces machineRemarks).
      machineryId: [null],
      remarks: ['']
    });
  }

  ngOnInit(): void {
    // Encrypted id in URL: decrypt before use.
    const rawEditId = this.route.snapshot.paramMap.get('id');
    const editId = this.decId(rawEditId);
    if (rawEditId && !editId) {
      this.snackbar.error('Invalid link');
      this.router.navigate(['/planning']);
      return;
    }
    if (editId) {
      this.isEditMode = true;
      this.operationId = editId;
      // Locked controls must not block submit in edit mode.
      ['planningId', 'planningItemId', 'operationType', 'inputProductId', 'outputProductId']
        .forEach(k => {
          this.entryForm.get(k)?.clearValidators();
          this.entryForm.get(k)?.updateValueAndValidity({ emitEvent: false });
        });
      this.loadEmployees();
      this.loadMachineries();
      this.loadOperation(editId);
      return;
    }
    this.loadPlannings();
    this.loadProducts();
    this.loadEmployees();
    this.loadMachineries();
    // User selection drives the product list (this was missing — products only
    // loaded via query params before this fix).
    this.entryForm.get('planningId')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      this.entryForm.patchValue({ planningItemId: null }, { emitEvent: false });
      this.selectedItem = null;
      if (id) {
        this.onPlanningChange(Number(id));
      } else {
        this.planningItems = [];
      }
    });
    const qPlanningId = this.decId(this.route.snapshot.queryParamMap.get('planningId'));
    const qItemId = this.decId(this.route.snapshot.queryParamMap.get('planningItemId'));
    if (qPlanningId) {
      this.entryForm.patchValue({ planningId: qPlanningId }, { emitEvent: false });
      this.onPlanningChange(qPlanningId, qItemId || null);
    }
    this.entryForm.get('operationType')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.onOperationTypeChange());
    this.entryForm.get('planningItemId')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((v) => this.onItemChange(v));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPlannings(): void {
    this.isLoading = true;
    this.planningService.searchPlannings({ currentPage: 0, perPageRecord: 100, sortBy: 'id', sortDir: 'desc' }).subscribe({
      next: (response) => {
        if (response.success) {
          this.plannings = response.data.content;
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.snackbar.error(error?.error?.message || 'Failed to load plannings');
        this.isLoading = false;
      }
    });
  }

  onPlanningChange(planningId: number, preselectItem: number | null = null): void {
    if (!planningId) {
      this.planningItems = [];
      return;
    }
    // Drop stale rows immediately so the previous planning's products never linger.
    this.planningItems = [];
    const seq = ++this.planningReqSeq;
    this.isLoading = true;
    // Slim items-only API (not the full planning detail).
    this.planningService.getPlanningItems(planningId).subscribe({
      next: (response) => {
        if (seq !== this.planningReqSeq) {
          return; // a newer planning was picked; ignore this late response
        }
        if (response.success) {
          this.planningItems = response.data || [];
          if (preselectItem) {
            this.entryForm.patchValue({ planningItemId: preselectItem });
            this.onItemChange(preselectItem);
          }
        }
        this.isLoading = false;
      },
      error: (error) => {
        if (seq !== this.planningReqSeq) {
          return;
        }
        this.snackbar.error(error?.error?.message || 'Failed to load planning items');
        this.isLoading = false;
      }
    });
  }

  onItemChange(itemId: number): void {
    this.selectedItem = this.planningItems.find(i => i.id === Number(itemId)) || null;
    if (this.selectedItem) {
      // Default output to the planning product
      this.entryForm.patchValue({ outputProductId: this.selectedItem.productId }, { emitEvent: false });
      this.onOperationTypeChange();
    }
  }

  onOperationTypeChange(): void {
    const op = this.entryForm.get('operationType')?.value;
    const outId = this.entryForm.get('outputProductId')?.value;
    if ((op === 'EMBOSS' || op === 'COATING' || op === 'PACKING') && outId) {
      // Same-product stages: lock input = output
      this.entryForm.patchValue({ inputProductId: outId }, { emitEvent: false });
    }
  }

  get isSameProductStage(): boolean {
    const op = this.entryForm.get('operationType')?.value;
    return op === 'EMBOSS' || op === 'COATING' || op === 'PACKING';
  }

  get operationHint(): string {
    const op = this.entryForm.get('operationType')?.value;
    return this.operationOptions.find(o => o.value === op)?.hint || '';
  }

  /**
   * Stage-chain balance for the selected operation (mirrors backend):
   * Emboss minuses Cutting, Coating minuses Emboss, Packing minuses Coating
   * (or Emboss when coating is not required), Dispatch minuses Packing.
   */
  get availableInfo(): { label: string; qty: number } | null {
    if (!this.selectedItem || this.isEditMode) {
      return null;
    }
    const s = this.selectedItem;
    const num = (v: any) => Number(v) || 0;
    const cutting = num(s.cuttingQty);
    const emboss = num(s.embossQty);
    const coating = num(s.coatingQty);
    const packing = num(s.packingQty);
    const dispatch = num(s.dispatchQty);
    const planned = num(s.plannedQuantity);
    switch (this.entryForm.get('operationType')?.value) {
      case 'CUTTING':
      case 'CUTTING_EMBOSS':
        return { label: 'Yet to cut (Planned − Cutting)', qty: planned - cutting };
      case 'EMBOSS':
        return { label: 'Available in Cutting stage (Cutting − Emboss)', qty: cutting - emboss };
      case 'COATING':
        return { label: 'Available in Emboss stage (Emboss − Coating)', qty: emboss - coating };
      case 'PACKING': {
        const src = s.coatingRequired ? coating : emboss;
        const stage = s.coatingRequired ? 'Coating' : 'Emboss';
        return { label: `Available in ${stage} stage`, qty: src - packing };
      }
      case 'DISPATCH':
        return { label: 'Available in Packing stage (Packing − Dispatch)', qty: packing - dispatch };
      default:
        return null;
    }
  }

  loadProducts(): void {
    this.productService.getProducts({ status: 'A' }).subscribe({
      next: (response) => {
        if (response.success) {
          this.products = response.data;
        }
      },
      error: () => this.snackbar.error('Failed to load products')
    });
  }

  loadEmployees(): void {
    this.employeeService.getAllEmployees().subscribe({
      next: (response) => {
        if (response.success) {
          this.employees = response.data;
        }
      },
      error: () => { }
    });
  }

  loadMachineries(): void {
    this.isLoadingMachineries = true;
    this.machineryService.getMachineries().subscribe({
      next: (response) => {
        if (response.success) {
          this.machineries = response.data;
        }
        this.isLoadingMachineries = false;
      },
      error: () => {
        this.snackbar.error('Failed to load machineries');
        this.isLoadingMachineries = false;
      }
    });
  }

  refreshMachineries(): void {
    this.isLoadingMachineries = true;
    this.machineryService.refreshMachineries().subscribe({
      next: (response) => {
        if (response.success) {
          this.machineries = response.data;
          this.snackbar.success('Machineries refreshed successfully');
        }
        this.isLoadingMachineries = false;
      },
      error: () => {
        this.snackbar.error('Failed to refresh machineries');
        this.isLoadingMachineries = false;
      }
    });
  }

  private loadOperation(id: number): void {
    this.isLoading = true;
    this.productionService.getOperationDetail(id).subscribe({
      next: (response) => {
        if (response.success) {
          this.existingOp = response.data;
          this.entryForm.patchValue({
            quantity: this.existingOp.quantity,
            totalBags: this.existingOp.totalBags ?? null,
            operationDate: this.existingOp.operationDate
              ? formatDate(this.existingOp.operationDate, 'yyyy-MM-dd', 'en')
              : new Date().toISOString().substring(0, 10),
            employeeIds: this.existingOp.employeeIds || [],
            machineryId: this.existingOp.machineryId || null,
            remarks: this.existingOp.remarks || ''
          }, { emitEvent: false });
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.snackbar.error(error?.error?.message || 'Failed to load production entry');
        this.isLoading = false;
        this.router.navigate(['/planning']);
      }
    });
  }

  onSubmit(): void {
    Object.keys(this.entryForm.controls).forEach(k => this.entryForm.get(k)?.markAsTouched());
    if (this.entryForm.invalid) {
      this.snackbar.error('Please fix validation errors');
      return;
    }
    const v = this.entryForm.getRawValue();
    if (this.isEditMode) {
      this.isSaving = true;
      this.productionService.updateOperation({
        id: this.operationId,
        quantity: Number(v.quantity),
        totalBags: v.totalBags === null || v.totalBags === '' || v.totalBags === undefined
          ? null : Number(v.totalBags),
        operationDate: this.toApiDateTime(v.operationDate),
        employeeIds: v.employeeIds || [],
        machineryId: v.machineryId ? Number(v.machineryId) : null,
        remarks: v.remarks || ''
      }).subscribe({
        next: (response) => {
          if (response.success) {
            this.snackbar.success(response.message);
            this.router.navigate(['/planning', this.encId(this.existingOp?.planningId)]);
          }
          this.isSaving = false;
        },
        error: (error) => {
          this.snackbar.error(error?.error?.message || 'Failed to update production entry');
          this.isSaving = false;
        }
      });
      return;
    }
    if ((v.operationType === 'CUTTING' || v.operationType === 'CUTTING_EMBOSS') && !v.inputProductId) {
      this.snackbar.error('Input product (raw material) is required for cutting');
      return;
    }
    if (v.operationType === 'COATING' && this.selectedItem && !this.selectedItem.coatingRequired) {
      this.snackbar.error('Coating is not required for this planning product');
      return;
    }
    // Stage-chain guard (backend enforces authoritatively; immediate feedback only).
    if (this.availableInfo && Number(v.quantity) > this.availableInfo.qty) {
      this.snackbar.error(`Only ${this.availableInfo.qty} pcs ${this.availableInfo.label}`);
      return;
    }
    this.isSaving = true;
    const payload: any = {
      planningId: Number(v.planningId),
      planningItemId: Number(v.planningItemId),
      operationType: v.operationType,
      inputProductId: v.inputProductId ? Number(v.inputProductId) : null,
      outputProductId: Number(v.outputProductId),
      quantity: Number(v.quantity),
      totalBags: v.totalBags === null || v.totalBags === '' || v.totalBags === undefined
        ? null : Number(v.totalBags),
      operationDate: this.toApiDateTime(v.operationDate),
      employeeIds: v.employeeIds || [],
      machineryId: v.machineryId ? Number(v.machineryId) : null,
      remarks: v.remarks || ''
    };
    this.productionService.createOperation(payload).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackbar.success(response.message);
          const pid = this.entryForm.get('planningId')?.value;
          this.router.navigate(['/planning', this.encId(pid)]);
        }
        this.isSaving = false;
      },
      error: (error) => {
        this.snackbar.error(error?.error?.message || 'Failed to save production entry');
        this.isSaving = false;
      }
    });
  }

  get cancelLink(): any[] | string {
    return this.isEditMode && this.existingOp?.planningId
      ? ['/planning', this.encId(this.existingOp.planningId)]
      : '/planning';
  }

  /** Encrypted id for URLs ; numeric ids stay in POST bodies. */
  encId(id: number | null | undefined): string {
    return this.encryptionService.encrypt(String(id ?? ''));
  }

  /** Decrypts an id coming from the URL; NaN when the link is invalid. */
  private decId(raw: string | null): number {
    if (!raw) {
      return NaN;
    }
    const n = Number(this.encryptionService.decrypt(raw));
    return Number.isFinite(n) && n > 0 ? n : NaN;
  }

  /**
   * Backend expects dd-MM-yyyy HH:mm:ss (CustomDateDeserializer) while the
   * date input gives yyyy-MM-dd. Sending the raw value 500s the request.
   */
  private toApiDateTime(dateStr: string | null | undefined): string | null {
    if (!dateStr) {
      return null;
    }
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
    return m ? `${m[3]}-${m[2]}-${m[1]} 00:00:00` : dateStr;
  }
}
