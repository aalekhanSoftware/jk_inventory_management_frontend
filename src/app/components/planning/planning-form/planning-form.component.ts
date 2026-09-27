import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormsModule, AbstractControl } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PlanningService } from '../../../services/planning.service';
import { EmployeeService } from '../../../services/employee.service';
import { ProductService } from '../../../services/product.service';
import { CustomerService } from '../../../services/customer.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { EncryptionService } from '../../../shared/services/encryption.service';

@Component({
  selector: 'app-planning-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LoaderComponent,
    RouterLink,
    SearchableSelectComponent,
    FormsModule,
    RouterModule
  ],
  templateUrl: './planning-form.component.html',
  styleUrls: ['./planning-form.component.scss']
})
export class PlanningFormComponent implements OnInit, OnDestroy {
  planningForm!: FormGroup;
  isLoading = false;
  isEditMode = false;
  planningId?: number;
  planningNumber?: string;
  products: any[] = [];
  employees: any[] = [];
  customers: any[] = [];
  isLoadingProducts = false;
  isLoadingEmployees = false;
  isLoadingCustomers = false;
  // Already-produced total per planning-item id (cutting+emboss+coating+packing+dispatch).
  // Planned qty cannot be reduced below this floor (Remaining must stay >= 0).
  private producedFloorByItemId = new Map<number, number>();
  private destroy$ = new Subject<void>();

