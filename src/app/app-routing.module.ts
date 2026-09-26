import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './components/auth/login/login.component';
import { CategoryComponent } from './components/category/category.component';
import { ProductComponent } from './components/product/product.component';
import { AuthGuard } from './guards/auth.guard';
import { ClientPasswordGuard } from './guards/client-password.guard';
import { PurchaseComponent } from './components/purchase/purchase.component';
import { AddPurchaseComponent } from './components/add-purchase/add-purchase.component';
import { SaleComponent } from './components/sale/sale.component';
import { ProfitComponent } from './components/profit/profit.component';
import { CustomerComponent } from './components/customer/customer.component';
import { AddCombinedPurchaseSaleComponent } from './components/add-combined-purchase-sale/add-combined-purchase-sale.component';
import { PowderCoatingProcessComponent } from './components/powder-coating/powder-coating-process/powder-coating-process.component';
import { AddPowderCoatingProcessComponent } from './components/powder-coating/add-powder-coating-process/add-powder-coating-process.component';
import { TransportComponent } from './components/Transports/transport/transport.component';
import { TransportListComponent } from './components/Transports/transport-list/transport-list.component';
import { PlanDispatchListComponent } from './components/plan-dispatch/plan-dispatch-list/plan-dispatch-list.component';
import { PlanDispatchFormComponent } from './components/plan-dispatch/plan-dispatch-form/plan-dispatch-form.component';
import { EmployeeListComponent } from './components/employee/employee-list/employee-list.component';
import { EmployeeFormComponent } from './components/employee/employee-form/employee-form.component';
import { EmployeeOrderListComponent } from './components/employee-order/employee-order-list/employee-order-list.component';
import { EmployeeOrderFormComponent } from './components/employee-order/employee-order-form/employee-order-form.component';
import { PlanningListComponent } from './components/planning/planning-list/planning-list.component';
import { PlanningFormComponent } from './components/planning/planning-form/planning-form.component';
import { PlanningDetailComponent } from './components/planning/planning-detail/planning-detail.component';
import { ProductionEntryComponent } from './components/production/production-entry/production-entry.component';
import { ProductionDashboardComponent } from './components/production/production-dashboard/production-dashboard.component';
import { ProcessDateReportComponent } from './components/production/process-date-report/process-date-report.component';
import { StockMovementListComponent } from './components/production/stock-movement-list/stock-movement-list.component';
import { DailyProfitComponent } from './components/all-profits/daily-profit/daily-profit.component';
import { AddQuotationComponent } from './components/all-quotation/add-quotation/add-quotation.component';
import { QuotationComponent } from './components/all-quotation/quotation/quotation.component';
const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: 'category',
    component: CategoryComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'product',
    component: ProductComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'purchase',
    component: PurchaseComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'purchase/create',
    component: AddPurchaseComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'sale',
    component: SaleComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'profit',
    component: ProfitComponent,
    canActivate: [AuthGuard, ClientPasswordGuard]
  },
  {
    path: 'customer',
    component: CustomerComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'combined-purchase-sale',
    component: AddCombinedPurchaseSaleComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'powder-coating-process',
    component: PowderCoatingProcessComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'powder-coating-process/create',
    component: AddPowderCoatingProcessComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'powder-coating-process/edit/:id',
    component: AddPowderCoatingProcessComponent,
    title: 'Edit Powder Coating Process'
  },
  {
    path: 'transport/create',
    component: TransportComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'transport',
    component: TransportListComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'quotation',
    component: QuotationComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'quotation/create',
    component: AddQuotationComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'transport/edit/:id',
    component: TransportComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'plan-dispatch',
    component: PlanDispatchListComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'plan-dispatch/create',
    component: PlanDispatchFormComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'plan-dispatch/edit/:id',
    component: PlanDispatchFormComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'employee',
    component: EmployeeListComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'employee/create',
    component: EmployeeFormComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'employee/edit/:id',
    component: EmployeeFormComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'employee-order',
    component: EmployeeOrderListComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'employee-order/create',
    component: EmployeeOrderFormComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'employee-order/edit/:id',
    component: EmployeeOrderFormComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'daily-profit',
    component: DailyProfitComponent,
    canActivate: [AuthGuard, ClientPasswordGuard]
  },
  {
    path: 'planning',
    component: PlanningListComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'planning/create',
    component: PlanningFormComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'planning/edit/:id',
    component: PlanningFormComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'planning/:id',
    component: PlanningDetailComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'production/entry',
    component: ProductionEntryComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'production/edit/:id',
    component: ProductionEntryComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'dashboard',
    component: ProductionDashboardComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'stock-movements',
    component: StockMovementListComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'production/report',
    component: ProcessDateReportComponent,
    canActivate: [AuthGuard]
  },
  {
    path: '**',
    redirectTo: '/login',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }