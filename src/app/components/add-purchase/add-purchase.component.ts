import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { PurchaseService } from '../../services/purchase.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { LoaderComponent } from '../../shared/components/loader/loader.component';
import { RouterModule } from '@angular/router';
import { SearchableSelectComponent } from '../../shared/components/searchable-select/searchable-select.component';
import { CacheService } from '../../shared/services/cache.service';

@Component({
  selector: 'app-add-purchase',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    LoaderComponent,
    SearchableSelectComponent
  ],
  templateUrl: './add-purchase.component.html',
  styleUrls: ['./add-purchase.component.scss']
})
export class AddPurchaseComponent implements OnInit {
  purchaseForm!: FormGroup;
  products: any[] = [];
  loading = false;
  isLoadingProducts = false;

  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    private purchaseService: PurchaseService,
    private snackbar: SnackbarService,
    private cacheService: CacheService
  ) {
    this.initForm();
  }

  ngOnInit() {
    this.loadProducts();
  }

  private loadProducts(): void {
    this.isLoadingProducts = true;
    this.productService.getProducts({ status: 'A' }).subscribe({
      next: (response) => {
        if (response.success) {
          this.products = response.data;
        }
        this.isLoadingProducts = false;
      },
      error: (error) => {
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
      error: (error) => {
        this.snackbar.error('Failed to refresh products');
        this.isLoadingProducts = false;
      }
    });
  }

  private initForm() {
    const now = new Date();
    const localISOString = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
      .toISOString()
      .slice(0, 16);

    this.purchaseForm = this.fb.group({
      productId: ['', Validators.required],
      quantity: ['', [Validators.required, Validators.min(1)]],
      unitPrice: ['', [Validators.required, Validators.min(0.01)]],
      purchaseDate: [localISOString, Validators.required],
      invoiceNumber: ['', Validators.required],
      otherExpenses: [0, [Validators.required, Validators.min(0)]],
      discount: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      discountAmount: [0, [Validators.required, Validators.min(0)]],
      discountedPrice: [{ value: 0, disabled: true }]
    });

    this.setupDiscountCalculation();
  }

  private setupDiscountCalculation() {
    const fields = ['quantity', 'unitPrice', 'discount', 'discountAmount'];
    fields.forEach(field => {
      this.purchaseForm.get(field)?.valueChanges.subscribe(() => {
        this.calculateDiscount();
      });
    });
  }

  private calculateDiscount(): void {
    const values = {
      quantity: this.purchaseForm.get('quantity')?.value || 0,
      unitPrice: this.purchaseForm.get('unitPrice')?.value || 0,
      discountPercentage: this.purchaseForm.get('discount')?.value || 0,
      discountAmount: this.purchaseForm.get('discountAmount')?.value || 0,
      finalPrice: 0
    };

    const totalPrice = values.quantity * values.unitPrice;
    
    if (values.discountAmount > 0) {
      values.finalPrice = totalPrice - values.discountAmount;
      values.discountPercentage = (values.discountAmount / totalPrice) * 100;
    } else if (values.discountPercentage > 0) {
      values.discountAmount = (totalPrice * values.discountPercentage) / 100;
      values.finalPrice = totalPrice - values.discountAmount;
    } else {
      values.finalPrice = totalPrice;
    }

    this.purchaseForm.patchValue({
      discountAmount: values.discountAmount,
      discount: values.discountPercentage,
      discountedPrice: values.finalPrice
    }, { emitEvent: false });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.purchaseForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }

  getFieldError(fieldName: string): string {
    const field = this.purchaseForm.get(fieldName);
    if (field?.errors && field.touched) {
      return `${fieldName} is required`;
    }
    if (field?.errors && field.errors['min']) {
      if (fieldName === 'quantity') return 'Quantity must be greater than 0';
        if (fieldName === 'unitPrice') return 'Unit price must be greater than 0';
      if (fieldName === 'otherExpenses') return 'Other expenses must be greater than or equal to 0';
    }
    return '';
  }

  resetForm() {
    this.initForm();
  }

  onSubmit() {
    if (this.purchaseForm.valid) {
      this.loading = true;
      const formData = { ...this.purchaseForm.value };
      
      // Only format the date if it's a valid date string
      if (formData.purchaseDate && isNaN(new Date(formData.purchaseDate).getTime())) {
        this.snackbar.error('Invalid purchase date');
        this.loading = false;
        return;
      }

      if (formData.purchaseDate) {
        try {
          const date = new Date(formData.purchaseDate);
          formData.purchaseDate = date.toLocaleString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }).replace(/\//g, '-').replace(',', '');
        } catch (error) {
          this.snackbar.error('Invalid date format');
          this.loading = false;
          return;
        }
      }

      this.purchaseService.createPurchase(formData).subscribe({
        next: (response: any) => {
          if (response?.success) {
            this.snackbar.success('Purchase created successfully');
            this.resetForm();
            this.loading = false;
          }
        },
        error: (error) => {
          this.snackbar.error(error?.error?.message || 'Failed to create purchase');
          this.loading = false;
        },
        complete: () => {
          this.loading = false;
        }
      });
    } else {
      Object.keys(this.purchaseForm.controls).forEach(key => {
        const control = this.purchaseForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
    }
  }
}