  get itemsFormArray(): FormArray {
    return this.planningForm.get('items') as FormArray;
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if (event.repeat || this.isLoading) {
      return;
    }
    if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      event.stopPropagation();
      this.addItemAndFocus();
    }
  }

  constructor(
    private fb: FormBuilder,
    private planningService: PlanningService,
    private employeeService: EmployeeService,
    private productService: ProductService,
    private customerService: CustomerService,
    private router: Router,
    private route: ActivatedRoute,
    private encryptionService: EncryptionService,
    private snackbar: SnackbarService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    // Encrypted id in URL (medonix add-sale pattern): decrypt before use.
    const rawId = this.route.snapshot.paramMap.get('id');
    const decrypted = rawId ? Number(this.encryptionService.decrypt(rawId)) : NaN;
    if (rawId && !decrypted) {
      this.snackbar.error('Invalid link');
      this.router.navigate(['/planning']);
      return;
    }
    this.planningId = decrypted || undefined;
    if (this.planningId) {
      this.isEditMode = true;
      this.loadPlanning();
    } else {
      this.addItem();
    }
    this.loadProducts();
    this.loadEmployees();
    this.loadCustomers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.planningForm = this.fb.group({
      customerId: [null],
      employeeIds: [[], Validators.required],
      remarks: [''],
      status: ['O', Validators.required],
      planningDate: [formatDate(new Date(), 'yyyy-MM-dd', 'en'), Validators.required],
      items: this.fb.array([])
    });
  }

  addItem(itemData?: any): void {
    const itemGroup = this.fb.group({
      id: [itemData?.id || null],
      productId: [itemData?.productId || '', Validators.required],
      plannedQuantity: [itemData?.plannedQuantity || '', [Validators.required, Validators.min(1)]],
      totalBags: [itemData?.totalBags ?? null, [Validators.min(0)]],
      coatingRequired: [itemData?.coatingRequired || false],
      remarks: [itemData?.remarks || '']
    });
    this.itemsFormArray.push(itemGroup);
  }

  removeItem(index: number): void {
    if (this.itemsFormArray.length <= 1) {
      this.snackbar.error('At least one product is required');
      return;
    }
    this.itemsFormArray.removeAt(index);
  }

  private addItemAndFocus(): void {
    this.addItem();
    const newIndex = this.itemsFormArray.length - 1;
    setTimeout(() => {
      const host = document.getElementById(`productId_${newIndex}`);
      host?.querySelector('input')?.focus();
    }, 0);
  }

  getTotalPlanned(): number {
    return this.itemsFormArray.controls.reduce((total, control) => {
      const qty = Number((control as FormGroup).get('plannedQuantity')?.value) || 0;
      return total + qty;
    }, 0);
  }

  /** Minimum allowed planned qty for a row in edit mode (= already produced). */
  getItemFloor(index: number): number {
    if (!this.isEditMode) {
      return 0;
    }
    const g = this.itemsFormArray.at(index) as FormGroup;
    const id = Number(g?.get('id')?.value);
    return id ? (this.producedFloorByItemId.get(id) || 0) : 0;
  }

  private loadPlanning(): void {
    if (!this.planningId) return;
    this.isLoading = true;
    this.planningService.getPlanningDetail(this.planningId).subscribe({
      next: (response) => {
        if (response.success) {
          const data = response.data;
          this.planningNumber = data.planningNumber || undefined;
          this.planningForm.patchValue({
            customerId: data.customerId || null,
            employeeIds: data.employeeIds || [],
            remarks: data.remarks || '',
            status: data.status || 'O',
            planningDate: data.planningDate
              ? formatDate(data.planningDate, 'yyyy-MM-dd', 'en')
              : formatDate(new Date(), 'yyyy-MM-dd', 'en')
          });
          while (this.itemsFormArray.length > 0) {
            this.itemsFormArray.removeAt(0);
          }
          const items = data.items && data.items.length > 0 ? data.items : [];
          if (items.length > 0) {
            items.forEach((item: any) => {
              this.addItem({
                id: item.id || null,
                productId: item.productId,
                plannedQuantity: item.plannedQuantity,
                totalBags: item.totalBags ?? null,
                coatingRequired: !!item.coatingRequired,
                remarks: item.remarks || ''
              });
              if (item.id) {
                // Backend once-counted plan consumption (Cutting incl. combined);
                // fall back to the Cutting total for older payloads without producedQty.
                const floor = item.producedQty !== undefined && item.producedQty !== null
                  ? Number(item.producedQty)
                  : (Number(item.cuttingQty) || 0);
                this.producedFloorByItemId.set(Number(item.id), floor);
              }
            });
          } else {
            this.addItem();
          }
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.snackbar.error(error?.error?.message || 'Failed to load planning details');
        this.isLoading = false;
      }
    });
  }

  public loadProducts(): void {
    this.isLoadingProducts = true;
    this.productService.getProducts({ status: 'A' }).subscribe({
      next: (response) => {
        if (response.success) {
          this.products = response.data;
        }
        this.isLoadingProducts = false;
      },
      error: () => {
        this.snackbar.error('Failed to load products');
        this.isLoadingProducts = false;
      }
    });
  }

  refreshProducts(): void {
    this.isLoadingProducts = true;
    this.productService.refreshProducts().subscribe({
      next: (response) => {
        if (response.success) {
          this.products = response.data;
          this.snackbar.success('Products refreshed successfully');
        }
        this.isLoadingProducts = false;
      },
      error: () => {
        this.snackbar.error('Failed to refresh products');
        this.isLoadingProducts = false;
      }
    });
  }

  public loadEmployees(): void {
    this.isLoadingEmployees = true;
    this.employeeService.getAllEmployees().subscribe({
      next: (response) => {
        if (response.success) {
          this.employees = response.data;
        }
        this.isLoadingEmployees = false;
      },
      error: () => {
        this.snackbar.error('Failed to load employees');
        this.isLoadingEmployees = false;
      }
    });
  }

  public loadCustomers(): void {
    this.isLoadingCustomers = true;
    this.customerService.getCustomers({ status: 'A' }).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.customers = response.data?.content || response.data || [];
        }
        this.isLoadingCustomers = false;
      },
      error: () => {
        this.isLoadingCustomers = false;
      }
    });
  }

  onSubmit(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.markFormGroupTouched(this.planningForm);
    if (this.planningForm.invalid || this.itemsFormArray.length === 0) {
      this.snackbar.error(this.itemsFormArray.length === 0 ? 'Please add at least one product' : 'Please fix validation errors');
      return;
    }
    // Duplicate product guard (also enforced backend)
    const ids = this.itemsFormArray.controls.map(c => Number((c as FormGroup).get('productId')?.value));
    if (new Set(ids).size !== ids.length) {
      this.snackbar.error('Duplicate product in planning items');
      return;
    }
    // Floor guard: planned qty cannot go below already-produced total
    // (also enforced backend; this is immediate feedback only).
    for (let idx = 0; idx < this.itemsFormArray.controls.length; idx++) {
      const g = this.itemsFormArray.at(idx) as FormGroup;
      const id = Number(g.get('id')?.value);
      const floor = id ? (this.producedFloorByItemId.get(id) || 0) : 0;
      const planned = Number(g.get('plannedQuantity')?.value) || 0;
      if (this.isEditMode && floor > 0 && planned < floor) {
        this.snackbar.error(`Row ${idx + 1}: planned quantity cannot be less than already produced (${floor})`);
        return;
      }
    }

    this.isLoading = true;
    const formValue = this.planningForm.getRawValue();
    const items = this.itemsFormArray.controls.map((control) => {
      const v = (control as FormGroup).getRawValue();
      const item: any = {
        productId: Number(v.productId),
        plannedQuantity: Number(v.plannedQuantity),
        totalBags: v.totalBags === null || v.totalBags === '' || v.totalBags === undefined
          ? null : Number(v.totalBags),
        coatingRequired: !!v.coatingRequired,
        remarks: v.remarks || ''
      };
      if (this.isEditMode && v.id) {
        item.id = v.id;
      }
      return item;
    });

    const formData: any = {
      customerId: formValue.customerId || null,
      employeeIds: formValue.employeeIds,
      remarks: formValue.remarks || '',
      status: formValue.status,
      planningDate: formValue.planningDate,
      items
    };

    const request = this.isEditMode
      ? this.planningService.updatePlanning({ ...formData, id: this.planningId })
      : this.planningService.createPlanning(formData);

    request.pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackbar.success(response.message);
          this.router.navigate(['/planning']);
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.snackbar.error(error?.error?.message || `Failed to ${this.isEditMode ? 'update' : 'create'} planning`);
        this.isLoading = false;
      }
    });
  }

  resetForm(): void {
    while (this.itemsFormArray.length > 0) {
      this.itemsFormArray.removeAt(0);
    }
    this.planningForm.reset({
      status: 'O',
      employeeIds: [],
      customerId: null,
      remarks: '',
      planningDate: formatDate(new Date(), 'yyyy-MM-dd', 'en')
    });
    this.addItem();
  }

  private markFormGroupTouched(formGroup: FormGroup | FormArray): void {
    if (formGroup instanceof FormArray) {
      formGroup.controls.forEach(control => {
        control.markAsTouched();
        if (control instanceof FormGroup || control instanceof FormArray) {
          this.markFormGroupTouched(control);
        }
      });
    } else if (formGroup instanceof FormGroup) {
      Object.keys(formGroup.controls).forEach(key => {
        const control = formGroup.controls[key];
        control.markAsTouched();
        if (control instanceof FormGroup || control instanceof FormArray) {
          this.markFormGroupTouched(control);
        }
      });
    }
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.planningForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }

  isItemFieldInvalid(index: number, fieldName: string): boolean {
    const itemGroup = this.itemsFormArray.at(index) as FormGroup;
    const field = itemGroup.get(fieldName);
    return field ? field.invalid && (field.dirty || field.touched) : false;
  }

  getFieldError(fieldName: string): string {
    const control = this.planningForm.get(fieldName);
    if (control?.errors) {
      if (control.errors['required']) return 'This field is required';
      if (control.errors['min']) return 'Value must be greater than 0';
    }
    return '';
  }

  getItemFieldError(index: number, fieldName: string): string {
    const itemGroup = this.itemsFormArray.at(index) as FormGroup;
    const control = itemGroup.get(fieldName);
    if (control?.errors && control.touched) {
      if (control.errors['required']) return 'Required';
      if (control.errors['min']) return 'Must be > 0';
    }
    return '';
  }

  isFieldInvalidControl(control: AbstractControl | null): boolean {
    return control ? control.invalid && (control.dirty || control.touched) : false;
  }
}
